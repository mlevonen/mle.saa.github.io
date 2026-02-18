import { parseFmiUtc, interpolateTimeSeries } from "../utils/time.js";

// ======================================================
// PÄÄFUNKTIO (ainoa export)
// ======================================================
export function renderWindCharts(popupEl, data) {

  const now = new Date();

  const obsStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const obsEnd   = now;

  const fcStart = now;
  const fcEnd   = new Date(now.getTime() + 36 * 60 * 60 * 1000);



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

  // ======================================================
  // RAAKA TUULIDATA
  // ======================================================
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

  // ======================================================
  // INTERPOLOI VAIN NOPEUS
  // ======================================================
  function interpolateWindSpeedOnly(rawPoints, stepMinutes) {
    if (rawPoints.length < 2) return rawPoints;

    const interpolated = interpolateTimeSeries(
      rawPoints.map(p => ({ x: p.x, y: p.y })),
      stepMinutes
    );

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

  const obsWind =
    rawObsWind.length >= 2
      ? interpolateWindSpeedOnly(rawObsWind, 30)
      : rawObsWind;

  const fcWind =
    rawFcWind.length >= 2
      ? interpolateWindSpeedOnly(rawFcWind, 30)
      : rawFcWind;

  const windSeries = [
    ...obsWind.map(p => ({ ...p, phase: "obs" })),
    ...fcWind.map(p => ({ ...p, phase: "fc" }))
  ];

  // ======================================================
  // PUUSKAT
  // ======================================================
  const gustObs = (obsWindGust ?? [])
    .map(p => ({
      x: parseFmiUtc(p.utctime),
      y: p.windgust
    }))
    .filter(p => p.x <= obsCutoffUtc);

  const gustFc = (fcWindGust ?? [])
    .map(p => ({
      x: parseFmiUtc(p.utctime),
      y: p.windgust
    }))
    .filter(p => p.x > obsCutoffUtc);


    console.log("WindSeries:", windSeries.length);
    console.log("GustObs:", gustObs.length);
    console.log("GustFc:", gustFc.length);

  // ======================================================
  // RENDERÖIDÄÄN PANEELIT
  // ======================================================
  renderWindObsChart(popupEl, windSeries, gustObs, obsStart, obsEnd);
  renderWindFcChart(popupEl, windSeries, gustFc, fcStart, fcEnd);

}


// ======================================================
// HAVAINTOPANEELI
// ======================================================
function renderWindObsChart(
  popupEl,
  windSeries,
  gustObs,
  obsStart,
  obsEnd
) {

  console.log("Obs canvas:", popupEl.querySelector('canvas[data-type="wind-obs"]'));
  console.log("Rendering OBS chart");

  const canvas = popupEl.querySelector(
    'canvas[data-type="wind-obs"]'
  );
  if (!canvas) return;

  const oldChart = Chart.getChart(canvas);
  if (oldChart) oldChart.destroy();

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
          data: obsSeries,
          borderColor: "rgba(0,140,0,0.9)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          windDirections: obsSeries.map(p => p.dir)
        },
        {
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
        x: {
          type: "time",
          min: obsStart,
          max: obsEnd,
          time: {
            unit: "hour",
            stepSize: 1,
            displayFormats: { hour: "HH" }
          },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0
          }
        },
        y: {
          min: 0,
          max: yMax
        }
      }
    }
  });
}

  
// ======================================================
// ENNUSTEPANEELI
// ======================================================
function renderWindFcChart(
  popupEl,
  windSeries,
  gustFc,
  fcStart,
  fcEnd
)
 {
console.log("Fc canvas:", popupEl.querySelector('canvas[data-type="wind-fc"]'));
console.log("Rendering FC chart");

  const canvas = popupEl.querySelector(
    'canvas[data-type="wind-fc"]'
  );
  if (!canvas) return;

  const oldChart = Chart.getChart(canvas);
  if (oldChart) oldChart.destroy();

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
        data: fcSeries,
        borderColor: "rgba(220,0,0,0.9)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        windDirections: fcSeries.map(p => p.dir)
      },
      {
        data: gustFc,
        borderColor: "rgba(220,0,0,0.5)",
        borderWidth: 1,
        pointRadius: 0,
        tension: 0,
        borderDash: [3, 3]
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
      x: {
        type: "time",
        min: fcStart,
        max: fcEnd,
        time: {
          unit: "hour",
          displayFormats: { hour: "HH" }
        },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 9,
          maxRotation: 0,
          minRotation: 0
        }
      },
      y: {
        min: 0,
        max: yMax
      }
    }
  }
});
}
