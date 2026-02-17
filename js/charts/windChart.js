import { parseFmiUtc, interpolateTimeSeries } from "../utils/time.js";

export function renderWindChart(popupEl, data) {
  console.log("Chart wind data:", data.obsWindSpeed);

const {
  obsWindSpeed,
  fcWindSpeed,
  fcWindDir,
  fcWindGust,
  obsWindGust
} = data;


  if (!Array.isArray(obsWindSpeed)) return;


  const nowUtc = new Date();
  const OBS_TOLERANCE_MIN = 15;

  const obsCutoffUtc = new Date(
    nowUtc.getTime() + OBS_TOLERANCE_MIN * 60_000
  );

  // ==========================
  // RAAKA TUULIDATA
  // ==========================
  const rawObsWind = obsWindSpeed
  .map(p => ({
    x: parseFmiUtc(p.utctime),
    y: p.windspeedms,
    dir: p.winddirection
  }))
  .filter(p => p.x <= obsCutoffUtc);

  const rawFcWind = Array.isArray(fcWindSpeed)
  ? fcWindSpeed
      .map((p, i) => ({
        x: parseFmiUtc(p.utctime),
        y: p.windspeedms,
        dir: fcWindDir?.[i]?.winddirection
      }))
      .filter(p => p.x > obsCutoffUtc)
  : [];

// ==========================
// PUUSKAHAVAINNOT
// ==========================
const rawObsGust = (obsWindGust ?? [])
  .map(p => ({
    x: parseFmiUtc(p.utctime),
    y: p.windgust
  }))
  .filter(p =>
    typeof p.y === "number" &&
    !isNaN(p.y) &&
    p.x <= obsCutoffUtc
  );
console.log("Gust obs from API:", rawObsGust.length);

// ==========================
// PUUSKAENNUSTE
// ==========================
const rawFcGust = Array.isArray(fcWindGust)
  ? fcWindGust
      .map(p => ({
        x: parseFmiUtc(p.utctime),
        y: p.windgust
      }))
      .filter(p =>
        typeof p.y === "number" &&
        !isNaN(p.y) &&
        p.x > obsCutoffUtc
      )
  : [];

const gustObs = rawObsGust;
const gustFc = rawFcGust;

console.log("gustObs:", gustObs.length);
console.log("gustFc:", gustFc.length);



// ==========================
// INTERPOLOI VAIN NOPEUS
// ==========================
function interpolateWindSpeedOnly(rawPoints, stepMinutes) {
  if (rawPoints.length < 2) return rawPoints;

  // Interpoloidaan vain x + y (NOPEUS)
  const interpolated = interpolateTimeSeries(
    rawPoints.map(p => ({ x: p.x, y: p.y })),
    stepMinutes
  );

  // Liitetään lähimmän mittauspisteen suunta
  return interpolated.map(p => {
    let closest = rawPoints[0];
    let minDiff = Math.abs(p.x - closest.x);

    for (const r of rawPoints) {
      const diff = Math.abs(p.x - r.x);
      if (diff < minDiff) {
        minDiff = diff;
        closest = r;
      }
    }

    return {
      x: p.x,
      y: p.y,
      dir: closest.dir
    };
  });
}


// --- tihennys (vain nopeus) ---
  const obsWind =
  rawObsWind.length >= 2
    ? interpolateWindSpeedOnly(rawObsWind, 30)
    : rawObsWind;

  const fcWind =
  rawFcWind.length >= 2
    ? interpolateWindSpeedOnly(rawFcWind, 30)
    : rawFcWind;


  // ==========================
  // YHDISTETTY TUULISARJA
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



  const windCanvas = popupEl.querySelector(
    'canvas[data-type="wind"]'
  );
  if (!windCanvas) return;

  const oldWind = Chart.getChart(windCanvas);
  if (oldWind) oldWind.destroy();

  // ==========================
  // Y-AKSELIN MAKSIMI
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
        {
          label: "Havainto",
          data: gustObs,
          showLine: false,
          pointRadius: 4,
          pointBackgroundColor: "rgba(0,140,0,0.9)",
          pointBorderWidth: 0
        },
        {
          label: "Ennuste (puuskaennuste katkoviivalla)",
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
          align: "start",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 6,
            boxHeight: 6,
            filter(item) {
              return item.text !== "Tuuli";
            },
            generateLabels(chart) {
              const labels =
                Chart.defaults.plugins.legend.labels.generateLabels(chart);

              labels.forEach(label => {
                if (label.text.includes("Puuska")) {
                  label.fillStyle = label.strokeStyle;
                  label.lineWidth = 0;
                }
              });

              return labels;
            }
          }
        },
        windArrowPlugin: true,
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
          min: 0,
          max: yMaxWind,
          ticks: { stepSize: 3 },
          title: { display: true, text: "m/s" }
        }
      }
    }
  });
}