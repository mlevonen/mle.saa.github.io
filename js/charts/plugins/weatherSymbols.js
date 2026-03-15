const iconCache = {};

function getIcon(symbol) {

  if (!iconCache[symbol]) {

    const img = new Image();
    img.src = `/js/assets/weather-icons/SmartSymbol/${symbol}.svg`;

    iconCache[symbol] = img;
  }

  return iconCache[symbol];
}

export const weatherSymbolsPlugin = {

  id: "weatherSymbols",

  afterDatasetsDraw(chart) {

    const datasetIndex = 1; // forecast dataset

    const dataset = chart.data.datasets[datasetIndex];
    const meta = chart.getDatasetMeta(datasetIndex);

    const { ctx } = chart;

    dataset.data.forEach((point, i) => {

    if (!point.symbol) return;

    // näytä symboli vain 3h välein
    if (point.x.getUTCHours() % 3 !== 0) return;

    const pos = meta.data[i].getProps(["x"], true);

    const img = getIcon(point.symbol);

    const y = chart.chartArea.top + 6;

    if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, pos.x - 12, y, 26, 26);
    }

    });

  }

};