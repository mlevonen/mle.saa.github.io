// ==========================
// "Vedenlämpö"-nappi – näyttää/piilottaa kartalla pallomerkit
// vedenlämpöpisteistä, JOILLA EI ole omaa havaintoasemaa sivustolla
// (ks. js/api/waterTempPoints.js: SYKE:n sisävesiasemat + pk-seudun
// UiRaS-uimapaikat, molemmista suodatettu pois sivuston omien
// asemien läheisyydessä olevat pisteet).
//
// Nappi on TAVALLINEN HTML-painike index.html:n .info-panels-
// säiliössä (id="watertemp-toggle-btn"), heti Säätiedotus-napin alla
// – EI enää oma Leaflet-kontrollinsa kartan kulmassa. Tämä pitää
// napin automaattisesti oikealla paikalla (ja oikeassa kohdassa myös
// silloin kun Säätiedotus-paneeli avataan/sulkeutuu, koska
// .info-panels on flexbox-pino) ilman erillistä koordinointia.
//
// Piilossa oletuksena ja togglataan yhdellä napilla (ei erillistä
// pudotuspaneelia kuten Taustakartta/Käyttöoikeudet/Muutokset-napeissa)
// – käyttäjän oma toive oli nimenomaan yksinkertainen päälle/pois-nappi,
// koska KAIKKIEN vedenlämpöjen näyttäminen kerralla tekisi kartasta
// sekavan, jos se olisi aina päällä.
//
// Pallot rakennetaan L.divIcon-merkkeinä (väri = waterTempColor(),
// sama asteikko kuin asemakorttien Veden lämpötila -kortissa) ja
// pidetään omassa L.layerGroupissa, jotta koko joukon voi lisätä/
// poistaa kartalta yhdellä kertaa ilman, että pitää muistaa yksittäisiä
// markereita.
// ==========================

import { fetchWaterTempPoints } from "./api/waterTempPoints.js";
import { waterTempColor } from "./popup/seaLevelCard.js";
import { findNearestSeaLevelStation, fetchSeaLevel } from "./api/sealevel.js";

function formatTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("fi-FI", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sourceLabel(source) {
  return source === "uiras"
    ? "Helsingin kaupunki / Forum Virium Helsinki (UiRaS-avoin data)"
    : "Suomen ympäristökeskus (SYKE), Hydrologiarajapinta";
}

function pointPopupHTML(point) {
  const time = formatTime(point.time);
  return `
    <div class="watertemp-popup">
      <div class="watertemp-popup-title">${point.name}</div>
      <div class="watertemp-popup-value">${point.temp.toFixed(1)} °C</div>
      ${time ? `<div class="watertemp-popup-time">Havaittu: ${time}</div>` : ""}
      <div class="watertemp-popup-source">Lähde: ${sourceLabel(point.source)}</div>
    </div>
  `;
}

function createPointMarker(point) {

  const rounded = Math.round(point.temp);

  const icon = L.divIcon({
    className: "watertemp-marker",
    html: `<div class="watertemp-marker-circle" style="background:${waterTempColor(point.temp)}">${rounded}°</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
  });

  return L.marker([point.lat, point.lon], { icon })
    .bindPopup(pointPopupHTML(point));

}

// ==========================
// Pienet "lämpöpallot" jo olemassa olevien rannikon havaintoasemien
// viereen (ei niiden PÄÄLLE, ettei peitä tuuli-ikonia). Käyttää samaa
// "lähin vedenkorkeusasema" -logiikkaa ja samaa fetchSeaLevel()-kutsua
// kuin popupin Veden lämpötila -kortti (ks. js/popup/seaLevelCard.js),
// jotta luku on aina sama kuin mitä käyttäjä näkisi avaamalla popupin.
// Monella rannikkoasemalla on sama lähin vedenkorkeusasema, joten
// verkkopyynnöt tehdään vain kertaalleen per uniikki fmisid.
// ==========================

function createStationBadgeMarker(station, temp) {

  const rounded = Math.round(temp);

  const icon = L.divIcon({
    className: "watertemp-marker watertemp-station-badge",
    html: `<div class="watertemp-marker-circle watertemp-marker-circle-small" style="background:${waterTempColor(temp)}">${rounded}°</div>`,
    iconSize: [26, 26],
    // Siirretään pallo havaintoaseman tuuli-ikonin (80x80, ankkuroitu
    // keskelle) oikeaan yläkulmaan nähden, jotta se näkyy selvästi
    // "vieressä" eikä peitä tuulinuolta/-lukemaa.
    iconAnchor: [-28, 26],
    popupAnchor: [0, -13]
  });

  return L.marker([station.lat, station.lon], { icon, zIndexOffset: 500 })
    .bindPopup(stationBadgePopupHTML(station, temp));
}

function stationBadgePopupHTML(station, temp) {
  const nearestSea = findNearestSeaLevelStation(station.lat, station.lon);
  return `
    <div class="watertemp-popup">
      <div class="watertemp-popup-title">${station.name}</div>
      <div class="watertemp-popup-value">${temp.toFixed(1)} °C</div>
      ${nearestSea ? `<div class="watertemp-popup-source">Lähin havaintoasema: ${nearestSea.name}</div>` : ""}
    </div>
  `;
}

async function fetchCoastalStationWaterTemps() {

  const coastalStations = stations.filter(s => s.type === "coastal");

  // Kerää uniikit lähimmät vedenkorkeusasemat (monella rannikkoasemalla
  // sama lähin asema), jotta jokaista fmisidiä kysytään vain kerran.
  const nearestByStation = new Map(); // station -> nearestSea (tai null)
  const uniqueFmisids = new Map(); // fmisid -> nearestSea

  coastalStations.forEach(station => {
    const nearestSea = findNearestSeaLevelStation(station.lat, station.lon);
    nearestByStation.set(station, nearestSea);
    if (nearestSea && !uniqueFmisids.has(nearestSea.fmisid)) {
      uniqueFmisids.set(nearestSea.fmisid, nearestSea);
    }
  });

  const tempByFmisid = new Map();

  await Promise.all(
    Array.from(uniqueFmisids.keys()).map(async fmisid => {
      try {
        const { waterTemp } = await fetchSeaLevel(fmisid);
        if (Number.isFinite(waterTemp)) tempByFmisid.set(fmisid, waterTemp);
      } catch (err) {
        console.warn("Rannikkoaseman vedenlämmön haku epäonnistui (fmisid " + fmisid + "):", err);
      }
    })
  );

  const results = [];
  nearestByStation.forEach((nearestSea, station) => {
    if (!nearestSea) return;
    const temp = tempByFmisid.get(nearestSea.fmisid);
    if (Number.isFinite(temp)) results.push({ station, temp });
  });

  return results;
}

export function initWaterTempPointsControl(map) {

  const toggleBtn = document.getElementById("watertemp-toggle-btn");
  if (!toggleBtn) return;

  toggleBtn.title = "Näytä/piilota vedenlämpöpisteet kartalla";

  const layerGroup = L.layerGroup();
  let loaded = false;
  let visible = false;

  async function showPoints() {

    toggleBtn.classList.add("loading");

    try {

      if (!loaded) {
        const [points, stationTemps] = await Promise.all([
          fetchWaterTempPoints(),
          fetchCoastalStationWaterTemps()
        ]);

        points.forEach(p => layerGroup.addLayer(createPointMarker(p)));
        stationTemps.forEach(({ station, temp }) =>
          layerGroup.addLayer(createStationBadgeMarker(station, temp))
        );

        loaded = true;
      }

      layerGroup.addTo(map);
      visible = true;
      toggleBtn.classList.add("active");

    } catch (err) {
      console.warn("Vedenlämpöpisteiden näyttäminen epäonnistui:", err);
    } finally {
      toggleBtn.classList.remove("loading");
    }

  }

  function hidePoints() {
    map.removeLayer(layerGroup);
    visible = false;
    toggleBtn.classList.remove("active");
  }

  toggleBtn.addEventListener("click", () => {
    if (visible) {
      hidePoints();
    } else {
      showPoints();
    }
  });

}
