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

  function renderWindObsChart(popupEl, windSeries, gustObs) {

  const canvas = popupEl.querySelector(
    'canvas[data-type="wind-obs"]'
  );
  if (!canvas) return;

  const obsSeries = windSeries.filter(p => p.phase === "obs");

  const allValues = [
    ...obsSeries.map(p => p.y),
    ...gustObs.map(p => p.y)
  ].filter(v => typeof v === "number");

  const yMax = allValues.length
    ? Math.ceil((Math.max(...allValues) + 2) / 5) * 5
    : 15;

  new Chart(canvas, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Tuuli (havainto)",
          data: obsSeries,
          borderColor: "rgba(0,140,0,0.9)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          windDirections: obsSeries.map(p => p.dir)
        },
        {
          label: "Puuska",
          data: gustObs,
          borderColor: "rgba(0,140,0,0.5)",
          borderWidth: 1,
          pointRadius: 0,
          tension: 0
        }
      ]
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: false },
        windArrowPlugin: true,
        nowLine: true
      },
      scales: {
        x: { type: "time" },
        y: {
          min: 0,
          max: yMax,
          title: { display: true, text: "m/s" }
        }
      }
    }
  });
}
  function renderWindFcChart(popupEl, windSeries, gustFc) {

    const canvas = popupEl.querySelector(
      'canvas[data-type="wind-fc"]'
    );
    if (!canvas) return;

    const fcSeries = windSeries.filter(p => p.phase === "fc");

    const allValues = [
      ...fcSeries.map(p => p.y),
      ...gustFc.map(p => p.y)
    ].filter(v => typeof v === "number");

    const yMax = allValues.length
      ? Math.ceil((Math.max(...allValues) + 2) / 5) * 5
      : 15;

    new Chart(canvas, {
      type: "line",
      data: {
        datasets: [
          {
            label: "Tuuli (ennuste)",
            data: fcSeries,
            borderColor: "rgba(220,0,0,0.9)",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            windDirections: fcSeries.map(p => p.dir)
          },
          {
            label: "Puuska (ennuste)",
            data: gustFc,
            borderColor: "rgba(220,0,0,0.5)",
            borderWidth: 1,
            pointRadius: 0,
            tension: 0,
            borderDash: [3,3]
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          windArrowPlugin: true
        },
        scales: {
          x: { type: "time" },
          y: {
            min: 0,
            max: yMax,
            title: { display: true, text: "m/s" }
          }
        }
      }
    });
  }




}
