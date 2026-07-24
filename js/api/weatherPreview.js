import { fetchObservationSeriesByFmisid } from "./dataLoader.js";
import { getSmartSymbol, smartSymbolIcon } from "../popup/popupExtras.js";


function createWeatherIcon(temp, symbol) {

  // Ei näytetä ikonia lainkaan jos symbolia ei ole saatavilla
  // (ei "pilvi + N/A" -oletuskuvaketta)
  const iconHtml = symbol
    ? `<img src="/js/assets/weather-icons/SmartSymbol/${symbol}.svg" class="weather-icon">`
    : "";

  const html = `
    <div class="weather-marker">
      ${iconHtml}
      <div class="weather-temp">${Math.round(temp)}°</div>
    </div>
  `;

  return L.divIcon({
    className: "weather-marker",
    html,
    iconSize: [42, 42]
  });

}


function updateWeatherMarkers(values, markerRegistry) {

  Object.entries(values).forEach(([fmisid, data]) => {

    const marker = markerRegistry[fmisid];
    if (!marker) return;

    // WeatherPreview saa muuttaa vain weather-markkereita
    if (marker.station?.type !== "weather") return;

    if (
      marker.previewData?.temp === data.temp &&
      marker.previewData?.symbol === data.symbol
    ) {
      return;
    }

    marker.previewData = marker.previewData || {};
    marker.previewData.temp = data.temp;
    marker.previewData.symbol = data.symbol;

    const icon = createWeatherIcon(
      data.temp,
      data.symbolNow ?? 4
    );

    marker.setIcon(icon);

  });

}



export async function updateWeatherPreview(
  stations,
  markerRegistry
) {

  const weatherStations = stations.filter(
    s => s.type === "weather" && s.featured
  );

  const values = {};

  for (const station of weatherStations) {

    const series = await fetchObservationSeriesByFmisid(
      station.fmisid
    );

    if (!series.length) continue;

    const latest = series.at(-1);

    values[station.fmisid] = {
      temp: latest.temperature,
      symbolNow: getSmartSymbol(series)
    };

  }

  updateWeatherMarkers(
    values,
    markerRegistry
  );

}

