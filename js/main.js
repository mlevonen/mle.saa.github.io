import { loadPopupData } from "./api/dataLoader.js";
import { updatePopupTitles } from "./popup/popupTitles.js";
import { renderTemperatureChart } from "./charts/temperatureChart.js";
import { renderWindCharts } from "./charts/windChart.js";
import { renderPopupExtras } from "./popup/popupExtras.js";
import "./charts/plugins.js";
import { fetchSeaLevelSeries } from "./api/sealevel.js";
import { fetchSeaLevelForecast } from "./api/sealevel.js";


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

  const marker = L.marker(
    [station.lat, station.lon],
    {
      icon: L.divIcon({
        className: "station-dot",
        html: `<div class="dot dot-${station.type}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
    }
  ).addTo(map);

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
 
  if (weatherLayer.getLayers().length > 0) {
  map.fitBounds(weatherLayer.getBounds(), { padding: [30, 30] });
  }
 });

// FEATURED-LOOPPI
stations.forEach(async station => {

  if (!station.featured) return;

  try {

    const data = await loadPopupData({
      lat: station.lat,
      lon: station.lon,
      weatherPlace: null,
      weatherFmisid: station.fmisid,
      seaLevelFmisid: null
    });

    const latestWind = data.obsWindSpeed?.at(-1);
    if (!latestWind) return;

    console.log(
      "Station:",
      station.name,
      "Time:",
      latestWind.utctime,
      "Direction:",
      latestWind.winddirection
    );

    const icon = createWindIcon(
      latestWind.windspeedms,
      latestWind.winddirection
    );

    // 🔥 HAE OLEMASSA OLEVA MARKER
    const baseMarker = markerRegistry[station.fmisid];
    if (!baseMarker) return;

    // 🔥 VAIHDA SEN IKONI
    baseMarker.setIcon(icon);

  } catch (err) {


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

//CREATEWINDICON
function createWindIcon(speed, direction) {

  const roundedSpeed = Math.round(speed);

  // 🎨 Väri nopeuden mukaan
  const color =
  roundedSpeed < 5  ? "rgba(76,175,80,0.65)" :
  roundedSpeed < 10 ? "rgba(255,193,7,0.65)" :
  roundedSpeed < 15 ? "rgba(255,152,0,0.65)" :
                      "rgba(244,67,54,0.65)";

  return L.divIcon({
    className: "wind-wrapper",
    html: `
      <div class="wind-marker" style="background:${color};">
        <div class="wind-arrow"
            style="transform: rotate(${(direction + 180) % 360}deg);">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M12 2 L12 16" 
                  stroke="#222" 
                  stroke-width="4"
                  stroke-linecap="round"/>
            <path d="M8 6 L12 2 L16 6"
                  stroke="#222"
                  stroke-width="4"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="wind-speed">
          ${roundedSpeed}
        </div>
      </div>
      `,
    iconSize: [54, 54],
    iconAnchor: [27, 27]
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
      lat,
      lon,
      weatherPlace:station.type === "weather" ? station.name : null,
      weatherFmisid,
      seaLevelFmisid
    });

    updatePopupTitles(popupEl, data);
    renderPopupExtras(popupEl, data);
    renderTemperatureChart(popupEl, data);
    renderWindCharts(popupEl, data);
    
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
  <div style="width:460px;">

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
      <canvas id="sea-level-obs-chart" height="180"></canvas>
    </div>

    <div style="margin-bottom:20px;">
      <strong>Vedenkorkeus (ennuste)</strong>
      <canvas id="sea-level-fc-chart" height="180"></canvas>
    </div>

    <div>
      <strong>Veden lämpötila</strong>
      <canvas id="sea-temp-chart" height="140"></canvas>
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
