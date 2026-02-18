import { getLatestObservation } from "../utils/helpers.js";

export function updatePopupTitles(popupEl, data) {
  const temp = getLatestObservation(data.obsTemp, "utctime", "temperature");
  const wind = getLatestObservation(data.obsWindSpeed, "utctime", "windspeedms");
  const gust = getLatestObservation(data.obsWindSpeed, "utctime", "windgust");
  const pressure = getLatestObservation(data.obsPressure, "utctime", "pressure");




  const tempTitle = popupEl.querySelector(
  'canvas[data-type="temp"]'
  )?.previousElementSibling;

  if (temp && tempTitle) {
  tempTitle.textContent =
    `Lämpötila ${temp.v.toFixed(1)} °C`;
  }

  
 if (wind) {
  const windObsTitle = popupEl.querySelector(
    'canvas[data-type="wind-obs"]'
  )?.previousElementSibling;

  if (windObsTitle) {
    windObsTitle.textContent =
      `Tuuli ${wind.v.toFixed(1)} m/s` +
      (gust ? ` (puuskat ${gust.v.toFixed(1)} m/s)` : "");
  }
}}
