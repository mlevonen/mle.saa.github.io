import { fetchObservationSeriesByFmisid } from "./api/dataLoader.js";
import "./charts/plugins.js";
import { updateCoastalPreview, loadCoastalPreviewCache} from "./api/coastalPreview.js";
import { updateWeatherPreview, loadWeatherPreviewCache } from "./api/weatherPreview.js";
import { getCurrentSymbol } from "./charts/plugins/weatherSymbols.js";
import { loadPreviewCache, savePreviewCache } from "./utils/previewCache.js";
import { initMarineInfoPanels } from "./marineInfoPanels.js";
import { fetchWaveBuoyObservation } from "./api/waveHeight.js";
import { renderWaveBuoyPopup } from "./popup/waveBuoyPopup.js";
import { initRadarPanel } from "./radarPanel.js";
import { initBaseLayerControl } from "./baseLayerControl.js";
import { MML_API_KEY } from "./config.js";
import { stationDetailHTML, renderStationDetail } from "./popup/stationDetail.js";
import { openMeteoWindPopupHTML, renderOpenMeteoWindPopup } from "./popup/openMeteoWindPopup.js";
import { fetchCurrentWindMulti } from "./api/openMeteoWind.js";


"use strict";

const map = L.map("map").setView([60, 25], 6);

const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

// ==========================
// Maanmittauslaitoksen avoin taustakartta (WMTS, REST-tiilit)
//
// Vaihtoehtoinen taustakartta OpenStreetMapin rinnalle, valittavissa
// kartan tasonvalitsimesta. Vaatii käyttäjäkohtaisen API-avaimen
// (ks. js/config.js) – ilman avainta MML palauttaa 401-virheen
// eivätkä tiilit lataudu, mutta OSM toimii silti normaalisti.
//
// HUOM tiilijärjestys: MML:n WMTS REST -osoite on muotoa
// .../taustakartta/default/WGS84_Pseudo-Mercator/{TileMatrix}/{TileRow}/{TileCol}.png
// eli TileRow (=y) tulee ennen TileCol (=x) – siksi URL-mallissa
// {z}/{y}/{x}, ei totuttu {z}/{x}/{y}.
// ==========================
const mmlLayer = L.tileLayer(
  `https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/taustakartta/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png?api-key=${MML_API_KEY}`,
  {
    maxZoom: 16,
    attribution: "&copy; Maanmittauslaitos"
  }
);

// Pieni pyöreäkulmainen "Taustakartta"-nappi (ei Leafletin
// oletusarvoista pino-ikonia), avaa pudotusvalikon OSM/MML-valinnalle.
initBaseLayerControl(map, [
  { name: "OpenStreetMap", layer: osmLayer },
  { name: "MML Taustakartta", layer: mmlLayer }
]);

// Oletusnäkymä: lähempänä zoomattu näkymä, joka näyttää Saariston-
// meren kokonaan ja osan Suomenlahtea (n. Hangosta Helsinkiin).
// Käyttäjä voi silti vapaasti pannata/zoomata kartalla muualle.
const bounds = L.latLngBounds(
  [59.5, 19.6],  // SW
  [60.7, 25.5]   // NE
);

map.fitBounds(bounds, {
  padding: [20, 20]
});

// Säätiedotus merenkulkijoille + Varoitukset -infopaneelit
// (avattava/piilotettava, sisältö ladataan vasta avattaessa)
initMarineInfoPanels();

// ==========================
// Popup aina infopaneelien päälle
//
// .info-panels on kiinnitetty (position:fixed) vasempaan yläkulmaan
// z-index:1000:lla. Leafletin karttapaneeli (.leaflet-map-pane, jonka
// sisällä myös popupit ovat) on kuitenkin vain z-index:400 – eikä sitä
// voi nostaa pysyvästi yli 1000:n ilman, että koko karttatausta alkaa
// peittää infopaneelit aina. Ratkaisu: lasketaan infopaneelien
// z-index tilapäisesti popupin ollessa auki, jolloin popup (ja
// samalla koko kartta) nousee hetkeksi päälle – ja palautetaan
// entiselleen kun popup suljetaan.
// ==========================
const infoPanelsEl = document.querySelector(".info-panels");

map.on("popupopen", () => {
  if (infoPanelsEl) infoPanelsEl.style.zIndex = "1";
});

map.on("popupclose", () => {
  if (infoPanelsEl) infoPanelsEl.style.zIndex = "";
});

const FMI_WFS = "https://opendata.fmi.fi/wfs";


// ==========================
// Layerit
// ==========================


const weatherLayer = L.featureGroup().addTo(map);
const coastalLayer = L.featureGroup().addTo(map);
const waveBuoyLayer = L.featureGroup().addTo(map);
const windForecastLayer = L.featureGroup().addTo(map);

// ==========================
// Sadetutka (RainViewer, api.rainviewer.com)
//
// Valmiiksi pehmennetyt ("smooth") tiilit – ei näytä yhtä
// rasteroituneelta/lohkoiselta kuin raaka WMS-tutkakuva. Ei
// oletuksena näkyvissä – käyttäjä kytkee päälle kartan oikean
// yläkulman tasonvalitsimesta. Todellinen tiili-URL asetetaan
// radarPanel.js:ssä (radarLayer.setUrl(...)) sitä mukaa kun
// käyttäjä selaa historiaa liukusäätimellä; tämä on vain alustus.
//
// maxNativeZoom rajaa RainViewerin oman tiilirajapinnan enimmäis-
// zoomiin (7) – Leaflet skaalaa tiilet visuaalisesti sitä syvemmälle
// zoomattaessa sen sijaan, että yrittäisi hakea olemattomia tiilejä.
// ==========================
const radarLayer = L.tileLayer("", {
  opacity: 0.6,
  maxNativeZoom: 7,
  attribution:
    'Tutkakuva &copy; <a href="https://www.rainviewer.com" target="_blank" rel="noopener">RainViewer</a>'
});

// Sadetutka-nappi pois käytöstä toistaiseksi (käyttäjän pyynnöstä
// 2026-08-09) – radarLayer ja radarPanel.js jätetty ennalleen,
// joten ominaisuus saadaan takaisin poistamalla kommentti alta.
// initRadarPanel(map, radarLayer);

const markerRegistry = {};

// renderStationDetail():n palauttama pysäytysfunktio käynnissä
// olevalle tuulivirtausanimaatiolle (yksi kerrallaan – uusi popup
// pysäyttää edellisen, ja popupclose pysäyttää senkin).
let stopStationDetail = null;


//IKONIFUNKTIOT

function createStationIcon(station) {

  if (station.type === "coastal") {
    return L.divIcon({
      className: "station-dot",
      html: `<div class="dot dot-coastal"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
  }

  if (station.type === "wind-fc") {
    return L.divIcon({
      className: "station-dot",
      html: `<div class="dot dot-wind-fc"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
  }

  // weather
  return L.divIcon({
    className: "station-dot",
    html: `<div class="dot dot-weather"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });

}

// Aaltopoijun ikoni: oma, tuulinuolista selvästi erottuva ulkoasu –
// pyöreä "poiju"-merkki jossa aaltoviivat ja korkeuslukema piirretty
// suoraan sisään. Pieni piikki kehän reunalla osoittaa aallokon
// tulosuunnan, jos se on tiedossa.
function createWaveIcon(height, direction, period) {

  const hasHeight = Number.isFinite(height);
  const roundedHeight = hasHeight ? height.toFixed(1) : "–";

  const color =
    !hasHeight ? "#888" :
    height < 0.5 ? "#0288d1" :
    height < 1.5 ? "#01579b" :
    height < 2.5 ? "#7b1fa2" :
                    "#c62828";

  const hasDirection = Number.isFinite(direction);

  const titleParts = [];
  if (hasHeight) titleParts.push(`Aallonkorkeus ${height.toFixed(1)} m`);
  if (Number.isFinite(period)) titleParts.push(`jakso ${period.toFixed(1)} s`);
  const title = titleParts.length ? titleParts.join(", ") : "Aaltohavaintoa ei saatavilla";

  const html = `
    <div class="wave-marker" title="${title}">
      <svg viewBox="0 0 60 60" width="60" height="60">

        ${hasDirection ? `
        <g transform="rotate(${direction} 30 30)">
          <path d="M30 1 L35 11 L25 11 Z" fill="${color}"/>
        </g>
        ` : ""}

        <circle cx="30" cy="30" r="18" fill="${color}" stroke="#fff" stroke-width="2"/>

        <path d="M13,33 Q17,27 21,33 T29,33 T37,33 T45,33"
              fill="none" stroke="#ffffff" stroke-width="1.8"
              stroke-linecap="round" opacity="0.9"/>
        <path d="M13,38 Q17,32 21,38 T29,38 T37,38 T45,38"
              fill="none" stroke="#ffffff" stroke-width="1.8"
              stroke-linecap="round" opacity="0.55"/>

        <text x="30" y="26" text-anchor="middle" font-size="11"
              font-weight="700" font-family="sans-serif" fill="#ffffff">${roundedHeight}m</text>

      </svg>
    </div>
  `;

  return L.divIcon({
    className: "wave-marker-wrapper",
    html,
    iconSize: [60, 60],
    iconAnchor: [30, 30]
  });

}

// Aaltopoijumarkeri: kevyt oma popup ilman graafeja (ei käytä
// isoa yleismallin popup-templatea, koska poijuilla ei ole
// tuuli-/lämpötilahavaintoja tms.).
function createWaveBuoyMarker(station) {

  const marker = L.marker(
    [station.lat, station.lon],
    { icon: createWaveIcon(null, null, null) }
  );

  markerRegistry[station.fmisid ?? station.id] = marker;
  marker.station = station;
  marker.previewData = null;

  marker.bindTooltip("", {
    direction: "top",
    offset: [0, -8],
    opacity: 0.9
  });

  marker.on("mouseover", function () {

    let content = `<strong>${station.name}</strong>`;
    const preview = this.previewData;

    if (preview?.height != null) {
      content += `<br>${preview.height.toFixed(1)} m`;
    }

    this.setTooltipContent(content);
    this.openTooltip();

  });

  marker.on("mouseout", function () {
    this.closeTooltip();
  });

  marker.bindPopup(`
    <div class="popup-title">${station.name}</div>
    <div class="popup-card">
      <div><strong>Aaltohavainto</strong></div>
      <div class="wave-buoy-body">
        <div class="info-panel-loading">Ladataan…</div>
      </div>
    </div>
  `);

  waveBuoyLayer.addLayer(marker);

}

// ==========================
// Asemat kartalle
// ==========================


stations.forEach(station => {

  // Aaltopoijut saavat oman, kevyemmän markerin ja popupinsa –
  // ei käytetä yleismallin tuuli-/lämpötilagraafeja sisältävää
  // popup-templatea, koska poijuilla ei niitä ole.
  if (station.type === "wavebuoy") {
    createWaveBuoyMarker(station);
    return;
  }

  // Vedenkorkeusasemille ei enää näytetä omaa markeria kartalla –
  // sama lukema näkyy jo lähimpien asemien popupin
  // "Vedenkorkeus"-kortissa (ks. findNearestSeaLevelStation).
  if (station.type === "sealevel") return;

  const marker = L.marker(
    [station.lat, station.lon],
    {
      icon: createStationIcon(station)
    }
  );

  // Rekisteriavaimena fmisid kun sellainen on (FMI-asemat), muuten
  // aseman oma id (esim. Ruotsin wind-fc-pisteet, joilla ei ole
  // fmisidiä – muuten kaikki niistä osuisivat samaan "undefined"-
  // avaimeen ja ylikirjoittaisivat toisensa rekisterissä).
  markerRegistry[station.fmisid ?? station.id] = marker;
  marker.station = station;




  // 🔹 Hover preview
    marker.previewData = null;

    marker.bindTooltip("", {
      direction: "top",
      offset: [0, -8],
      opacity: 0.9
    });

    marker.on("mouseover", function () {

    let content = `<strong>${station.name}</strong>`;
    const preview = this.previewData;

    if (!preview) {
      this.setTooltipContent(content);
      this.openTooltip();
      return;
    }

    if (station.type === "weather" && preview.temp != null) {
      content += `<br>${preview.temp.toFixed(1)} °C`;
    }

    else if (station.type === "coastal" && preview.wind != null) {
      content += `<br>${preview.wind.toFixed(1)} m/s`;
    }

    else if (station.type === "wind-fc" && preview.wind != null) {
      content += `<br>${preview.wind.toFixed(1)} m/s`;
    }

    this.setTooltipContent(content);
    this.openTooltip();
  });

  marker.on("mouseout", function () {
    this.closeTooltip();
  });

  marker.bindPopup(
    station.type === "wind-fc"
      ? openMeteoWindPopupHTML(station)
      : stationDetailHTML(station)
  );

  // Lisää oikeaan layeriin
  if (station.type === "weather") {
    weatherLayer.addLayer(marker);
  }

  if (station.type === "coastal") {
    coastalLayer.addLayer(marker);
  }

  if (station.type === "wind-fc") {
    windForecastLayer.addLayer(marker);
  }
 });

// ==========================
// Sää- ja rannikkoasemien tuulinuoli-ikoni
// ==========================
// updateCoastalPreview/loadCoastalPreviewCache käsittelee vain
// "featured"-rannikkoasemat (kotisivun karusellin data), joten
// KAIKKI sää- ja rannikkoasemat tarvitsevat oman tuulinuolensa
// tämän silmukan kautta. Käytetään kevyttä suoraa havaintohakua
// raskaan loadPopupData:n (koko popupin data: ennusteet, aurinko,
// sääsymbolit ym.) sijaan – se hidasti kartan avautumista turhaan.

const WIND_ICON_CACHE_KEY = "windIconCache";
const WIND_ICON_CACHE_TTL = 5 * 60 * 1000;

function applyWindIcons(values) {
  Object.entries(values).forEach(([fmisid, w]) => {
    const marker = markerRegistry[fmisid];
    if (!marker) return;
    marker.setIcon(createWindIcon(w.speed, w.dir, w.gust));
  });
}

// 1. Näytä heti viimeksi tunnetut lukemat (jos alle 5 min vanhoja)
const cachedWindIcons = loadPreviewCache(WIND_ICON_CACHE_KEY, WIND_ICON_CACHE_TTL);
if (cachedWindIcons) applyWindIcons(cachedWindIcons);

// 2. Hae tuoreet lukemat rinnakkain kaikille sää- ja rannikkoasemille taustalla
(async () => {

  const windIconStations = stations.filter(
    s => s.type === "weather" || s.type === "coastal"
  );
  const freshValues = {};

  // Asemat, joilta FMI:n havaintorajapinta ei palauttanut kelvollista
  // tuulilukemaa (esim. Helsinki Helsingin majakka, jolta rajapinta
  // ei palauta mitään havaintoa lainkaan) – näille kokeillaan
  // varalla Open-Meteon koordinaattipohjaista nykytuulta, jotta
  // kartan tuulinuoli ei jää kokonaan piiloon.
  const fmiWindFallbackStations = [];

  await Promise.all(windIconStations.map(async station => {
    try {
      const series = await fetchObservationSeriesByFmisid(station.fmisid);

      const latest = [...series].reverse().find(
        p => p.windspeedms != null && p.winddirection != null
      );

      if (!latest) {
        fmiWindFallbackStations.push(station);
        return;
      }

      freshValues[station.fmisid] = {
        speed: latest.windspeedms,
        dir: latest.winddirection,
        gust: latest.windgust
      };
    } catch (err) {
      console.warn("Tuulilukeman haku epäonnistui:", station.name, err);
      fmiWindFallbackStations.push(station);
    }
  }));

  if (fmiWindFallbackStations.length) {
    try {
      const fallbackValues = await fetchCurrentWindMulti(fmiWindFallbackStations);
      fmiWindFallbackStations.forEach(station => {
        const w = fallbackValues[station.id];
        if (w && w.speed != null && w.dir != null) {
          freshValues[station.fmisid] = w;
        }
      });
    } catch (err) {
      console.warn("Open-Meteo-varatuulen haku epäonnistui:", err);
    }
  }

  applyWindIcons(freshValues);
  savePreviewCache(WIND_ICON_CACHE_KEY, freshValues);

})();

// ==========================
// Ruotsin tuuliennustepisteiden ikonit (Open-Meteo, ei FMI-havaintoa)
// ==========================
// Näillä asemilla ei ole fmisidiä, joten ikoni haetaan koordinaatti-
// pohjaisesti Open-Meteon "current"-kentästä yhdellä yhteisellä
// kutsulla kaikille asemille kerralla. markerRegistry on tässä
// avaimena station.id (ks. rekisteröintikohta yllä).

const WIND_FC_ICON_CACHE_KEY = "windForecastIconCache";

function applyWindForecastIcons(values) {
  Object.entries(values).forEach(([id, w]) => {
    const marker = markerRegistry[id];
    if (!marker || w.speed == null || w.dir == null) return;
    marker.setIcon(createWindIcon(w.speed, w.dir, w.gust));
    marker.previewData = { wind: w.speed };
  });
}

const cachedWindFcIcons = loadPreviewCache(WIND_FC_ICON_CACHE_KEY, WIND_ICON_CACHE_TTL);
if (cachedWindFcIcons) applyWindForecastIcons(cachedWindFcIcons);

async function refreshWindForecastIcons() {

  const windFcStations = stations.filter(s => s.type === "wind-fc");
  if (!windFcStations.length) return;

  try {
    const values = await fetchCurrentWindMulti(windFcStations);
    applyWindForecastIcons(values);
    savePreviewCache(WIND_FC_ICON_CACHE_KEY, values);
  } catch (err) {
    console.warn("Ruotsin tuuliennusteikonien haku epäonnistui:", err);
  }

}

refreshWindForecastIcons();
setInterval(refreshWindForecastIcons, WIND_ICON_CACHE_TTL);

// ==========================
// Aaltopoijujen ikonit (oikeat havainnot)
// ==========================
// Poijudata päivittyy FMI:llä n. 10 min välein, joten haetaan
// tuoretta dataa samalla tahdilla. Ensin näytetään viimeksi
// tunnettu (välimuistitettu) lukema heti, sitten päivitetään.

const WAVE_ICON_CACHE_KEY = "waveBuoyIconCache";
const WAVE_ICON_CACHE_TTL = 10 * 60 * 1000;

function applyWaveIcons(values) {
  Object.entries(values).forEach(([fmisid, w]) => {
    const marker = markerRegistry[fmisid];
    if (!marker) return;
    marker.setIcon(createWaveIcon(w.height, w.direction, w.period));
    marker.previewData = w;
  });
}

const cachedWaveIcons = loadPreviewCache(WAVE_ICON_CACHE_KEY, WAVE_ICON_CACHE_TTL);
if (cachedWaveIcons) applyWaveIcons(cachedWaveIcons);

async function refreshWaveBuoyIcons() {

  const waveBuoyStations = stations.filter(s => s.type === "wavebuoy");
  const freshValues = {};

  await Promise.all(waveBuoyStations.map(async station => {
    try {
      const obs = await fetchWaveBuoyObservation(station.fmisid);
      if (!obs || obs.height == null) return;
      freshValues[station.fmisid] = obs;
    } catch (err) {
      console.warn("Aaltopoijun haku epäonnistui:", station.name, err);
    }
  }));

  applyWaveIcons(freshValues);
  savePreviewCache(WAVE_ICON_CACHE_KEY, freshValues);

}

refreshWaveBuoyIcons();
setInterval(refreshWaveBuoyIcons, WAVE_ICON_CACHE_TTL);

// ==========================
// FMI aikasarja (JSON TUETTU)
// ==========================
async function fetchTimeSeries(lat, lon, parameter) {
  const now = new Date();

  const start = new Date(now.getTime() - 6 * 3600_000).toISOString();
  const end   = now.toISOString(); // EI tulevaisuutta!

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::weather::timevaluepair",
    latlon: `${Number(lat)},${Number(lon)}`,
    parameters: parameter,
    starttime: start,
    endtime: end,
    timestep: "60",
    outputFormat: "application/json"
  });

  const url = `${FMI_WFS}?${params}`;
  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok || text.startsWith("<")) {
    console.error("FMI RAW RESPONSE:", text);
    return null;
  }

  return JSON.parse(text);
}



// cache näkyviin heti
loadCoastalPreviewCache(markerRegistry, createWindIcon);

// hae uusi data
updateCoastalPreview(
  stations,
  markerRegistry,
  createWindIcon
);

// päivitys 5 min välein
setInterval(() => {

  updateCoastalPreview(
    stations,
    markerRegistry,
    createWindIcon
  );

}, 300000);

// cache näkyviin heti, sitten tuore data
loadWeatherPreviewCache(markerRegistry);

updateWeatherPreview(
  stations,
  markerRegistry
);



// ==========================
// FMI TimeSeries REST API
// ==========================
async function fetchTimeSeriesREST(lat, lon, params) {
  const now = new Date();
  const past = new Date(now.getTime() - 12 * 3600_000).toISOString();
  const future = new Date(now.getTime() + 36 * 3600_000).toISOString();

  const urlParams = new URLSearchParams({
    latlon: `${Number(lat)},${Number(lon)}`,
    starttime: past,
    endtime: future,
    format: "json",
    ...params
  });

  const url = `https://opendata.fmi.fi/timeseries?${urlParams}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error("FMI REST fetch failed");

  return res.json();
}

// ==========================
// FMI ennuste (HARMONIE)
// ==========================
async function fetchForecastREST(lat, lon, params) {
  const now = new Date();
  const future = new Date(now.getTime() + 36 * 3600_000).toISOString();

  const urlParams = new URLSearchParams({
    latlon: `${Number(lat)},${Number(lon)}`,
    starttime: now.toISOString(),
    endtime: future,
    format: "json",
    source: "forecast",   // 🔴 TÄMÄ ON AVAIN
    ...params
  });

  const url = `https://opendata.fmi.fi/timeseries?${urlParams}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error("FMI forecast fetch failed");

  return res.json();
}



function splitPastFuture(values) {
  const mid = Math.floor(values.length / 2);
  return {
    past: values.slice(0, mid),
    future: values.slice(mid)
  };
}

function formatTimeLabel(isoString) {
  return new Date(isoString).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildHourlyLabels(count, endTimeISO) {
  const end = new Date(endTimeISO);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(end.getTime() - (count - 1 - i) * 3600_000);
    return d.toLocaleTimeString("fi-FI", {
      hour: "2-digit",
      minute: "2-digit"
    });
  });
}

function parseFmiUtc(s) {
  // "20260111T130000" → "2026-01-11T13:00:00Z"
  return new Date(
    s.slice(0, 4) + "-" +
    s.slice(4, 6) + "-" +
    s.slice(6, 8) + "T" +
    s.slice(9, 11) + ":" +
    s.slice(11, 13) + ":" +
    s.slice(13, 15) + "Z"
  );
}

function interpolateTimeSeries(points, stepMinutes = 30) {
  if (points.length < 2) return points;

  const result = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    result.push(p1);

    const dt = p2.x - p1.x;
    const steps = Math.floor(dt / (stepMinutes * 60_000));

    for (let s = 1; s < steps; s++) {
      const t = p1.x.getTime() + s * stepMinutes * 60_000;
      const ratio = (t - p1.x) / dt;

      result.push({
        x: new Date(t),
        y: p1.y + ratio * (p2.y - p1.y),
        _interpolated: true
      });
    }
  }

  result.push(points.at(-1));
  return result;
}


function getLatestObservation(data, timeKey, valueKey) {
  if (!Array.isArray(data)) return null;

  const now = Date.now();

  const past = data
    .map(d => ({
      t: parseFmiUtc(d[timeKey]),
      v: d[valueKey],
      raw: d
    }))
    .filter(p => p.t && p.t.getTime() <= now && p.v != null);

  if (!past.length) return null;

  return past.at(-1);
}

function getPressureTrend(data, minutes = 180) {
  const series = data.obsWindSpeed
    .map(d => ({
      t: new Date(d.utctime),
      v: d.pressurehpa
    }))
    .filter(p => p.v != null);

  if (series.length < 2) return null;

  const latest = series.at(-1);
  const cutoff = latest.t.getTime() - minutes * 60_000;

  const past = [...series]
    .reverse()
    .find(p => p.t.getTime() <= cutoff);

  if (!past) return null;

  const diff = latest.v - past.v;

  if (diff > 1) return "up";
  if (diff < -1) return "down";
  return "steady";
}

function getMarkerStyle(type) {

  switch (type) {

    case "weather":
      return {
        radius: 7,
        color: "#0c6d07",
        fillColor: "#0c6d07",
        fillOpacity: 0.9,
        weight: 1
      };

    case "sealevel":
      return {
        radius: 5,
        color: "#cc7306",
        fillColor: "#cc7306",
        fillOpacity: 0.9,
        weight: 1
      };

    case "coastal":
      return {
        radius: 6,
        color: "#2133d6",
        fillColor: "#2133d6",
        fillOpacity: 0.9,
        weight: 1
      };

    default:
      return {
        radius: 6,
        color: "#999",
        fillColor: "#999",
        fillOpacity: 0.8,
        weight: 1
      };
  }
}


function createWindIcon(speed, dir, gust = null) {

  const roundedSpeed = Math.round(speed);
  const roundedGust =
    Number.isFinite(gust) ? Math.round(gust) : null;

  const color =
    roundedSpeed < 5  ? "#028b09" :
    roundedSpeed < 10 ? "#025981" :
    roundedSpeed < 15 ? "#b67e06" :
                        "#E53935";

  const speedLabel = roundedGust != null
    ? `${roundedSpeed} m/s (${roundedGust})`
    : `${roundedSpeed} m/s`;

  const speedTitle = roundedGust != null
    ? `Tuuli ${roundedSpeed} m/s, puuska ${roundedGust} m/s`
    : `Tuuli ${roundedSpeed} m/s`;

const html = `
  <div class="wind-marker">

    <!-- NUOLI -->
    <div class="marker-arrow"
         style="transform: translate(4px,4px) rotate(${dir + 180}deg); color: ${color}">
      <svg viewBox="0 0 24 24" width="55" height="55">
        <path d="M12 1 L18 11 L14 11 L14 21 L10 21 L10 11 L6 11 Z"
              fill="currentColor"/>
      </svg>
    </div>

    <!-- NOPEUS -->
    <div class="marker-speed" style="border-color:${color}" title="${speedTitle}">${speedLabel}</div>

  </div>
`;

  return L.divIcon({
    className: "wind-marker-wrapper",
    html,
    iconSize: [80, 80],
    iconAnchor: [40, 40]
  });
}



// ==========================
// Popup → lämpötila + tuuli (havainto + ennuste)
// ==========================

map.on("popupopen", async e => {

  const popupEl = e.popup.getElement();
  if (!popupEl) return;

  // Varmistetaan että popup mahtuu näytölle myös pienillä näytöillä
  // (esim. kannettava tietokone): rajataan popupin korkeus ikkunan
  // korkeuden mukaan ja tehdään sisällöstä scrollattava, jotta popupin
  // ylä- tai alareuna (mm. sulkupainike) ei jää piiloon.
  const maxPopupHeight = Math.max(240, window.innerHeight - 100);
  e.popup.options.maxHeight = maxPopupHeight;
  e.popup.options.autoPan = true;
  e.popup.options.autoPanPadding = [20, 20];
  e.popup.update();

  const station = e.popup._source.station;
  if (!station) return;

  // ==========================
  // Aaltopoiju → kevyt havaintopopup
  // ==========================
  if (station.type === "wavebuoy") {
    await renderWaveBuoyPopup(e.popup, station);
    return;
  }

  // ==========================
  // Ruotsin tuuliennustepiste → pelkkä tuulivirtausanimaatio,
  // ei FMI-dataa (ei fmisidiä)
  // ==========================
  if (station.type === "wind-fc") {
    stopStationDetail = await renderOpenMeteoWindPopup(popupEl, station);
    return;
  }

  const canvases = popupEl.querySelectorAll("canvas");
  if (!canvases.length) return;

  // Sisällön täyttö (havainnot, ennusteet, tuulivirtausanimaatio ym.)
  // on jaettu js/popup/stationDetail.js:ään, jotta samaa logiikkaa
  // voidaan käyttää myös mobiilinäkymän asemakortissa.
  const { data, stop } = await renderStationDetail(popupEl, station);

  stopStationDetail = stop;

  if (data) {
    const marker = e.popup._source;
    marker.previewData = {
      temp: data.obsTemp?.at(-1)?.temperature ?? null,
      wind: data.obsWindSpeed?.at(-1)?.windspeedms ?? null,
      sea: data.seaLevel ?? null
    };
  }

});

// Pysäytä tuulivirtausanimaatio kun popup suljetaan,
// ettei se jää pyörimään taustalle turhaan.
map.on("popupclose", () => {
  if (stopStationDetail) {
    stopStationDetail();
    stopStationDetail = null;
  }
});


