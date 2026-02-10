import { getLatestObservation } from "../utils/helpers.js";

/* =========================================================
   DATA-HELPERIT
   ========================================================= */

function getPressure(series) {
  if (!Array.isArray(series) || series.length === 0) return null;

  const latest = series.at(-1);
  return typeof latest.pressurehpa === "number"
    ? latest.pressurehpa
    : null;
}

function getPressureTrend(series, hours = 3) {
  if (!Array.isArray(series)) return null;

  const clean = series.filter(
    p => typeof p.pressurehpa === "number"
  );

  if (clean.length < hours + 1) return null;

  const current = clean.at(-1).pressurehpa;
  const past = clean.at(-(hours + 1)).pressurehpa;

  const diff = current - past;

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
  console.log("fcPressure:", data.fcPressure);
  // Tyhjennetään aina
  container.innerHTML = "";
  console.log("obsWindSpeed last:", data.obsWindSpeed?.at(-1));

  /* ==========================
     ILMANPAINE
     ========================== */

  const pressure = getPressure(data.obsWindSpeed);
  const trend = getPressureTrend(data.obsWindSpeed);


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
