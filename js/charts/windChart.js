import { parseFmiUtc, interpolateTimeSeries } from "../utils/time.js";

export function renderWindChart(popupEl, data) {
  const {
    obsWindSpeed,
    fcWindSpeed,
    fcWindDir,
    fcWindGust
  } = data;

  if (!Array.isArray(obsWindSpeed) || !Array.isArray(fcWindSpeed)) return;

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
      dir: p.winddirection
    }))
    .filter(p => p.x <= obsCutoffUtc);

  const rawFcWind = fcWindSpeed
    .map((p, i) => ({
      x: parseFmiUtc(p.utctime),
      y: p.windspeedms,
      dir: fcWindDir?.[i]?.winddirection
    }))
    .filter(p => p.x > obsCutoffUtc);

  // --- tihennys (vain nopeus) ---
  const obsWind =
    rawObsWind.length >= 2
      ? interpolateTimeSeries(rawObsWind, 30)
      : rawObsWind;

  const fcWind =
    rawFcWind.length >= 2
      ? interpolateTimeSeries(rawFcWind, 30)
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

  // ==========================
  // PUUSKAT
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