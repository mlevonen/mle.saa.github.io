import { parseFmiUtc, interpolateTimeSeries } from "../utils/time.js";
export function renderTemperatureChart(popupEl, data) {
  console.log("Chart temp data:", data.obsTemp);

function renderTemperatureChart(popupEl, data) {

  console.log("🔥 renderTemperatureChart called");
  
  const canvas = popupEl.querySelector('[data-type="temp"]');
  console.log("Canvas inside render:", canvas);

  if (!canvas) {
    console.log("❌ No canvas found");
    return;
  }

  console.log("Data passed in:", data);

  const ctx = canvas.getContext("2d");
  console.log("CTX:", ctx);

  // älä muuta muuta vielä
}






  const { obsTemp, fcTemp } = data;

  if (!Array.isArray(obsTemp)) return;

  const nowUtc = new Date();

  const startTime = new Date(nowUtc.getTime() - 12 * 60 * 60 * 1000);
  const endTime   = new Date(nowUtc.getTime() + 36 * 60 * 60 * 1000);



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

const rawFcPoints = Array.isArray(fcTemp)
  ? fcTemp
      .map(p => ({
        x: parseFmiUtc(p.utctime),
        y: p.temperature
      }))
      .filter(p => p.x > obsCutoffUtc)
  : [];


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

    if (firstFc.x - lastObs.x > 10 * 60_000) {
      fcPoints.unshift({
        x: lastObs.x,
        y: lastObs.y,
        _bridge: true
      });
    }
  }

  const tempCanvas = popupEl.querySelector(
    'canvas[data-type="temp"]'
  );
  if (!tempCanvas) return;

  const oldTemp = Chart.getChart(tempCanvas);
  if (oldTemp) oldTemp.destroy();

  const allTemps = [
    ...obsPoints.map(p => p.y),
    ...fcPoints.map(p => p.y)
  ];

  if (!allTemps.length) return;

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
          borderColor: "rgba(0,140,0,0.9)",
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.4,
          cubicInterpolationMode: "monotone",
          spanGaps: true
        },
        
        {
          label: "Ennuste",
          data: fcPoints,
          borderColor: "rgba(220,0,0,0.9)",
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.4,
          borderDash: [4, 4] // jos käytät katkoviivaa
          },

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
            boxHeight: 6,
            generateLabels(chart) {
              const labels =
                Chart.defaults.plugins.legend.labels.generateLabels(chart);
              labels.forEach(label => {
                label.fillStyle = label.strokeStyle;
              });
              return labels;
            }
          }
        },
        nowLine: true
      },
      scales: {
        x: {
          type: "time",
          min: startTime,
          max: endTime,
          time: {
            unit: "hour",
            displayFormats: { hour: "HH" }
          },
          ticks: {
            maxRotation: 0,
            minRotation: 0
          }
        },

        y: {
          min: yMinTemp,
          max: yMaxTemp,
          ticks: { stepSize: 5 },
          title: { display: false }
        }
      }

    }
  });
}
