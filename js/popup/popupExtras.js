
import { getLatestObservation } from "../utils/helpers.js";

/* =========================================================
   DATA-HELPERIT
   ========================================================= */

// --- Sääsymbolin haku ---

function getSmartSymbol(series) {
  if (!Array.isArray(series)) return null;

  const now = Date.now();

  const latestPast = [...series]
    .filter(s => Number.isFinite(s.smartsymbol))
    .map(s => ({
      ...s,
      time: Date.parse(
        s.utctime.replace(
          /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
          "$1-$2-$3T$4:$5:$6Z"
        )
      )
    }))
    .filter(s => !Number.isNaN(s.time) && s.time <= now)
    .sort((a, b) => b.time - a.time)[0];

  return latestPast ? latestPast.smartsymbol : null;
}





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
console.log("renderPopupExtras CALLED");

export function renderPopupExtras(popupEl, data) {

  const content = popupEl.querySelector(".leaflet-popup-content");
  if (!content) return;

  let container = content.querySelector(".popup-extras");
  if (!container) {
    container = document.createElement("div");
    container.className = "popup-extras";
    content.prepend(container);
  }

  container.innerHTML = "";

  container.innerHTML += `
    <div class="popup-header">
      <div class="popup-location">
        ${data.locationName ?? ""}
      </div>
    </div>
  `;

  container.innerHTML += `<div class="popup-inline-metrics">`;

  const symbol = getSmartSymbol(data.obsWeather);

  if (symbol !== null) {
    container.innerHTML += `
      <div class="popup-inline-item">
        <img
          src="./js/assets/weather-icons/SmartSymbol/${symbol}.svg"
          class="popup-weather-icon"
        />
      </div>
    `;
  }

  // ... kaikki muu mittarikoodi ...

  container.innerHTML += `</div>`;
}


/* === ILMANPAINE === */

const pressure = getPressure(data.obsPressure);
const trend = getPressureTrend(data.obsPressure);

if (pressure != null) {
  const arrow =
    trend === "up" ? "▲" :
    trend === "down" ? "▼" :
    "▬";

  container.innerHTML += `
    <div class="popup-inline-item">
      <img
        src="./js/assets/icons/pressure.svg"
        class="popup-icon"
        alt="Ilmanpaine"
      />
      ${pressure.toFixed(0)} hPa ${arrow}
    </div>
  `;
}

/* === MERIVEDENKORKEUS === */

const sea = getSeaLevel(data);

if (sea != null) {
  container.innerHTML += `
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

/* === AURINGONNOUSU / -LASKU === */

if (data.sunTimes) {
  const sunrise = new Date(data.sunTimes.sunrise);
  const sunset = new Date(data.sunTimes.sunset);

  const format = (d) =>
    d.toLocaleTimeString("fi-FI", {
      hour: "2-digit",
      minute: "2-digit"
    });

  container.innerHTML += `
    <div class="popup-inline-item">
      <img
        src="./js/assets/icons/sunrise.svg"
        class="popup-icon"
        alt="Auringonnousu"
      />
      ${format(sunrise)}
    </div>
  `;

  container.innerHTML += `
    <div class="popup-inline-item">
      <img
        src="./js/assets/icons/sunset.svg"
        class="popup-icon"
        alt="Auringonlasku"
      />
      ${format(sunset)}
    </div>
  `;
}

container.innerHTML += `</div>`;
