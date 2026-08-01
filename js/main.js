import { loadPopupData, fetchObservationSeriesByFmisid } from "./api/dataLoader.js";
import { updatePopupTitles } from "./popup/popupTitles.js";
import { renderTemperatureChart } from "./charts/temperatureChart.js";
import { renderWindCharts } from "./charts/windChart.js";
import { renderPopupExtras, renderSunCard } from "./popup/popupExtras.js";
import "./charts/plugins.js";
import { fetchSeaLevel } from "./api/sealevel.js";
import { updateCoastalPreview, loadCoastalPreviewCache} from "./api/coastalPreview.js";
import { updateWeatherPreview, loadWeatherPreviewCache } from "./api/weatherPreview.js";
import { getCurrentSymbol } from "./charts/plugins/weatherSymbols.js";
import { fetchWindGridSeries } from "./api/openMeteoWind.js";
import { renderWindFlow } from "./charts/windFlow.js";
import { drawMapBackground } from "./charts/miniMapBackground.js";
import { loadPreviewCache, savePreviewCache } from "./utils/previewCache.js";
import { initMarineInfoPanels } from "./marineInfoPanels.js";


"use strict";

const map = L.map("map").setView([60, 25], 6);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

// 👉 LISÄÄ TÄMÄ TÄHÄN
const bounds = L.latLngBounds(
  [58.8, 18.8],  // SW
  [63.5, 27.8]   // NE
);

map.fitBounds(bounds, {
  padding: [20, 20]
});

// Säätiedotus merenkulkijoille + Varoitukset -infopaneelit
// (avattava/piilotettava, sisältö ladataan vasta avattaessa)
initMarineInfoPanels();

const FMI_WFS = "https://opendata.fmi.fi/wfs";


// ==========================
// Layerit
// ==========================


const weatherLayer = L.featureGroup().addTo(map);
const coastalLayer = L.featureGroup().addTo(map);

const markerRegistry = {};

// Käynnissä olevan tuulivirtausanimaation pysäytysfunktio
// (yksi kerrallaan – uusi popup pysäyttää edellisen).
let stopWindFlow = null;


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

  // weather
  return L.divIcon({
    className: "station-dot",
    html: `<div class="dot dot-weather"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });

}

// ==========================
// Asemat kartalle
// ==========================


stations.forEach(station => {

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

  markerRegistry[station.fmisid] = marker;
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

    this.setTooltipContent(content);
    this.openTooltip();
  });

  marker.on("mouseout", function () {
    this.closeTooltip();
  });

  marker.bindPopup(`
    <div class="popup-title">${station.name}</div>
    <div class="popup-extras"></div>

    <div class="popup-note">
      ℹ️ Graafit perustuvat Ilmatieteen laitoksen dataan, tuuliennusteanimaatio Open-Meteon (MET Nordic) malliin. Eri ennustemallien vuoksi tuulilukemat voivat poiketa hieman toisistaan.
    </div>

    <div class="popup-card">
      <div><strong>Tuuli (havainto)</strong></div>
      <canvas
        class="popup-chart"
        width="650"
        height="140"
        data-lat="${station.lat}"
        data-lon="${station.lon}"
        data-fmisid="${station.fmisid}"
        data-type="wind-obs"
      ></canvas>
    </div>

    <div class="popup-card">
      <div><strong>Tuuli (ennuste)</strong></div>
      <canvas
        class="popup-chart"
        width="650"
        height="140"
        data-lat="${station.lat}"
        data-lon="${station.lon}"
        data-fmisid="${station.fmisid}"
        data-type="wind-fc"
      ></canvas>
    </div>

    <div class="popup-card">
      <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
        <strong>Tuuliennusteanimaatio</strong>
        <span class="wind-flow-speed-label" style="font-size:12px; color:#444;"></span>
      </div>
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <div class="wind-flow-wrapper" style="position:relative; width:320px; height:320px; flex-shrink:0;">
          <canvas
            class="wind-flow-bg"
            width="320"
            height="320"
            style="position:absolute; top:0; left:0;"
          ></canvas>
          <canvas
            class="wind-flow-canvas"
            width="320"
            height="320"
            style="position:absolute; top:0; left:0;"
            data-lat="${station.lat}"
            data-lon="${station.lon}"
          ></canvas>
        </div>
        <div class="wind-flow-sidebar" style="display:flex; flex-direction:column; gap:8px; width:320px;">
          <div class="popup-card-inner">
            <div style="font-size:12px; font-weight:600; margin-bottom:4px;">Lämpötila</div>
            <canvas
              class="popup-chart-mini"
              width="300"
              height="110"
              data-lat="${station.lat}"
              data-lon="${station.lon}"
              data-fmisid="${station.fmisid}"
              data-type="temp"
            ></canvas>
          </div>

          <div class="popup-card-inner">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Vedenkorkeus</div>
            <div class="wind-flow-sealevel-row">
              <span class="wind-flow-sealevel-label">Keskivesi</span>
              <span class="wind-flow-sealevel-value" data-kind="watlev">–</span>
            </div>
            <div class="wind-flow-sealevel-row">
              <span class="wind-flow-sealevel-label">N2000</span>
              <span class="wind-flow-sealevel-value" data-kind="n2000">–</span>
            </div>
          </div>

          <div class="popup-card-inner popup-sun-card" style="display:none;">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Aurinko</div>
            <div class="popup-sun-row">
              <div class="popup-inline-item">
                <img src="./js/assets/icons/sunrise.svg" class="popup-icon" alt="Auringonnousu">
                <span class="popup-sunrise-value">–</span>
              </div>
              <div class="popup-inline-item">
                <img src="./js/assets/icons/sunset.svg" class="popup-icon" alt="Auringonlasku">
                <span class="popup-sunset-value">–</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px; margin-top:8px; width:320px;">
        <input
          type="range"
          class="wind-flow-slider"
          min="0"
          max="0"
          step="1"
          value="0"
          style="flex:1;"
        >
        <span class="wind-flow-time-label" style="font-size:12px; color:#444; min-width:78px; text-align:right;">Nyt</span>
      </div>
      <div style="display:flex; gap:8px; width:320px;">
        <div class="wind-flow-ticks" style="display:flex; justify-content:space-between; flex:1;"></div>
        <div style="min-width:78px;"></div>
      </div>

      <div class="wind-flow-controls">
        <button type="button" class="wind-flow-btn" data-offset="2">💨 2h</button>
        <button type="button" class="wind-flow-btn" data-offset="6">💨 6h</button>
        <button type="button" class="wind-flow-btn" data-offset="12">💨 12h</button>
        <button type="button" class="wind-flow-btn" data-offset="18">💨 18h</button>
        <button type="button" class="wind-flow-btn" data-offset="24">💨 24h</button>
        <button type="button" class="wind-flow-btn wind-flow-btn-last" data-offset="24">💨 …</button>
      </div>
    </div>

  `);

  // Lisää oikeaan layeriin
  if (station.type === "weather") {
    weatherLayer.addLayer(marker);
  }

  if (station.type === "coastal") {
    coastalLayer.addLayer(marker);
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

  await Promise.all(windIconStations.map(async station => {
    try {
      const series = await fetchObservationSeriesByFmisid(station.fmisid);

      const latest = [...series].reverse().find(
        p => p.windspeedms != null && p.winddirection != null
      );
      if (!latest) return;

      freshValues[station.fmisid] = {
        speed: latest.windspeedms,
        dir: latest.winddirection,
        gust: latest.windgust
      };
    } catch (err) {
      console.warn("Tuulilukeman haku epäonnistui:", station.name, err);
    }
  }));

  applyWindIcons(freshValues);
  savePreviewCache(WIND_ICON_CACHE_KEY, freshValues);

})();

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

// Lähin vedenkorkeusasema annetulle pisteelle (yksinkertainen
// asteperusteinen etäisyys riittää tälle mittakaavalle).
function findNearestSeaLevelStation(lat, lon) {

  let nearest = null;
  let minDist = Infinity;

  for (const s of stations) {
    if (s.type !== "sealevel") continue;

    const dLat = s.lat - lat;
    const dLon = s.lon - lon;
    const dist = dLat * dLat + dLon * dLon;

    if (dist < minDist) {
      minDist = dist;
      nearest = s;
    }
  }

  return nearest;
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
    ? `${roundedSpeed}/${roundedGust}`
    : `${roundedSpeed}`;

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

  // 🔑 1. Ota feature.properties ENSIN
const station = e.popup._source.station;
if (!station) return;

// ==========================
// Weather → Yr meteogram (iframe)
// ==========================

if (station.type === "weather" && station.yr) {

  const popup = e.popup;

  const html = `
    <div class="yr-popup">
      <iframe
        src="${station.yr}"
        width="650"
        height="360"
        frameborder="0"
        style="border:0;display:block;"
        loading="lazy">
      </iframe>
    </div>
  `;

  popup.setContent(html);
  popup.update();

  return;
}

  const canvases = popupEl.querySelectorAll("canvas");
  if (!canvases.length) return;


  // 🔑 2. Lat/lon edelleen canvasista (ok)
  const lat = canvases[0].dataset.lat;
  const lon = canvases[0].dataset.lon;

  // 🔑 3. Ota FMISID:t propertiesista (EI canvasista)
  const weatherFmisid = station.fmisid ?? null;

  const seaLevelFmisid =
  station.type === "sealevel" ? station.fmisid : null;


  try {
    // 🔑 4. Kutsu loadPopupDataa UUDESSA muodossa
    const data = await loadPopupData({
      lat: station.lat,
      lon: station.lon,
      weatherPlace: null,
      weatherFmisid: station.fmisid,
      seaLevelFmisid: null
    });
    console.log("STATION FMISID:", station.fmisid);
    console.log("marker symbol", data.currentSymbol);




    updatePopupTitles(popupEl, data);
    renderPopupExtras(popupEl, data);
    renderSunCard(popupEl, data);
    renderTemperatureChart(popupEl, data);
    renderWindCharts(popupEl, data);

    // Lähimmän vedenkorkeusaseman lukemat sivupalkkiin
    // (sekä keskiveteen suhteutettu WATLEV että N2000-lukema).
    const seaLevelWatlevEl = popupEl.querySelector('.wind-flow-sealevel-value[data-kind="watlev"]');
    const seaLevelN2000El = popupEl.querySelector('.wind-flow-sealevel-value[data-kind="n2000"]');

    if (seaLevelWatlevEl || seaLevelN2000El) {
      const nearestSea = findNearestSeaLevelStation(station.lat, station.lon);
      const formatLevel = v => v != null ? `${v > 0 ? "+" : ""}${v} cm` : "–";

      if (!nearestSea) {
        if (seaLevelWatlevEl) seaLevelWatlevEl.textContent = "–";
        if (seaLevelN2000El) seaLevelN2000El.textContent = "–";
      } else {
        try {
          const { watlev, n2000 } = await fetchSeaLevel(nearestSea.fmisid);
          if (seaLevelWatlevEl) {
            seaLevelWatlevEl.textContent = `${formatLevel(watlev)} (${nearestSea.name})`;
          }
          if (seaLevelN2000El) {
            seaLevelN2000El.textContent = `${formatLevel(n2000)} (${nearestSea.name})`;
          }
        } catch (err) {
          if (seaLevelWatlevEl) seaLevelWatlevEl.textContent = `– (${nearestSea.name})`;
          if (seaLevelN2000El) seaLevelN2000El.textContent = `– (${nearestSea.name})`;
        }
      }
    }

    // Tuulen virtaus (Open-Meteo, animoitu hiukkaskenttä) + napit/liukusäädin
    const flowCanvas = popupEl.querySelector(".wind-flow-canvas");
    const flowBgCanvas = popupEl.querySelector(".wind-flow-bg");
    const flowButtons = popupEl.querySelectorAll(".wind-flow-btn");
    const flowSlider = popupEl.querySelector(".wind-flow-slider");
    const flowTimeLabel = popupEl.querySelector(".wind-flow-time-label");
    const flowTicksEl = popupEl.querySelector(".wind-flow-ticks");
    const flowSpeedLabel = popupEl.querySelector(".wind-flow-speed-label");

    let windSeriesData = null;

    function renderFlowTicks(maxIdx) {
      if (!flowTicksEl) return;

      const tickCount = maxIdx >= 4 ? 5 : maxIdx + 1;
      const ticks = [];

      for (let i = 0; i < tickCount; i++) {
        ticks.push(Math.round((maxIdx * i) / (tickCount - 1)));
      }

      flowTicksEl.innerHTML = ticks
        .map(h => `<span>${h === 0 ? "nyt" : h + "h"}</span>`)
        .join("");
    }

    function showWindFlowOffset(offsetHours) {

      if (!windSeriesData || !windSeriesData.series.length) return;

      const idx = Math.max(
        0,
        Math.min(windSeriesData.series.length - 1, offsetHours)
      );

      if (stopWindFlow) {
        stopWindFlow();
        stopWindFlow = null;
      }

      stopWindFlow = renderWindFlow(flowCanvas, {
        grid: windSeriesData.series[idx],
        size: windSeriesData.size
      });

      flowButtons.forEach(btn => {
        btn.classList.toggle("active", Number(btn.dataset.offset) === idx);
      });

      if (flowSlider) flowSlider.value = idx;

      if (flowTimeLabel) {
        const hourDate = windSeriesData.hours[idx];
        flowTimeLabel.textContent = idx === 0
          ? "Nyt"
          : `+${idx}h (${hourDate.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })})`;
      }

      if (flowSpeedLabel) {
        const wind = windSeriesData.stationWind?.[idx];
        if (wind && wind.speed != null) {
          const speedTxt = wind.speed.toFixed(1);
          const gustTxt = wind.gust != null ? `, puuskat ${wind.gust.toFixed(1)} m/s` : "";
          flowSpeedLabel.textContent = `💨 ${speedTxt} m/s${gustTxt}`;
        } else {
          flowSpeedLabel.textContent = "";
        }
      }
    }

    flowButtons.forEach(btn => {
      btn.onclick = () => showWindFlowOffset(Number(btn.dataset.offset));
    });

    if (flowSlider) {
      flowSlider.oninput = () => showWindFlowOffset(Number(flowSlider.value));
    }

    if (flowCanvas) {
      try {
        windSeriesData = await fetchWindGridSeries(station.lat, station.lon);

        if (flowBgCanvas) {
          drawMapBackground(flowBgCanvas, windSeriesData.bounds).catch(err => {
            console.warn("Karttataustan lataus epäonnistui:", err);
          });
        }

        const maxIdx = windSeriesData.series.length - 1;

        if (flowSlider) {
          flowSlider.max = maxIdx;
        }

        renderFlowTicks(maxIdx);

        // "Viimeisin ennuste" -nappi osoittaa aina sarjan viimeiseen
        // saatavilla olevaan tuntiin (yleensä ~36-47h, riippuu kellonajasta).
        const lastBtn = popupEl.querySelector(".wind-flow-btn-last");
        if (lastBtn) {
          lastBtn.dataset.offset = maxIdx;
          lastBtn.textContent = `💨 ${maxIdx}h (viimeisin)`;
        }

        showWindFlowOffset(0);

      } catch (err) {
        console.warn("Tuulivirtauksen haku epäonnistui:", err);
      }
    }

     const marker = e.popup._source;

    // hae latest helperilla tai suoraan arrayn lopusta
  marker.previewData = {
  temp: data.obsTemp?.at(-1)?.temperature ?? null,
  wind: data.obsWindSpeed?.at(-1)?.windspeedms ?? null,
  sea: data.seaLevel ?? null
  };

} catch (err) {
  console.error("Popup error:", err);
}

});

// Pysäytä tuulivirtausanimaatio kun popup suljetaan,
// ettei se jää pyörimään taustalle turhaan.
map.on("popupclose", () => {
  if (stopWindFlow) {
    stopWindFlow();
    stopWindFlow = null;
  }
});


