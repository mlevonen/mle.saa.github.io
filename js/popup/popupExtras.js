import { getLatestObservation } from "../utils/helpers.js";

/* =========================================================
   DATA-HELPERIT
   ========================================================= */

// --- Sääsymbolin haku ---

export function getSmartSymbol(series) {

  if (!Array.isArray(series) || !series.length) {
    return null;
  }

  for (let i = series.length - 1; i >= 0; i--) {

    const code = Number(series[i].smartsymbol);

    if (Number.isFinite(code) && code > 0) {
      return code;
    }

  }

  return null;
}


export function smartSymbolIcon(code) {

  if (!Number.isFinite(code)) {
    return null;
  }

  return `/js/assets/weather-icons/SmartSymbol/${code}.svg`;

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
  const container = popupEl.querySelector(".popup-extras");
  if (!container) return;

  let html = "";

  /* === MERIVEDENKORKEUS === */

  const sea = getSeaLevel(data);

  if (sea != null) {
    html += `
      <div class="popup-inline-item">
        <img
          src="./js/assets/icons/sealevel.svg"
          class="popup-icon"
          alt="Merivedenkorkeus"
        />
        ${sea > 0 ? "+" : ""}${sea} cm
      </div>
    `;
  }

  // ✅ TÄMÄ KUULUU FUNKTION SISÄÄN
  container.innerHTML = html;
}


/* =========================================================
   AURINGONNOUSU / -LASKU – oma korttinsa
   ========================================================= */

function formatSunTime(d) {
  return d.toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function renderSunCard(popupEl, data) {

  const card = popupEl.querySelector(".popup-sun-card");
  if (!card) return;

  if (!data.sunTimes) {
    card.style.display = "none";
    return;
  }

  const sunriseEl = card.querySelector(".popup-sunrise-value");
  const sunsetEl = card.querySelector(".popup-sunset-value");

  const sunrise = new Date(data.sunTimes.sunrise);
  const sunset = new Date(data.sunTimes.sunset);

  if (sunriseEl) sunriseEl.textContent = formatSunTime(sunrise);
  if (sunsetEl) sunsetEl.textContent = formatSunTime(sunset);

  card.style.display = "";
}
