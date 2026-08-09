// ==========================
// Asemakortin sisältö – MOBIILINÄKYMÄ.
//
// Oma, siisti runko (ei desktopin stationDetail.js:n sivupalkki-
// layoutia, jota jouduttiin aiemmin väkisin CSS-overrideilla
// vääntämään mobiilinäkymään sopivaksi). Kortit pinotaan
// allekkain, graafit piilotetaan "Näytä graafit"-linkin taakse ja
// korvataan oletuksena skrollattavalla tekstimuotoisella
// tuulen aikajanalla (js/popup/windTimelineList.js).
//
// Tuulivirtausanimaatio säilyy, mutta liukusäädin/tuntinapit ovat
// nyt osa samaa pystysuuntaista virtausta kuin itse animaatio
// (ei enää erillisiä inline-leveyksiä tai pakotettuja flex-
// suuntia, jotka aiemmin ajoivat säätimet vahingossa sivun alalaitaan).
//
// mobileStationDetailHTML(station)  → HTML-runko.
// renderMobileStationDetail(containerEl, station) → täyttää rungon
//   datalla. Palauttaa { data, stop }.
// ==========================

import { loadPopupData } from "../api/dataLoader.js";
import { updatePopupTitles } from "./popupTitles.js";
import { renderPopupExtras, renderSunCard, renderWaveCard, renderTempCard } from "./popupExtras.js";
import { renderSeaLevelCard } from "./seaLevelCard.js";
import { renderWindFlowAnimation } from "./windFlowAnimation.js";
import { windTimelineListHTML, renderWindTimelineList } from "./windTimelineList.js";

export function mobileStationDetailHTML(station) {
  return `
    <div class="popup-title">${station.name}</div>
    <div class="popup-extras"></div>

    <div class="popup-note">
      ℹ️ Graafit perustuvat Ilmatieteen laitoksen dataan, tuuliennusteanimaatio Open-Meteon (MET Nordic) malliin. Eri ennustemallien vuoksi tuulilukemat voivat poiketa hieman toisistaan.
    </div>

    <div class="popup-card-inner popup-temp-card mobile-stack-card">
      <div class="mobile-card-label">Lämpötila</div>
      <div class="popup-temp-value">–</div>
    </div>

    <div class="popup-card-inner popup-sealevel-card mobile-stack-card">
      <div class="mobile-card-label">Vedenkorkeus</div>
      <div class="wind-flow-sealevel-row">
        <span class="wind-flow-sealevel-label">Keskivesi</span>
        <span class="wind-flow-sealevel-value" data-kind="watlev">–</span>
      </div>
      <div class="wind-flow-sealevel-row">
        <span class="wind-flow-sealevel-label">N2000</span>
        <span class="wind-flow-sealevel-value" data-kind="n2000">–</span>
      </div>
    </div>

    <div class="popup-card-inner popup-wave-card mobile-stack-card" style="display:none;">
      <div class="mobile-card-label">Aallokko</div>
      <div class="popup-wave-row">
        <span class="popup-wave-height-value">–</span>
        <span class="popup-wave-period-label">jakso <span class="popup-wave-period-value">–</span></span>
      </div>
    </div>

    <div class="popup-card-inner popup-sun-card mobile-stack-card" style="display:none;">
      <div class="mobile-card-label">Sää</div>
      <div class="popup-sun-row">
        <div class="popup-inline-item">
          <img src="./js/assets/icons/sunrise.svg" class="popup-icon" alt="Auringonnousu">
          <span class="popup-sunrise-value">–</span>
        </div>
        <div class="popup-inline-item">
          <img src="./js/assets/icons/sunset.svg" class="popup-icon" alt="Auringonlasku">
          <span class="popup-sunset-value">–</span>
        </div>
      </div>
      <div class="popup-hourly-day"></div>
      <div class="popup-hourly-forecast"></div>
    </div>

    ${windTimelineListHTML()}

    <div class="popup-card">
      <div class="wind-flow-title-row">
        <strong>Tuuliennusteanimaatio</strong>
        <span class="wind-flow-speed-label"></span>
      </div>

      <div class="wind-flow-wrapper">
        <canvas class="wind-flow-bg" width="320" height="320"></canvas>
        <canvas
          class="wind-flow-canvas"
          width="320"
          height="320"
          data-lat="${station.lat}"
          data-lon="${station.lon}"
        ></canvas>
      </div>

      <div class="wind-flow-slider-row">
        <input
          type="range"
          class="wind-flow-slider"
          min="0"
          max="0"
          step="1"
          value="0"
        >
        <span class="wind-flow-time-label">Nyt</span>
      </div>

      <div class="wind-flow-ticks-row">
        <div class="wind-flow-ticks"></div>
      </div>

      <div class="wind-flow-controls">
        <button type="button" class="wind-flow-btn" data-offset="2">💨 2h</button>
        <button type="button" class="wind-flow-btn" data-offset="6">💨 6h</button>
        <button type="button" class="wind-flow-btn" data-offset="12">💨 12h</button>
        <button type="button" class="wind-flow-btn" data-offset="18">💨 18h</button>
        <button type="button" class="wind-flow-btn" data-offset="24">💨 24h</button>
        <button type="button" class="wind-flow-btn wind-flow-btn-last" data-offset="24">💨 …</button>
      </div>
    </div>
  `;
}

export async function renderMobileStationDetail(containerEl, station) {

  try {

    const data = await loadPopupData({
      lat: station.lat,
      lon: station.lon,
      weatherPlace: null,
      weatherFmisid: station.fmisid,
      seaLevelFmisid: null,
      // Maa-asemille (station.inland) ei haeta aallonkorkeutta,
      // vaikka niiden type onkin "coastal" – ne eivät ole meren rannalla.
      includeWave: station.type === "coastal" && !station.inland
    });

    updatePopupTitles(containerEl, data);
    renderPopupExtras(containerEl, data);
    renderSunCard(containerEl, data);
    renderWaveCard(containerEl, data, station);
    renderTempCard(containerEl, data);

    // Vedenkorkeus (sama logiikka kuin desktopilla, jaettu moduuli).
    await renderSeaLevelCard(containerEl, station);

    // Tekstimuotoinen tuulen aikajana + graafit lazy-toggle-linkin taakse.
    renderWindTimelineList(containerEl, data);

    // Tuulen virtaus (Open-Meteo, animoitu hiukkaskenttä) + napit/liukusäädin.
    const { stop } = await renderWindFlowAnimation(containerEl, station.lat, station.lon);

    return { data, stop };

  } catch (err) {
    console.error("Mobiilin asemakortin lataus epäonnistui:", err);
    return { data: null, stop: () => {} };
  }

}
