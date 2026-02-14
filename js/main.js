import { loadPopupData } from "./api/dataLoader.js";
import { updatePopupTitles } from "./popup/popupTitles.js";
import { renderTemperatureChart } from "./charts/temperatureChart.js";
import { renderWindChart } from "./charts/windChart.js";
import { renderPopupExtras } from "./popup/popupExtras.js";
import "./charts/plugins.js";


"use strict";

const map = L.map("map").setView([60, 25], 6);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

const FMI_WFS = "https://opendata.fmi.fi/wfs";


// ==========================
// Layerit
// ==========================


const weatherLayer = L.featureGroup().addTo(map);
const seaLevelLayer = L.featureGroup().addTo(map);
const coastalLayer = L.featureGroup().addTo(map);

const markerRegistry = {};

L.control.layers(null, {
  "🌤 Sääasemat": weatherLayer,
  "🌊 Vedenkorkeusasemat": seaLevelLayer,
  "⚓ Rannikkoasemat": coastalLayer
}, { collapsed: false }).addTo(map);


// ==========================
// Asemat kartalle
// ==========================

stations.forEach(station => {

  const style = getMarkerStyle(station.type);

  let marker;

  if (station.featured) {
    marker = L.marker([station.lat, station.lon]);
  } else {
    marker = L.circleMarker([station.lat, station.lon], style);
  }

  marker.station = station;
  markerRegistry[station.fmisid] = marker;


  // 🔹 Hover-nimi
  // Alustetaan preview-cache
  marker.previewData = null;

  // Tyhjä tooltip – sisältö asetetaan hoverissa
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

    <div style="margin-top:8px;"><strong>Tuuli</strong></div>
    <canvas
      class="popup-chart"
      width="650"
      height="160"
      data-lat="${station.lat}"
      data-lon="${station.lon}"
      data-fmisid="${station.fmisid}"
      data-type="wind"
    ></canvas>
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

  if (weatherLayer.getLayers().length > 0) {
  map.fitBounds(weatherLayer.getBounds(), { padding: [30, 30] });
  }
 

  //FEATURED-LOOPPI

  stations.forEach(async station => {

  if (!station.featured) return;

  try {

    const data = await loadPopupData({
      lat: station.lat,
      lon: station.lon,
      weatherFmisid: station.fmisid,
      seaLevelFmisid: null
    });

    const latestWind = data.obsWindSpeed?.at(-1);
    if (!latestWind) return;

    const icon = createWindIcon(
      latestWind.windspeedms,
      latestWind.winddirection
    );

    const marker = markerRegistry[station.fmisid];
    if (!marker) return;

    marker.setIcon(icon);

  } catch (err) {
    console.error("Wind marker error:", err);
  }

});


    

  

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

export async function fetchPressureByFmisid (fmisid) {
  const url = `
  https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0
  &request=getFeature
  &storedquery_id=fmi::observations::weather::simple
  &fmisid=${fmisid}
  &parameters=pressure
  &starttime=${startTime}
  &endtime=${endTime}
  `.replace(/\s+/g, '');


  const res = await fetch(url);
  const xml = await res.text();

  // 👉 tähän kevyt parseri:
  // etsi viimeisin <BsWfs:ParameterValue>
  // ja sitä vastaava <BsWfs:Time>

  return [
    {
      utctime: "...",
      pressurehpa: 1019.6
    }
  ];
  console.log("Pressure URL:", url);

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


function createWindIcon(speed, direction) {

  const svg = `
    <svg width="36" height="36" viewBox="0 0 24 24">
      <g transform="rotate(0 12 12)">
        <polygon points="12,2 6,14 18,14"
                 fill="#111"/>
      </g>
    </svg>
  `;

  return L.divIcon({
    className: "wind-marker",
    html: svg,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}







// ==========================
// Popup → lämpötila + tuuli (havainto + ennuste)
// ==========================

map.on("popupopen", async e => {

  const popupEl = e.popup.getElement();
  if (!popupEl) return;

  const canvases = popupEl.querySelectorAll("canvas");
  if (!canvases.length) return;

  // 🔑 1. Ota feature.properties ENSIN
  const station = e.popup._source.station;
  if (!station) return;


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
      lat,
      lon,
      weatherPlace:station.type === "weather" ? station.name : null,
      weatherFmisid,
      seaLevelFmisid
    });

    updatePopupTitles(popupEl, data);
    renderPopupExtras(popupEl, data);
    renderTemperatureChart(popupEl, data);
    renderWindChart(popupEl, data);

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


