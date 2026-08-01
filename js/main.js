import { loadPopupData } from "./api/dataLoader.js";
import { updatePopupTitles } from "./popup/popupTitles.js";
import { renderTemperatureChart } from "./charts/temperatureChart.js";
import { renderWindCharts } from "./charts/windChart.js";
import { renderPopupExtras } from "./popup/popupExtras.js";
import "./charts/plugins.js";
import { fetchSeaLevel, fetchSeaLevelSeries, fetchSeaLevelForecast } from "./api/sealevel.js";
import { fetchSeaLevelMulti } from "./api/sealevel.js";
import { updateCoastalPreview, loadCoastalPreviewCache} from "./api/coastalPreview.js";
import { updateWeatherPreview } from "./api/weatherPreview.js";
import { getCurrentSymbol } from "./charts/plugins/weatherSymbols.js";
import { fetchWindGridSeries } from "./api/openMeteoWind.js";
import { renderWindFlow } from "./charts/windFlow.js";
import { drawMapBackground } from "./charts/miniMapBackground.js";


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

const FMI_WFS = "https://opendata.fmi.fi/wfs";


// ==========================
// Layerit
// ==========================


const weatherLayer = L.featureGroup().addTo(map);
const seaLevelLayer = L.featureGroup(); // EI oletuksena kartalla
const coastalLayer = L.featureGroup().addTo(map);

const markerRegistry = {};

// Käynnissä olevan tuulivirtausanimaation pysäytysfunktio
// (yksi kerrallaan – uusi popup pysäyttää edellisen).
let stopWindFlow = null;

// "Valeoverlay": ei lisää mitään karttaan, vain kytkee CSS-luokan
// päälle/pois kartan säiliöstä, jolloin markereiden sääsymbolit
// voidaan piilottaa/näyttää valintalaatikolla.
const WeatherSymbolToggle = L.Layer.extend({
  onAdd(map) {
    map.getContainer().classList.add("show-weather-symbols");
  },
  onRemove(map) {
    map.getContainer().classList.remove("show-weather-symbols");
  }
});
const weatherSymbolLayer = new WeatherSymbolToggle();

L.control.layers(null, {
  "🌤 Sääasemat": weatherLayer,
  "🌊 Vedenkorkeusasemat": seaLevelLayer,
  "⚓ Rannikkoasemat": coastalLayer,
  "☀️ Sääsymbolit": weatherSymbolLayer
}, { collapsed: false }).addTo(map);


//IKONIFUNKTIOT

function createStationIcon(station, level = null) {

  if (station.type === "sealevel") {

  let arrow = "";
  let value = "";
  let color = "#6e6e6e"; // neutraali

  if (level != null) {

    if (level > 0) arrow = "▲";
    else if (level < 0) arrow = "▼";
    else arrow = "●";

    value = Math.round(level);

    // värit
    if (level > 30) color = "#d73027";      // korkea vesi
    else if (level < -30) color = "#2b6cb0"; // matala vesi
  }

  return L.divIcon({
    className: "station-sealevel",
    html: `
      <div class="sealevel-marker">
        <div class="sealevel-arrow" style="color:${color}">
          ${arrow}
        </div>
        <div class="sealevel-value">${value}</div>
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -23]
  });
  }

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

    else if (station.type === "sealevel" && preview.sea != null) {
      const sign = preview.sea > 0 ? "+" : "";
      content += `<br>${sign}${preview.sea} cm`;
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

    <div><strong>Lämpötila</strong></div>
    <canvas
      class="popup-chart"
      width="650"
      height="160"
      data-lat="${station.lat}"
      data-lon="${station.lon}"
      data-fmisid="${station.fmisid}"
      data-type="temp"
    ></canvas>

      <div style="margin-top:8px;"><strong>Tuuli (havainto)</strong></div>
      <canvas
      class="popup-chart"
      width="650"
      height="140"
      data-lat="${station.lat}"
      data-lon="${station.lon}"
      data-fmisid="${station.fmisid}"
      data-type="wind-obs"
    ></canvas>

    <div style="margin-top:8px;"><strong>Tuuli (ennuste)</strong></div>
    <canvas
    class="popup-chart"
    width="650"
    height="140"
    data-lat="${station.lat}"
    data-lon="${station.lon}"
    data-fmisid="${station.fmisid}"
    data-type="wind-fc"
    ></canvas>

    <div style="margin-top:8px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
      <strong>Tuulen virtaus (lähialue)</strong>
      <div class="wind-flow-controls">
        <button type="button" class="wind-flow-btn" data-offset="0">Nyt</button>
        <button type="button" class="wind-flow-btn" data-offset="6">+6h</button>
        <button type="button" class="wind-flow-btn" data-offset="12">+12h</button>
        <button type="button" class="wind-flow-btn" data-offset="24">+24h</button>
      </div>
    </div>
    <div class="wind-flow-wrapper" style="position:relative; width:320px; height:320px;">
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
    <div style="display:flex; align-items:center; gap:8px; margin-top:6px; width:320px;">
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

  `);

  // Lisää oikeaan layeriin
  if (station.type === "weather") {
    weatherLayer.addLayer(marker);
  }

  if (station.type === "sealevel") {
    seaLevelLayer.addLayer(marker);
  }

  if (station.type === "coastal") {
    coastalLayer.addLayer(marker);
  }
 });

stations.forEach(async (station) => {

  const data = await loadPopupData({
    lat: station.lat,
    lon: station.lon,
    weatherPlace: null,
    weatherFmisid: station.fmisid,
    seaLevelFmisid: null
  });

  const latestWind = data.obsWindSpeed?.at(-1);
  if (!latestWind) return;

  const icon = createWindIcon(
    latestWind.windspeedms,
    latestWind.winddirection,
    data.symbolNow
      ? `/js/assets/weather-icons/SmartSymbol/${data.symbolNow}.svg`
      : null,
    latestWind.windgust
  );

  const marker = markerRegistry[station.fmisid];
  if (!marker) return;

  marker.setIcon(icon);

});

// ==========================
// Sealevel marker päivitys
// ==========================

async function updateSeaLevelMarkers() {

  const seaStations = stations.filter(
    s => s.type === "sealevel"
  );

  const requests = seaStations.map(async station => {

    try {

      const level = await fetchSeaLevel(station.fmisid);

      const marker = markerRegistry[station.fmisid];
      if (!marker) return;

      marker.previewData = marker.previewData || {};
      marker.previewData.sea = level;

      marker.setIcon(
        createStationIcon(station, level)
      );



    } catch (err) {

      console.warn(
        "Sea level update failed",
        station.name
      );

    }

  });

  await Promise.all(requests);
}

// ==========================
// KÄYNNISTYS
// ==========================

updateSeaLevelMarkers();
setInterval(updateSeaLevelMarkers, 900000);

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


function createWindIcon(speed, dir, symbolUrl, gust = null) {

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

  // Ei näytetä ikonia lainkaan jos symbolia ei ole saatavilla
  // (ei "pilvi + N/A" -oletuskuvaketta)
  const weatherIconHtml = symbolUrl
    ? `<div class="weather-icon-wrapper">
        <img class="marker-weather-icon" src="${symbolUrl}">
      </div>`
    : "";

const html = `
  <div class="wind-marker">

    <!-- SÄÄIKONI -->
    ${weatherIconHtml}

    <!-- NUOLI (nyt viimeisenä) -->
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

  if (station.type === "sealevel") {
  renderSeaLevelPopup(e.popup, station);
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
    renderTemperatureChart(popupEl, data);
    renderWindCharts(popupEl, data);

    // Tuulen virtaus (Open-Meteo, animoitu hiukkaskenttä) + napit/liukusäädin
    const flowCanvas = popupEl.querySelector(".wind-flow-canvas");
    const flowBgCanvas = popupEl.querySelector(".wind-flow-bg");
    const flowButtons = popupEl.querySelectorAll(".wind-flow-btn");
    const flowSlider = popupEl.querySelector(".wind-flow-slider");
    const flowTimeLabel = popupEl.querySelector(".wind-flow-time-label");

    let windSeriesData = null;

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

        if (flowSlider) {
          flowSlider.max = windSeriesData.series.length - 1;
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


async function renderSeaLevelPopup(popup, station) {

  const popupEl = popup.getElement();
  if (!popupEl) return;

  const contentEl = popupEl.querySelector(".leaflet-popup-content");
  if (!contentEl) return;

  const series = await fetchSeaLevelSeries(station.fmisid);
  const forecastData = await fetchSeaLevelForecast(station.fmisid);

  //OTSIKKOINFOT
  const latestLevel =
  series.waterLevel.at(-1)?.value ?? null;

  const latestTemp =
  series.waterTemp.at(-1)?.value ?? null;
  
  contentEl.innerHTML = `
  <div style="width:500px;">

    <h3 style="margin-top:0;">${station.name}</h3>
    
    <div style="
      display:flex;
      gap:16px;
      align-items:center;
      font-size:15px;
      margin-bottom:14px;
    ">
    <span style="display:flex; align-items:center; gap:6px;">
      <img src="/js/assets/icons/sealevel.svg"
          style="width:18px; height:18px;">
      ${latestLevel !== null ? latestLevel + " cm" : "–"}
    </span>

    <span style="display:flex; align-items:center; gap:6px;">
      <img src="/js/assets/icons/temp2.svg"
          style="width:18px; height:18px;">
      ${latestTemp !== null ? latestTemp + " °C" : "–"}
    </span>
    </div>

    <div style="margin-bottom:20px;">
      <strong>Vedenkorkeus (havainto)</strong>
      <canvas id="sea-level-obs-chart" height="110"></canvas>
    </div>

    <div style="margin-bottom:20px;">
      <strong>Vedenkorkeus (ennuste)</strong>
      <canvas id="sea-level-fc-chart" height="110"></canvas>
    </div>

    <div>
      <strong>Veden lämpötila</strong>
      <canvas id="sea-temp-chart" height="80"></canvas>
    </div>

  </div>
  `;
  

  //HAVAINTOGRAAFIT
  const ctx = contentEl
    .querySelector("#sea-level-obs-chart")
    .getContext("2d");

  new Chart(ctx, {
    type: "line",
    data: {
    labels: series.waterLevel.map(p => {
      const d = new Date(p.time);
      return d.getHours().toString().padStart(2, "0");
    }),
      datasets: [
        {
          label: "Vedenkorkeus (cm)",
          data: series.waterLevel.map(p => p.value),
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: "N2000 (cm)",
          data: series.waterLevelN2000.map(p => p.value),
          tension: 0.3,
          pointRadius: 0,
          borderDash: [6, 4],
          borderWidth: 2
        }

      ]

    },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: "cm"
            }
          }
        }
      }
  });


//ENNUSTEGRAAFIT

  const fcCtx = contentEl
    .querySelector("#sea-level-fc-chart")
    .getContext("2d");

  new Chart(fcCtx, {
    type: "line",
    data: {
      labels: forecastData.forecast.map(p => {
        const d = new Date(p.time);
        return d.getHours().toString().padStart(2, "0");
      }),
      datasets: [
        {
          label: "Ennuste (cm)",
          data: forecastData.forecast.map(p => p.value),
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: "Ennuste N2000 (cm)",
          data: forecastData.forecastN2000.map(p => p.value),
          tension: 0.3,
          pointRadius: 0,
          borderDash: [6, 4],
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          title: {
            display: true,
            text: "cm"
          }
        }
      }
    }
  });


  const validTemp = series.waterTemp
    .filter(p => Number.isFinite(p.value));

  if (validTemp.length === 0) {

    const tempContainer = contentEl
      .querySelector("#sea-temp-chart")
      .parentElement;

    tempContainer.innerHTML = `
      <strong>Veden lämpötila</strong>
      <div style="padding:20px 0; color:#666; font-size:14px;">
        Veden lämpötiladataa ei saatavilla
      </div>
    `;

  } else {

 const tempCtx = contentEl
  .querySelector("#sea-temp-chart")
  .getContext("2d");

  new Chart(tempCtx, {
    type: "line",
    data: {
      labels: series.waterTemp.map(p => {
        const d = new Date(p.time);
        return d.getHours().toString().padStart(2, "0");
      }),
      datasets: [{
        label: "Veden lämpötila (°C)",
        data: series.waterTemp.map(p => p.value),
        tension: 0.3,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          title: {
            display: true,
            text: "°C"
          },
          grid: {
            color: ctx => ctx.tick.value === 0 ? "#000" : "#eee",
            lineWidth: ctx => ctx.tick.value === 0 ? 2 : 1
          }
        }
      }
    }
});

}}
