import { getLatestObservation } from "../utils/helpers.js";

/* =========================================================
   DATA-HELPERIT
   ========================================================= */

// --- Ilmanpaine (hPa, numero) ---
function getPressure(data) {
  const obs = getLatestObservation(
    data.fcPressure,
    "utctime",
    "pressurehpa"
  );
  return obs?.pressurehpa ?? null;
}

// --- Ilmanpaineen trendi (up / down / steady) ---
function getPressureTrend(data, hours = 3) {
  if (!Array.isArray(data.fcPressure)) return null;

  const series = data.fcPressure
    .map(d => ({
      t: new Date(d.utctime).getTime(),
      v: d.pressurehpa
    }))
    .filter(p => p.v != null && !isNaN(p.t));

  if (series.length < 2) return null;

  const now = Date.now();

  const current = [...series]
    .reverse()
    .find(p => p.t <= now);
  if (!current) return null;

  const past = [...series]
    .reverse()
    .find(p => p.t <= now - hours * 3600_000);
  if (!past) return null;

  const diff = current.v - past.v;

  if (diff > 0.5) return "up";
  if (diff < -0.5) return "down";
  return "steady";
}

// --- Merivedenkorkeus (cm, numero) ---
function getSeaLevel(data) {
  const sea = data.seaLevel;

  // suora numero
  if (typeof sea === "number") return sea;

  // objekti
  if (sea && typeof sea.sealevel === "number") {
    return sea.sealevel;
  }

  // aikasarja
  if (Array.isArray(sea)) {
    const latest = sea.at(-1);
    return latest?.sealevel ?? null;
  }

  return null;
}



/* =========================================================
   RENDER
   ========================================================= */

export function renderPopupExtras(popupEl, data) {
  const content = popupEl.querySelector(".leaflet-popup-content");
  if (!content) return;

  let container = content.querySelector(".popup-extras");
  if (!container) {
    container = document.createElement("div");
    container.className = "popup-extras";
    content.prepend(container);
  }

  // Tyhjennetään aina
  container.innerHTML = "";

  /* ==========================
     ILMANPAINE
     ========================== */

  const pressure = getPressure(data);
  const trend = getPressureTrend(data);

  if (pressure != null) {
    const arrow =
      trend === "up" ? "▲" :
      trend === "down" ? "▼" :
      "▬";

    container.innerHTML += `
      <span class="popup-pressure">
        🌡️ ${pressure.toFixed(0)} hPa ${arrow}
      </span>
    `;
  }

  /* ==========================
     MERIVEDENKORKEUS
     ========================== */

  const sea = getSeaLevel(data);

  if (sea != null) {
    container.innerHTML += `
      <span class="popup-sealevel">
        <img
          src="/js/assets/icons/sealevel.svg"
          class="popup-sealevel-icon"
          alt="Merivedenkorkeus"
        />
        ${sea > 0 ? "+" : ""}${sea} cm
      </span>
    `;
  }
}
