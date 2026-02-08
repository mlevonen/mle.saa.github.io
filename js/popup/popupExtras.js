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

function getSeaLevel(data) {
  if (!Array.isArray(data.seaLevel)) return null;

  const latest = data.seaLevel.at(-1);
  if (!latest?.sealevel) return null;

  return latest.sealevel; // cm
}


console.log("POPUP EXTRAS DATA", data);
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
// tyhjennetään sisältö aina aluksi
container.innerHTML = "";

// ==========================
// ILMANPAINE (vain jos on dataa)
// ==========================
if (pressure) {
  const arrow =
    trend === "up" ? "↗" :
    trend === "down" ? "↘" :
    "→";

  container.innerHTML += `
    <span class="popup-pressure">
      🌡️ ${pressure.v.toFixed(0)} hPa ${arrow}
    </span>
  `;
}

// ==========================
// MERIVEDENKORKEUS (ajetaan AINA)
// ==========================
const sea = getSeaLevel(data);
if (sea != null) {
  container.innerHTML += `
    <span class="popup-sealevel">
      🌊 ${sea > 0 ? "+" : ""}${sea} cm
    </span>
  `;
}}
