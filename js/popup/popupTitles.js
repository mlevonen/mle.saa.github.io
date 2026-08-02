import { getLatestObservation } from "../utils/helpers.js";

export function updatePopupTitles(popupEl, data) {
  const wind = getLatestObservation(data.obsWindSpeed, "utctime", "windspeedms");
  const gust = getLatestObservation(data.obsWindSpeed, "utctime", "windgust");
  const pressure = getLatestObservation(data.obsPressure, "utctime", "pressure");

  // Lämpötilan pikanäyttö hoidetaan nyt renderTempCard()-funktiolla
  // (js/popup/popupExtras.js) – erillinen minigraafi ja sen otsikon
  // päivitys poistettu, koska tuntikohtainen sääennuste korvaa graafin.

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
