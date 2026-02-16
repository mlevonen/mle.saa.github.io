import { parseFmiUtc, interpolateTimeSeries } from "../utils/time.js";
export function renderTemperatureChart(popupEl, data) {
  console.log("Chart temp data:", data.obsTemp);

  const { obsTemp, fcTemp } = data;

  if (!Array.isArray(obsTemp) || !Array.isArray(fcTemp)) return;

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
          borderColor: "blue",
          tension: 0.45,
          cubicInterpolationMode: "monotone",
          pointRadius: 2
        },
        {
          label: "Ennuste",
          data: fcPoints,
          borderColor: "red",
          borderDash: [6, 4],
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
