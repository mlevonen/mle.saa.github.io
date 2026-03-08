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

export async function updateWeatherPreview(
  stations,
  markerRegistry,
  createWeatherIcon
) {

  const weatherStations = stations.filter(
    s => s.type === "weather" && s.featured
  );

  for (const station of weatherStations) {

    const series = await fetchObservationSeriesByFmisid(
    station.fmisid
    );

    if (!series.length) return;

    const latest = series.at(-1);
    const symbolCode = Number(latest.smartsymbol);

    const icon = createWeatherIcon(
    latest.t2m,
    symbolCode
    );

    marker.setIcon(icon);

    updateWeatherMarker(
      station,
      value,
      markerRegistry,
      createWeatherIcon
    );

  }
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