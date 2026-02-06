import { getLatestObservation } from "../utils/helpers.js";
import { weatherCodeToIcon } from "./weatherIcons.js";

export function renderPopupExtras(popupEl, data) {
  const weather = getLatestObservation(
    data.obsTemp,
    "utctime",
    "weathercode"
  );

  const iconFile = weather
    ? weatherCodeToIcon(weather.v)
    : null;

  let container = popupEl.querySelector(".popup-extras");
  if (!container) {
    container = document.createElement("div");
    container.className = "popup-extras";
    popupEl.prepend(container);
  }

  container.innerHTML = `
    ${iconFile ? `
      <img
        src="/js/assets/weather-icons/${iconFile}"
        class="weather-icon"
        alt="Sääsymboli"
      />
    ` : ""}
  `;
}
