
// TUULINUOLIPLUGIN

const windArrowPlugin = {
  id: "windArrowPlugin",
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (!dataset.windDirections) return;

      const meta = chart.getDatasetMeta(datasetIndex);

      let lastTime = null;

      meta.data.forEach((point, i) => {

      const raw = dataset.data[i];
      if (!raw) return;

      const currentTime = raw.x;

      if (lastTime && (currentTime - lastTime) < 60 * 60 * 1000) {
      return;
      }

  lastTime = currentTime;


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
        const angle = (dir + 90) * Math.PI / 180;
        ctx.rotate(angle);


        ctx.fillStyle = color;
        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("➤", 0, 0);

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