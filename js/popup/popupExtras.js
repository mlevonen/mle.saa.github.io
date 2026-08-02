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
   LÄMPÖTILA – pieni korttinsa (korvaa entisen minigraafin,
   koska tuntikohtainen sääennuste näyttää nyt kehityksen)
   ========================================================= */

export function renderTempCard(popupEl, data) {

  const card = popupEl.querySelector(".popup-temp-card");
  if (!card) return;

  const valueEl = card.querySelector(".popup-temp-value");
  if (!valueEl) return;

  const obs = Array.isArray(data.obsTemp) ? data.obsTemp : [];

  let latest = null;

  for (let i = obs.length - 1; i >= 0; i--) {
    const t = obs[i]?.temperature;
    if (Number.isFinite(t)) {
      latest = t;
      break;
    }
  }

  valueEl.textContent = latest != null ? `${latest.toFixed(1)} °C` : "–";

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

  // Auringon nousu/lasku -kortin yhteyteen yhdistetty tuntikohtainen
  // sääennustenauha (samasta ennustedatasta, joka on jo haettu
  // loadPopupDatassa – ei siis erillistä lisähakua).
  const hourlyEl = card.querySelector(".popup-hourly-forecast");
  const hourlyDayEl = card.querySelector(".popup-hourly-day");
  renderHourlyForecastStrip(hourlyEl, hourlyDayEl, data.fcTemp);

  card.style.display = "";
}


/* =========================================================
   TUNTIKOHTAINEN SÄÄENNUSTENAUHA (osa Aurinko-korttia)
   ========================================================= */

const MAX_HOURLY_ITEMS = 10;

function formatHourlyDayHeader(d) {
  const weekday = d.toLocaleDateString("fi-FI", { weekday: "short" });
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized} ${d.getDate()}.${d.getMonth() + 1}.`;
}

function renderHourlyForecastStrip(hourlyEl, hourlyDayEl, fcTemp) {

  if (!hourlyEl) return;

  const now = Date.now();

  const upcoming = Array.isArray(fcTemp)
    ? fcTemp
        .filter(p => new Date(p.utctime).getTime() >= now - 30 * 60 * 1000)
        .slice(0, MAX_HOURLY_ITEMS)
    : [];

  if (!upcoming.length) {
    hourlyEl.innerHTML = "";
    if (hourlyDayEl) hourlyDayEl.textContent = "";
    return;
  }

  if (hourlyDayEl) {
    hourlyDayEl.textContent = formatHourlyDayHeader(new Date(upcoming[0].utctime));
  }

  hourlyEl.innerHTML = upcoming.map(p => {

    const d = new Date(p.utctime);
    const icon = smartSymbolIcon(p.symbol);
    const temp = Number.isFinite(p.temperature) ? Math.round(p.temperature) : null;

    return `
      <div class="popup-hourly-item">
        <div class="popup-hourly-hour">${d.getHours()}</div>
        ${icon
          ? `<img src="${icon}" class="popup-hourly-icon" alt="">`
          : `<div class="popup-hourly-icon"></div>`}
        <div class="popup-hourly-temp">${temp != null ? temp + "°" : "–"}</div>
      </div>
    `;

  }).join("");

}


/* =========================================================
   AALLOKKO – oma korttinsa (vain rannikkoasemat)
   ========================================================= */

export function renderWaveCard(popupEl, data, station) {

  const card = popupEl.querySelector(".popup-wave-card");
  if (!card) return;

  if (station?.type !== "coastal" || !data.waveHeight) {
    card.style.display = "none";
    return;
  }

  const { height, period } = data.waveHeight;

  const heightEl = card.querySelector(".popup-wave-height-value");
  const periodEl = card.querySelector(".popup-wave-period-value");

  if (heightEl) {
    heightEl.textContent = Number.isFinite(height)
      ? `${height.toFixed(1)} m`
      : "–";
  }

  if (periodEl) {
    periodEl.textContent = Number.isFinite(period) ? `${period} s` : "–";
  }

  card.style.display = "";

}
