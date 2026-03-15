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

    const ICON_SIZE = 26;
    const ICON_OFFSET = 6; // etäisyys chartin yläreunasta

    dataset.data.forEach((point, i) => {

      if (!point.symbol) return;

      // näytä vain 3h välein
      if (point.x.getUTCHours() % 3 !== 0) return;

      const pos = meta.data[i].getProps(["x"], true);

      const img = getIcon(point.symbol);

      const y = chart.chartArea.top - ICON_SIZE - ICON_OFFSET;

      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(
          img,
          pos.x - ICON_SIZE / 2,
          y,
          ICON_SIZE,
          ICON_SIZE
        );
      }

    });

  }

};

export function getCurrentSymbol(symbols) {

  if (!symbols?.length) return null;

  const now = Date.now();

  let current = null;

  for (const s of symbols) {
    if (s.time.getTime() <= now) {
      current = s;
    } else {
      break;
    }
  }

  // jos kaikki symbolit ovat tulevaisuudessa
  if (!current) {
    return symbols[0].symbol;
  }

  return current.symbol;

}

export function getSymbolUrl(symbol) {

  if (!symbol) {
    return "/js/assets/weather-icons/SmartSymbol/na.svg";
  }

  return `/js/assets/weather-icons/SmartSymbol/${symbol}.svg`;
}