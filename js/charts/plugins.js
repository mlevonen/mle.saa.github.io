
// TUULINUOLIPLUGIN

const windArrowPlugin = {
  id: "windArrowPlugin",
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const { bottom } = chart.chartArea;

    // Kuinka paljon nuoli piirretään viivan/pisteen alapuolelle,
    // ja kuinka lähelle kaavion pohjaa se saa enintään mennä.
    const ARROW_OFFSET = 14;
    const maxY = bottom - 6;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (!dataset.windDirections) return;

      const meta = chart.getDatasetMeta(datasetIndex);

      let lastTime = null;

      meta.data.forEach((point, i) => {

      const raw = dataset.data[i];
      if (!raw) return;

      const currentTime = raw.x;

      // Näytä nuoli vain 1h välein
      if (lastTime && (currentTime - lastTime) < 60 * 60 * 1000) {
      return;
      }

      lastTime = currentTime;

      const dir = dataset.windDirections[i];
      if (dir == null) return;

      const { x, y } = point.getProps(["x", "y"], true);
      const arrowY = Math.min(y + ARROW_OFFSET, maxY);

      const color =
      raw.phase === "fc"
      ? "rgba(220,0,0,0.9)"
      : "rgba(0,140,0,0.9)";

      ctx.save();
      ctx.translate(x, arrowY);

      const angle = (dir + 90) * Math.PI / 180;
      ctx.rotate(angle);

      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.lineCap = "round";

      // Varsi
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(2, 0);
      ctx.stroke();

      // Nuolenpää
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(1, -3);
      ctx.lineTo(1, 3);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
      });
    });
  }
};



// NOWLINEPLUGIN

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


// VUOROKAUDENVAIHTOPLUGIN
//
// Piirtää ohuen pystyviivan ja päivän lyhenteen (ma/ti/ke...) jokaisen
// paikallisen keskiyön (00:00) kohdalle akselin näkyvällä aikavälillä.
// Käyttökelpoisin pidennetyllä (48h) tuuliennustegraafilla, jossa
// vuorokausi voi vaihtua kesken graafin, mutta toimii yhtä hyvin myös
// lyhyemmällä havaintograafilla (ei piirrä mitään jos näkyvällä
// aikavälillä ei ole yhtään keskiyötä).
const dayBoundaryPlugin = {
  id: "dayBoundary",

  // Viiva piirretään ENNEN datasettejä, jotta se jää käyrien alle
  // (samaan tapaan kuin Chart.js:n omat ruudukkoviivat).
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale) return;

    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);

    forEachDayBoundary(xScale, boundaryTime => {
      const x = xScale.getPixelForValue(boundaryTime);
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
    });

    ctx.restore();
  },

  // Päivän lyhenne piirretään VASTA lopuksi, jotta teksti näkyy
  // selvästi käyrien päällä eikä jää niiden alle.
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale) return;

    ctx.save();
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    forEachDayBoundary(xScale, boundaryTime => {
      const x = xScale.getPixelForValue(boundaryTime);
      const label = new Date(boundaryTime).toLocaleDateString("fi-FI", { weekday: "short" });
      ctx.fillText(label, x, chartArea.top + 2);
    });

    ctx.restore();
  }
};

// Kutsuu callbackia jokaiselle paikalliselle keskiyölle (00:00), joka
// osuu annetun x-akselin min/max-aikavälille.
function forEachDayBoundary(xScale, callback) {
  const min = xScale.min;
  const max = xScale.max;
  if (min == null || max == null) return;

  // Ensimmäinen keskiyö minin JÄLKEEN (paikallisessa aikavyöhykkeessä).
  const d = new Date(min);
  d.setHours(24, 0, 0, 0);

  while (d.getTime() <= max) {
    callback(d.getTime());
    d.setDate(d.getDate() + 1);
  }
}


// TEMPERATUREBANDSPLUGIN

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


Chart.register(windArrowPlugin);
Chart.register(nowLinePlugin);
Chart.register(temperatureBandsPlugin);
Chart.register(dayBoundaryPlugin);