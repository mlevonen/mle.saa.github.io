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

  // HUOM: päivitetään sisemmän <strong>-elementin teksti, ei koko
  // otsikkodivin textContent – muuten <strong>-kääre katoaa ja
  // otsikko näyttää lihavoimattomalta heti popupin avautuessa.
  const windObsStrong = windObsTitle?.querySelector("strong") || windObsTitle;

  if (windObsStrong) {
    windObsStrong.textContent =
      `Tuuli ${wind.v.toFixed(1)} m/s` +
      (gust ? ` (puuskat ${gust.v.toFixed(1)} m/s)` : "");
  }
}}
