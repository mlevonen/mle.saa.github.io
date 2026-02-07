import { getLatestObservation } from "../utils/helpers.js";

function getPressure(data) {
  return getLatestObservation(
    data.fcPressure,
    "utctime",
    "pressurehpa"
  );
}


function getPressureTrend(data, hours = 3) {
  const series = data.fcPressure
    .map(d => ({
      t: new Date(d.utctime),
      v: d.pressurehpa
    }))
    .filter(p => p.v != null);

  if (series.length < 2) return null;

  const now = Date.now();
  const current = series.find(p => p.t.getTime() >= now);
  if (!current) return null;

  const past = [...series]
    .reverse()
    .find(p => p.t.getTime() <= now - hours * 3600_000);

  if (!past) return null;

  const diff = current.v - past.v;

  if (diff > 1) return "up";
  if (diff < -1) return "down";
  return "steady";
}



export function renderPopupExtras(popupEl, data) {
  // 🔑 data on olemassa VAIN täällä
  const pressure = getPressure(data);
  const trend = getPressureTrend(data);
  
  console.log("obsWindSpeed sample", data.obsWindSpeed?.[0]);
  console.log("latest pressure", pressure);

  let container = popupEl.querySelector(".popup-extras");
  if (!container) {
    container = document.createElement("div");
    container.className = "popup-extras";
    popupEl.prepend(container);
  }

  if (!pressure) {
    container.innerHTML = "";
    return;
  }

const arrow =
  trend === "up" ? "↗" :
  trend === "down" ? "↘" :
  "→";

const pressureHtml = `
  <span class="popup-pressure">
    🌡️ ${pressure.v.toFixed(0)} hPa ${arrow}
  </span>
`;

container.innerHTML = `
  ${pressureHtml}
`;

}
