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
import {
  currentConditionsCardHTML,
  renderCurrentWindSummary,
  renderCurrentSunTimes,
  updateMergedCardVisibility
} from "./currentConditionsCard.js";

export function mobileStationDetailHTML(station) {
  return `
    <!-- Sama tumma "tämän hetkinen tilanne" -yläkortti kuin
         desktopilla (js/popup/currentConditionsCard.js, täysin
         jaettu funktio – ei mobiilikopiota). Sisältää nyt myös
         aiemmin täällä olleen aseman nimen ja popup-extrasit, joten
         niitä ei enää tulosteta erikseen. Yksittäiset Lämpötila-,
         Vedenkorkeus-, Aallokko- ja Sää-kortit poistettiin tämän
         ALTA (ks. renderMobileStationDetail), koska samat tiedot
         näkyvät nyt tässä kortissa. mobile.html:n oma CSS asettelee
         alakortit yhteen sarakkeeseen kolmen sijaan, koska mobiili
         on kapeampi kuin desktop-popup. -->
    ${currentConditionsCardHTML(station)}

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

    <!-- Aallokko, Vedenkorkeus, Lämpötila ja Sää (tuntiennuste) ovat
         nyt yläkortin sisällä (currentConditionsCardHTML) – erilliset
         kortit poistettu, jotta samat tiedot eivät näy kahdesti.
         renderWaveCard/renderSeaLevelCard/renderTempCard/renderSunCard
         (alla renderMobileStationDetailissä) täyttävät edelleen samat
         .popup-wave-card/.popup-sealevel-card/.popup-temp-card/
         .popup-sun-card -elementit, mutta nyt ne löytyvät yläkortin
         sisältä, koska funktiot etsivät ne aina koko containerElistä. -->

    <div class="popup-note">
      ℹ️ Graafit perustuvat Ilmatieteen laitoksen dataan, tuuliennusteanimaatio Open-Meteon (MET Nordic) malliin. Eri ennustemallien vuoksi tuulilukemat voivat poiketa hieman toisistaan.
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

    // Yläkortin tuuli (havainto) + auringon nousu/lasku – sama jaettu
    // logiikka kuin desktopilla (ks. stationDetail.js).
    renderCurrentWindSummary(containerEl, data);
    renderCurrentSunTimes(containerEl, data);

    // Vedenkorkeus (sama logiikka kuin desktopilla, jaettu moduuli).
    await renderSeaLevelCard(containerEl, station);

    // Vasta kun renderSeaLevelCard/renderWaveCard ovat asettaneet omat
    // näkyvyytensä, voidaan päätellä pitääkö koko yhdistetty
    // Vedenkorkeus+Aallokko-alakortti piilottaa kokonaan (esim.
    // sisämaan asemalla, jolla ei ole kumpaakaan).
    updateMergedCardVisibility(containerEl);

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
