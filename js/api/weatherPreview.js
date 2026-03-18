import { fetchObservationSeriesByFmisid } from "./dataLoader.js";
import { getSmartSymbol, smartSymbolIcon } from "../popup/popupExtras.js";


function createWeatherIcon(temp, symbol) {

  const iconUrl = symbol
    ? `/js/assets/weather-icons/SmartSymbol/${symbol}.svg`
    : "/js/assets/weather-icons/SmartSymbol/na.svg";

  const html = `
    <div class="weather-marker">
      <img src="${iconUrl}" class="weather-icon">
      <div class="weather-temp">${Math.round(temp)}°</div>
    </div>
  `;

  return L.divIcon({
    className: "weather-marker",
    html,
    iconSize: [42, 42]
  });
console.log("weatherPreview symbol:", symbol);
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
      data.symbol
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

    const symbol = getSmartSymbol(series);

    values[station.fmisid] = {
      temp: latest.t2m,
      symbol
    };

  }

  updateWeatherMarkers(
    values,
    markerRegistry
  );

}

