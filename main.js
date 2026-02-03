
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

    if (popupCache[cacheKey]) {
      ({ obsTemp, fcTemp, obsWindSpeed, fcWindSpeed, fcWindDir, fcWindGust } =
        popupCache[cacheKey]);
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
        obsTemp, fcTemp, obsWindSpeed, fcWindSpeed, fcWindDir, fcWindGust
      };
    }

console.log(popupCache[cacheKey] ? "CACHE HIT" : "CACHE MISS", cacheKey);


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
// LÄMPÖTILA GRAAFI
// ==========================
if (Array.isArray(obsTemp) && Array.isArray(fcTemp)) {

  const nowUtc = new Date();
  const OBS_TOLERANCE_MIN = 15;

  const obsCutoffUtc = new Date(
    nowUtc.getTime() + OBS_TOLERANCE_MIN * 60_000
  );



// --- raakapisteet ---
const rawObsPoints = obsTemp
  .map(p => ({
    x: parseFmiUtc(p.utctime),
    y: p.temperature
  }))
  .filter(p => p.x <= obsCutoffUtc);


const rawFcPoints = fcTemp
  .map(p => ({
    x: parseFmiUtc(p.utctime),
    y: p.temperature
  }))
  .filter(p => p.x > obsCutoffUtc);

// --- tihennys 30 min välein ---
const obsPoints =
  rawObsPoints.length >= 2
    ? interpolateTimeSeries(rawObsPoints, 30)
    : rawObsPoints;

const fcPoints =
  rawFcPoints.length >= 2
    ? interpolateTimeSeries(rawFcPoints, 30)
    : rawFcPoints;

// ==========================
// SILLAN LUONTI havainto → ennuste
// ==========================
if (obsPoints.length && fcPoints.length) {
  const lastObs = obsPoints.at(-1);
  const firstFc = fcPoints[0];

  // jos väli on yli 10 min, tehdään silta
  if (firstFc.x - lastObs.x > 10 * 60_000) {
    fcPoints.unshift({
      x: lastObs.x,
      y: lastObs.y,
      _bridge: true   // vain merkintä Chartia varten
    });
  }
}





  const tempCanvas = popupEl.querySelector('canvas[data-type="temp"]');
  const oldTemp = Chart.getChart(tempCanvas);
  if (oldTemp) oldTemp.destroy();

  const allTemps = [
    ...obsPoints.map(p => p.y),
    ...fcPoints.map(p => p.y)
  ];

  if (allTemps.length === 0) return;

  const minTemp = Math.min(...allTemps);
  const maxTemp = Math.max(...allTemps);

  const padding = 3;
  const yMinTemp = Math.floor((minTemp - padding) / 5) * 5;
  const yMaxTemp = Math.ceil((maxTemp + padding) / 5) * 5;

  new Chart(tempCanvas, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Havainto",
          data: obsPoints,
          borderColor: "blue",
          tension: 0.45,
          cubicInterpolationMode: "monotone",
          pointRadius: 2
        },
        {
          label: "Ennuste",
          data: fcPoints,
          borderColor: "red",
          borderDash: [6,4],
          
		segment: {
		  borderDash: ctx =>
		    ctx.p0.raw?._bridge ? [2, 4] : [6, 4]
		},
          
		tension: 0.45,

          cubicInterpolationMode: "monotone",
          pointRadius: 0
        }
      ]
    },
options: {
  responsive: false,

  plugins: {
    legend: {
      display: true,
      position: "top",
      align: "start",
      labels: {
        usePointStyle: true,
        pointStyle: "circle",
        boxWidth: 6,
        boxHeight: 6
      }
    },
    windArrowPlugin: true,
    nowLine: true
  },   // ✅ TÄRKEÄ PILKKU

scales: {
  x: {
    type: "time",
    time: {
      unit: "hour",
      displayFormats: { hour: "HH" }
    }
  },
  y: {
    min: yMinTemp,
    max: yMaxTemp,
    ticks: { stepSize: 5 },
    title: { display: true, text: "°C" }
  }
}

}

  });
}



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

    const gustText = latestGust && latestGust.v != null
      ? ` (puuskat ${latestGust.v.toFixed(1)} m/s)`
      : "";

    windTitle.textContent =
      `Tuuli ${speed} m/s${gustText}`;
  }
}




// ==========================
// TUULI GRAAFI (nopeus)
// ==========================
if (Array.isArray(obsWindSpeed) && Array.isArray(fcWindSpeed)) {

  const nowUtc = new Date();
  const OBS_TOLERANCE_MIN = 15;

  const obsCutoffUtc = new Date(
    nowUtc.getTime() + OBS_TOLERANCE_MIN * 60_000
  );

  // --- raakapisteet ---
  const rawObsWind = obsWindSpeed
    .map(p => ({
      x: parseFmiUtc(p.utctime),
      y: p.windspeedms,
      dir: p.winddirection   // ← säilytetään
    }))
    .filter(p => p.x <= obsCutoffUtc);

  const rawFcWind = fcWindSpeed
    .map((p, i) => ({
      x: parseFmiUtc(p.utctime),
      y: p.windspeedms,
      dir: fcWindDir?.[i]?.winddirection
    }))
    .filter(p => p.x > obsCutoffUtc);

  // --- tihennys VAIN nopeudelle ---
  const obsWind =
    rawObsWind.length >= 2
      ? interpolateTimeSeries(rawObsWind, 30)
      : rawObsWind;

  const fcWind =
    rawFcWind.length >= 2
      ? interpolateTimeSeries(rawFcWind, 30)
      : rawFcWind;

// ==========================
// YHDISTETTY TUULISARJA (havainto + ennuste)
// ==========================
const windSeries = [
  ...obsWind.map(p => ({
    x: p.x,
    y: p.y,
    dir: p.dir,
    phase: "obs"
  })),
  ...fcWind.map(p => ({
    x: p.x,
    y: p.y,
    dir: p.dir,
    phase: "fc"
  }))
];

//PUUSKAT

// ==========================
// PUUSKAT: havainto vs ennuste
// ==========================

const gustObs = obsWindSpeed
  .filter(p => p.windgust != null)
  .map(p => ({
    x: parseFmiUtc(p.utctime),
    y: p.windgust
  }));

const gustFc = (fcWindGust ?? [])
  .filter(p => p.hourlymaximumgust != null)
  .map(p => ({
    x: parseFmiUtc(p.utctime),
    y: p.hourlymaximumgust
  }));





  const windCanvas = popupEl.querySelector('canvas[data-type="wind"]');
  const oldWind = Chart.getChart(windCanvas);
  if (oldWind) oldWind.destroy();

console.log("windSeries", windSeries);


// ==========================
// Y-AKSELIN MAKSIMI (tuuli + puuskat)
// ==========================
const allWindValues = [
  ...windSeries.map(p => p.y),
  ...gustObs.map(p => p.y),
  ...gustFc.map(p => p.y)
].filter(v => typeof v === "number");

const yMaxWind = allWindValues.length
  ? Math.ceil((Math.max(...allWindValues) + 2) / 5) * 5
  : 15;







new Chart(windCanvas, {
  type: "line",
  data: {
datasets: [
  // ==========================
  // PERUSTUULI (nuolet, ennuste + havainto)
  // ==========================
  {
    label: "Tuuli",
    data: windSeries,
    borderColor: "rgba(0,0,0,0.15)",
    borderWidth: 1,
    pointRadius: 0,
    tension: 0.45,
    cubicInterpolationMode: "monotone",
    windDirections: windSeries.map(p => p.dir)
  },

  // ==========================
  // PUUSKAT – HAVAINNOT (pisteet)
  // ==========================
  {
    label: "Tuuli (havainto)",
    data: gustObs,
    showLine: false,
    pointRadius: 4,
    pointBackgroundColor: "rgba(0,140,0,0.9)",
    pointBorderWidth: 0
  },

  // ==========================
  // PUUSKAT – ENNUSTE (viiva)
  // ==========================
  {
    label: "Puuska (ennuste)",
    data: gustFc,
    showLine: true,
    pointRadius: 0,
    borderWidth: 1.5,
    tension: 0,
    borderColor: "rgba(220,0,0,0.7)",
    borderDash: [2, 3]
  }
]

    
    
    
  },
  options: {
    responsive: false,

plugins: {
  legend: {
    display: true,
    position: "top",
    align: "start",           // 👈 vasemmalle
    labels: {
      usePointStyle: true,
      pointStyle: "circle",
      boxWidth: 6,
      boxHeight: 6
      
        filter(item, chart) {
        return item.text !== "Tuuli";
    }   
    }
  },
  windArrowPlugin: true,
  nowLine: true
},



    scales: {
      x: {
        type: "time",
        time: { unit: "hour", displayFormats: { hour: "HH" } }
      },
      y: {
        min: 0,
        max: yMaxWind,   // 🔑 TÄSSÄ KÄYTETÄÄN
        ticks: { stepSize: 3 },
        title: { display: true, text: "m/s" }
      }
    }
  }
});




  } 
  
  } 
  
  catch (err) {
    console.error("Popup error:", err);
    popupEl.innerHTML += `<div>Virhe FMI-datan haussa</div>`;
  }
});
