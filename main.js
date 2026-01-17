
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
    width="400"
    height="160"
    data-lat="${lat}"
    data-lon="${lon}"
    data-type="temp"
  ></canvas>

  <div style="margin-top:8px;"><strong>Tuuli</strong></div>
  <canvas
    class="popup-chart"
    width="400"
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
  const past = new Date(now.getTime() - 6 * 3600_000).toISOString();
  const future = new Date(now.getTime() + 6 * 3600_000).toISOString();

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
  const future = new Date(now.getTime() + 12 * 3600_000).toISOString();

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
// Popup data cache
// ==========================
const popupCache = {};


console.log("SCRIPT LOADED");



// TUULINUOLIPLUGIN

const windArrowPlugin = {
  id: "windArrowPlugin",
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (!dataset.windDirections) return;

      const meta = chart.getDatasetMeta(datasetIndex);

      meta.data.forEach((point, i) => {
        const dir = dataset.windDirections[i];
        const raw = dataset.data[i];

        if (dir == null || !raw) return;

        const { x, y } = point.getProps(["x", "y"], true);

        // ==========================
        // VÄRI HAVAINTO vs ENNUSTE
        // ==========================
        const color =
          raw.phase === "fc"
            ? "rgba(220,0,0,0.9)"   // ennuste
            : "rgba(0,140,0,0.9)";  // havainto

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((dir + 180) * Math.PI / 180);

        ctx.fillStyle = color;
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("➤", 0, 0);

        ctx.restore();
      });
    });
  }
};


Chart.register(windArrowPlugin);



const nowLinePlugin = {
  id: "nowLine",

  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;

    if (!xScale) return;

    const now = Date.now();

    // Jos "nyt" ei ole akselin alueella, ei piirretä
    if (now < xScale.min || now > xScale.max) return;

    const x = xScale.getPixelForValue(now);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);

    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); // kevyt katkoviiva
    ctx.stroke();

    ctx.restore();
  }
};


Chart.register(nowLinePlugin);



const temperatureBandsPlugin = {
  id: "temperatureBands",

  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const y = scales.y;

    if (!y) return;

    const bands = [
      { from: -100, to: -15, color: "rgba(120,180,255,0.15)" },
      { from: -15,  to: 0,   color: "rgba(160,200,255,0.15)" },
      { from: 0,    to: 20,  color: "rgba(180,230,180,0.15)" },
      { from: 20,   to: 100, color: "rgba(255,180,180,0.15)" }
    ];

    ctx.save();

    bands.forEach(band => {
      const yTop = y.getPixelForValue(band.to);
      const yBottom = y.getPixelForValue(band.from);

      ctx.fillStyle = band.color;
      ctx.fillRect(
        chartArea.left,
        yTop,
        chartArea.right - chartArea.left,
        yBottom - yTop
      );
    });

    ctx.restore();
  }
};

Chart.register(temperatureBandsPlugin);


// ==========================
// Popup → lämpötila + tuuli (havainto + ennuste)
// ==========================

map.on("popupopen", async e => {

  console.log("POPUP OPEN");

  const popupEl = e.popup.getElement();
  if (!popupEl) return;

  const canvases = popupEl.querySelectorAll("canvas");
  if (!canvases.length) return;

  const lat = canvases[0].dataset.lat;
  const lon = canvases[0].dataset.lon;
  const cacheKey = `${lat},${lon}`;

  try {
    let obsTemp, fcTemp, obsWindSpeed, fcWindSpeed, fcWindDir, fcWindGust;

    // ==========================
    // CACHE / DATA FETCH
    // ==========================
    if (popupCache[cacheKey]) {
      ({
        obsTemp,
        fcTemp,
        obsWindSpeed,
        fcWindSpeed,
        fcWindDir,
        fcWindGust
      } = popupCache[cacheKey]);
    } else {
      obsTemp = await fetchTimeSeriesREST(lat, lon, {
        param: "utctime,temperature"
      });
      fcTemp = await fetchForecastREST(lat, lon, {
        param: "utctime,temperature"
      });
      obsWindSpeed = await fetchTimeSeriesREST(lat, lon, {
        param: "utctime,windspeedms,winddirection,windgust"
      });
      fcWindSpeed = await fetchForecastREST(lat, lon, {
        param: "utctime,windspeedms"
      });
      fcWindDir = await fetchForecastREST(lat, lon, {
        param: "winddirection"
      });
      fcWindGust = await fetchForecastREST(lat, lon, {
        param: "utctime,hourlymaximumgust"
      });

      popupCache[cacheKey] = {
        obsTemp,
        fcTemp,
        obsWindSpeed,
        fcWindSpeed,
        fcWindDir,
        fcWindGust
      };
    }

    // ==========================
    // LÄMPÖTILA OTSIKKO
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
    // LÄMPÖTILAGRAAFI
    // ==========================
    if (Array.isArray(obsTemp) && Array.isArray(fcTemp)) {
      /* ⬅️ koko lämpötilagraafikoodisi
         (sellaisenaan, vain sisennys kunnossa)
      */
    }

    // ==========================
    // TUULI OTSIKKO
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
        const gustText =
          latestGust && latestGust.v != null
            ? ` (puuskat ${latestGust.v.toFixed(1)} m/s)`
            : "";

        windTitle.textContent =
          `Tuuli ${latestWind.v.toFixed(1)} m/s${gustText}`;
      }
    }

    // ==========================
    // TUULIGRAAFI
    // ==========================
    if (Array.isArray(obsWindSpeed) && Array.isArray(fcWindSpeed)) {
      /* ⬅️ koko tuuligraafikoodisi
         (sellaisenaan)
      */
    }

  } catch (err) {
    console.error("Popup error:", err);
    popupEl.innerHTML += `<div>Virhe FMI-datan haussa</div>`;
  }
});
