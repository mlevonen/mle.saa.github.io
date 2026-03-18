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
    return "/js/assets/weather-icons/SmartSymbol/na.svg";
  }

  return `/js/assets/weather-icons/SmartSymbol/${code}.svg`;

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

  const pressure = getPressure(data.obsPressure);
  const trend = getPressureTrend(data.obsPressure);

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

  /* === SÄÄSYMBOLI === */

  const symbolCode = data.symbolNow ?? null;

  html += `
    <div class="popup-inline-item">
      <img
        src="${
          symbolCode
            ? `/js/assets/weather-icons/SmartSymbol/${symbolCode}.svg`
            : "/js/assets/weather-icons/SmartSymbol/na.svg"
        }"
        class="popup-weather-icon"
        alt="Sääsymboli"
      />
    </div>
  `;

  /* === ILMANPAINE === */

  const pressure = getPressure(data.obsPressure);
  const trend = getPressureTrend(data.obsPressure);

  if (pressure != null) {
    const arrow =
      trend === "up" ? "▲" :
      trend === "down" ? "▼" :
      "▬";

    html += `
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

  /* === AURINGONNOUSU / -LASKU === */

  if (data.sunTimes) {
    const sunrise = new Date(data.sunTimes.sunrise);
    const sunset = new Date(data.sunTimes.sunset);

    const format = (d) =>
      d.toLocaleTimeString("fi-FI", {
        hour: "2-digit",
        minute: "2-digit"
      });

    html += `
      <div class="popup-inline-item">
        <img
          src="./js/assets/icons/sunrise.svg"
          class="popup-icon"
          alt="Auringonnousu"
        />
        ${format(sunrise)}
      </div>
    `;

    html += `
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

  // ✅ TÄMÄ KUULUU FUNKTION SISÄÄN
  container.innerHTML = html;
}
