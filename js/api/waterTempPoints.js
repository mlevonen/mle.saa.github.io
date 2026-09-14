// ==========================
// Vedenlämpöpisteet MUUALLA kuin sivuston omilla havaintoasemilla
// (ks. js/waterTempPointsControl.js – "Vedenlämpö"-nappi kartalla).
//
// Kaksi avointa datalähdettä yhdistettynä:
//
//  1) SYKE:n (Suomen ympäristökeskus) Hydrologiarajapinta – sisävesien
//     (järvet/joet) pintaveden lämpötila koko Suomesta, n. 30 asemaa,
//     päivittyy n. kerran vuorokaudessa. OData-rajapinta palauttaa
//     JSON:ia suoraan (ei tarvitse XML-parsintaa kuten FMI:n WFS:ssä).
//     https://rajapinnat.ymparisto.fi/api/Hydrologiarajapinta/1.2/
//
//  2) Forum Virium Helsingin UiRaS-anturiverkosto – pääkaupunkiseudun
//     (Helsinki/Espoo/Vantaa) uimarantojen/uimapaikkojen veden lämpötila,
//     päivittyy n. 30 min välein. Valmis GeoJSON, sama tiedosto sisältää
//     kaikkien anturien VIIMEISIMMÄN lukeman (kevyt, ei tarvitse hakea
//     jokaista anturia erikseen).
//     https://iot.fvh.fi/opendata/uiras/uiras_latest.geojson
//
// Molemmista suodatetaan pois pisteet, jotka ovat lähellä (ks.
// DEDUPE_RADIUS_KM) jotain sivuston OMAA havaintoasemaa (stations.js) –
// niille näytetään veden lämpötila jo asemakortin omassa Veden lämpötila
// -korttissa (ks. seaLevelCard.js/waveBuoyPopup.js), joten kartalle ei
// haluta kahta päällekkäistä/vierekkäistä palloa samasta paikasta.
// ==========================

const SYKE_URL = "https://rajapinnat.ymparisto.fi/api/Hydrologiarajapinta/1.2/odata/LampoPintavesi";
const UIRAS_URL = "https://iot.fvh.fi/opendata/uiras/uiras_latest.geojson";

// Kuinka monen päivän sisällä olevat SYKE-havainnot vielä hyväksytään
// "ajantasaiseksi" – asemat raportoivat n. kerran vuorokaudessa (aamun
// 8 mittaus), joten pari päivää taaksepäin kattaa normaalin viiveen.
const SYKE_LOOKBACK_DAYS = 4;

// Jos piste on tätä lähempänä jotain sivuston omaa havaintoasemaa
// (stations.js), sitä ei näytetä erillisenä pallona – asema näyttää jo
// veden lämpötilan omassa popupissaan (ks. seaLevelCard.js/waveBuoyPopup.js).
const DEDUPE_RADIUS_KM = 3;

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 min

// Karkea, riittävän tarkka etäisyys (km) tällä mittakaavalla – ei
// tarvita täyttä haversine-kaavaa parin kilometrin kynnysarvolle.
function approxDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat1 - lat2) * 111.32;
  const dLon = (lon1 - lon2) * 111.32 * Math.cos((lat1 + lat2) / 2 * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

// SYKE:n koordinaatit ovat merkkijonoina muodossa "DDMMSS" (asteet,
// minuutit, sekunnit peräkkäin, ei erotinmerkkejä) – esim. "633229"
// tarkoittaa 63°32'29". Muunnetaan desimaaliasteiksi.
function dmsToDecimal(value) {
  const s = String(value).padStart(6, "0");
  const deg = Number(s.slice(0, 2));
  const min = Number(s.slice(2, 4));
  const sec = Number(s.slice(4, 6));
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
  return deg + min / 60 + sec / 3600;
}

function isNearExistingStation(lat, lon) {
  if (typeof stations === "undefined" || !Array.isArray(stations)) return false;
  return stations.some(s =>
    approxDistanceKm(lat, lon, s.lat, s.lon) < DEDUPE_RADIUS_KM
  );
}

// ==========================
// 1) SYKE Hydrologiarajapinta – sisävedet koko Suomesta
// ==========================
async function fetchSykeWaterTemps() {

  const since = new Date(Date.now() - SYKE_LOOKBACK_DAYS * 24 * 3600 * 1000);
  const sinceStr = since.toISOString().slice(0, 19);

  const params = new URLSearchParams({
    "$filter": `Aika gt datetime'${sinceStr}'`,
    "$expand": "Paikka",
    "$orderby": "Aika desc"
  });

  try {

    const res = await fetch(`${SYKE_URL}?${params}`);
    if (!res.ok) {
      console.warn("SYKE-vedenlämpöhaku epäonnistui:", res.status);
      return [];
    }

    const json = await res.json();
    const rows = Array.isArray(json.value) ? json.value : [];

    // $orderby=Aika desc -> ensimmäinen esiintymä per Paikka_Id on
    // tuorein havainto, joten Map riittää poistamaan vanhemmat.
    const byPlace = new Map();

    for (const row of rows) {
      const paikkaId = row.Paikka_Id;
      if (byPlace.has(paikkaId)) continue;

      const temp = Number(row.Arvo);
      if (!Number.isFinite(temp)) continue;

      const paikka = row.Paikka;
      if (!paikka) continue;

      const lat = dmsToDecimal(paikka.KoordLat);
      const lon = dmsToDecimal(paikka.KoordLong);
      if (lat == null || lon == null) continue;

      byPlace.set(paikkaId, {
        id: `syke-${paikkaId}`,
        name: paikka.Nimi || paikka.JarviNimi || "Sisävesi",
        lat,
        lon,
        temp,
        time: row.Aika,
        source: "syke"
      });
    }

    return Array.from(byPlace.values());

  } catch (err) {
    console.warn("SYKE-vedenlämpöhaku epäonnistui:", err);
    return [];
  }

}

// ==========================
// 2) Forum Virium Helsinki UiRaS – pk-seudun uimapaikat
// ==========================
async function fetchHelsinkiAreaWaterTemps() {

  try {

    const res = await fetch(UIRAS_URL);
    if (!res.ok) {
      console.warn("UiRaS-vedenlämpöhaku epäonnistui:", res.status);
      return [];
    }

    const json = await res.json();
    const features = Array.isArray(json.features) ? json.features : [];

    const result = [];

    for (const f of features) {

      const m = f?.properties?.measurement;
      const temp = Number(m?.temp_water);
      const coords = f?.geometry?.coordinates;

      // Osa antureista on juuri nyt pois käytöstä (ei "measurement"-
      // kenttää lainkaan, ks. esim. "Uunisaari" -piste) – ohitetaan
      // hiljaisesti sen sijaan että näytettäisiin tyhjä/virheellinen pallo.
      if (!Number.isFinite(temp) || !Array.isArray(coords) || coords.length < 2) continue;

      result.push({
        id: `uiras-${f.id}`,
        name: f.properties.name || f.properties.location || "Uimapaikka",
        lat: coords[1],
        lon: coords[0],
        temp,
        time: m.time,
        source: "uiras"
      });

    }

    return result;

  } catch (err) {
    console.warn("UiRaS-vedenlämpöhaku epäonnistui:", err);
    return [];
  }

}

// ==========================
// Yhdistetty, välimuistitettu haku – tätä kutsutaan
// waterTempPointsControl.js:stä.
// ==========================
export async function fetchWaterTempPoints() {

  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return cache;
  }

  const [syke, uiras] = await Promise.all([
    fetchSykeWaterTemps(),
    fetchHelsinkiAreaWaterTemps()
  ]);

  const all = [...syke, ...uiras].filter(p => !isNearExistingStation(p.lat, p.lon));

  cache = all;
  cacheTime = Date.now();

  return all;

}
