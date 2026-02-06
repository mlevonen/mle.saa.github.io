import "./charts/plugins.js";

"use strict";

console.log("MAIN.JS LOADED");

const map = L.map("map").setView([60, 25], 6);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

const FMI_WFS = "https://opendata.fmi.fi/wfs";

console.log("MAP CREATED");


// ==========================
// Asemat kartalle
// ==========================
fetch("stations.json")
  .then(r => r.json())
  .then(data => {

    const layer = L.featureGroup().addTo(map);

    data.features.forEach(f => {
      const [lon, lat] = f.geometry.coordinates;
      const { name } = f.properties;

      const marker = L.circleMarker([lat, lon], {
        radius: 5,
        color: "blue",
        fillOpacity: 0.7
      }).addTo(layer);

marker.bindPopup(`
  <div class="popup-title">${name}</div>

  <div><strong>Lämpötila</strong></div>
  <canvas
    class="popup-chart"
    width="650"
    height="160"
    data-lat="${lat}"
    data-lon="${lon}"
    data-type="temp"
  ></canvas>

  <div style="margin-top:8px;"><strong>Tuuli</strong></div>
  <canvas
    class="popup-chart"
    width="650"
    height="160"
    data-lat="${lat}"
    data-lon="${lon}"
    data-type="wind"
  ></canvas>
`);

    });

    map.fitBounds(layer.getBounds(), { padding: [30, 30] });
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
  console.log("FMI REQUEST:", url);

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
  console.log("FMI REST REQUEST:", url);

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
  console.log("FMI FORECAST REQUEST:", url);

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




// ==========================
// Popup data cache, tästä alkaa isot muutokset
// ==========================
const popupCache = {};

async function loadPopupData(lat, lon) {
  const cacheKey = `${lat},${lon}`;

  if (popupCache[cacheKey]) {
    console.log("CACHE HIT", cacheKey);
    return popupCache[cacheKey];
  }

  console.log("CACHE MISS", cacheKey);

  const obsTemp = await fetchTimeSeriesREST(lat, lon, {
    param: "utctime,temperature"
  });

  const fcTemp = await fetchForecastREST(lat, lon, {
    param: "utctime,temperature"
  });

  const obsWindSpeed = await fetchTimeSeriesREST(lat, lon, {
    param: "utctime,windspeedms,winddirection,windgust"
  });

  const fcWindSpeed = await fetchForecastREST(lat, lon, {
    param: "utctime,windspeedms"
  });

  const fcWindDir = await fetchForecastREST(lat, lon, {
    param: "winddirection"
  });

  const fcWindGust = await fetchForecastREST(lat, lon, {
    param: "utctime,hourlymaximumgust"
  });

  const data = {
    obsTemp,
    fcTemp,
    obsWindSpeed,
    fcWindSpeed,
    fcWindDir,
    fcWindGust
  };

  popupCache[cacheKey] = data;
  return data;
}

function updatePopupTitles(popupEl, data) {
  const { obsTemp, obsWindSpeed } = data;

  // ==========================
  // LÄMPÖTILA-OTSIKKO
  // ==========================
  const latestTemp = getLatestObservation(
    obsTemp,
    "utctime",
    "temperature"
  );

  if (latestTemp) {
    const tempTitle = popupEl.querySelector(
      'div:has(+ canvas[data-type="temp"])'
    );

    if (tempTitle) {
      tempTitle.textContent =
        `Lämpötila ${latestTemp.v.toFixed(1)} °C`;
    }
  }

  // ==========================
  // TUULI-OTSIKKO
  // ==========================
  const latestWind = getLatestObservation(
    obsWindSpeed,
    "utctime",
    "windspeedms"
  );

  const latestGust = getLatestObservation(
    obsWindSpeed,
    "utctime",
    "windgust"
  );

  if (latestWind) {
    const windTitle = popupEl.querySelector(
      'div:has(+ canvas[data-type="wind"])'
    );

    if (windTitle) {
      const speed = latestWind.v.toFixed(1);

      const gustText =
        latestGust && latestGust.v != null
          ? ` (puuskat ${latestGust.v.toFixed(1)} m/s)`
          : "";

      windTitle.textContent =
        `Tuuli ${speed} m/s${gustText}`;
    }
  }
}


// ==========================
// Popup → lämpötila + tuuli (havainto + ennuste)
// ==========================

map.on("popupopen", async e => {
  const popupEl = e.popup.getElement();
  if (!popupEl) return;

  const canvas = popupEl.querySelector("canvas");
  if (!canvas) return;

  const { lat, lon } = canvas.dataset;

  try {
    const data = await loadPopupData(lat, lon);

    updatePopupTitles(popupEl, data);
    renderTemperatureChart(popupEl, data);
    renderWindChart(popupEl, data);

  } catch (err) {
    console.error("Popup error:", err);
    popupEl.innerHTML += `<div>Virhe FMI-datan haussa</div>`;
  }
});

