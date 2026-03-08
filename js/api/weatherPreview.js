import { fetchObservationSeriesByFmisid } from "./dataLoader.js";
import { getSmartSymbol, smartSymbolIcon } from "../popup/popupExtras.js";

const symbolCode = getSmartSymbol(series);

const icon = smartSymbolIcon(symbolCode);

function createWeatherIcon(temp, symbolCode) {

  const iconUrl = smartSymbolIcon(symbolCode);

  const html = `
    <div class="weather-marker">
      <img src="${iconUrl}" class="weather-icon">
      <div class="weather-temp">${Math.round(temp)}°</div>
    </div>
  `;

  return L.divIcon({
    className: "weather-marker",
    html,
    iconSize: [42,42]
  });

}

function updateWeatherMarkers(values, markerRegistry, createWeatherIcon) {

  Object.entries(values).forEach(([fmisid, data]) => {

    const marker = markerRegistry[fmisid];
    if (!marker) return;

    if (marker.previewData?.temp === data.temp &&
        marker.previewData?.symbol === data.symbol) {
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
  markerRegistry,
  createWeatherIcon
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
    markerRegistry,
    createWeatherIcon
  );

}

function createWeatherIcon(temp, symbol) {

  const iconUrl = smartSymbolIcon(symbol);

  const html = `
    <div class="weather-marker">
      <img src="${iconUrl}" class="weather-icon">
      <div class="weather-temp">${Math.round(temp)}°</div>
    </div>
  `;

  return L.divIcon({
    className: "weather-marker",
    html,
    iconSize: [42,42]
  });

}

function updateWeatherMarker(
  station,
  value,
  markerRegistry,
  createWeatherIcon
) {

  const marker = markerRegistry[station.fmisid];
  if (!marker) return;

  marker.setIcon(
    createWeatherIcon(value)
  );
}

