import { getLatestObservation } from "../utils/helpers.js";

export function updatePopupTitles(popupEl, data) {
  const temp = getLatestObservation(data.obsTemp, "utctime", "temperature");
  const wind = getLatestObservation(data.obsWindSpeed, "utctime", "windspeedms");
  const gust = getLatestObservation(data.obsWindSpeed, "utctime", "windgust");

  if (temp) {
    popupEl.querySelector(
      'div:has(+ canvas[data-type="temp"])'
    ).textContent = `Lämpötila ${temp.v.toFixed(1)} °C`;
  }

  
  if (wind) {
    popupEl.querySelector(
      'div:has(+ canvas[data-type="wind"])'
    ).textContent =
      `Tuuli ${wind.v.toFixed(1)} m/s` +
      (gust ? ` (puuskat ${gust.v.toFixed(1)} m/s)` : "");
  }
}
