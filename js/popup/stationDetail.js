// ==========================
// Asemakortin sisältö – jaettu desktop-popupin JA mobiilinäkymän
// kesken.
//
// stationDetailHTML(station)  → HTML-runko (samat luokat/rakenne
//   kuin ennen suoraan main.js:n marker.bindPopup()-kutsussa).
// renderStationDetail(containerEl, station) → täyttää rungon
//   datalla (havainnot, ennusteet, tuulivirtausanimaatio ym.).
//   Palauttaa { data, stop } – stop() pysäyttää mahdollisen
//   käynnissä olevan tuulivirtausanimaation.
//
// Kumpikaan funktio ei tiedä mitään Leafletista – containerEl voi
// olla mikä tahansa DOM-elementti (Leaflet-popupin sisältöelementti
// TAI tavallinen <div> mobiilinäkymän asemakortissa).
// ==========================

import { loadPopupData } from "../api/dataLoader.js";
import { updatePopupTitles } from "./popupTitles.js";
import { renderPopupExtras, renderSunCard, renderWaveCard, renderTempCard } from "./popupExtras.js";
import { renderWindCharts } from "../charts/windChart.js";
import { renderSeaLevelCard } from "./seaLevelCard.js";
import { renderWindFlowAnimation } from "./windFlowAnimation.js";
import { currentConditionsCardHTML, renderCurrentWindSummary, renderCurrentSunTimes } from "./currentConditionsCard.js";

export function stationDetailHTML(station) {
  return `
    ${currentConditionsCardHTML(station)}

    <div class="popup-note">
      ℹ️ Graafit perustuvat Ilmatieteen laitoksen dataan, tuuliennusteanimaatio Open-Meteon (MET Nordic) malliin. Eri ennustemallien vuoksi tuulilukemat voivat poiketa hieman toisistaan.
    </div>

    <div class="popup-card">
      <div class="wind-obs-card-title"><strong>Tuuli (havainto)</strong></div>
      <div class="popup-chart-wrapper">
        <canvas
          class="popup-chart"
          width="650"
          height="140"
          data-lat="${station.lat}"
          data-lon="${station.lon}"
          data-fmisid="${station.fmisid}"
          data-type="wind-obs"
        ></canvas>
      </div>
    </div>

    <div class="popup-card">
      <div><strong>Tuuli (ennuste)</strong></div>
      <div class="popup-chart-wrapper">
        <canvas
          class="popup-chart"
          width="650"
          height="140"
          data-lat="${station.lat}"
          data-lon="${station.lon}"
          data-fmisid="${station.fmisid}"
          data-type="wind-fc"
        ></canvas>
      </div>
    </div>

    <div class="popup-card">
      <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
        <strong>Tuuliennusteanimaatio</strong>
        <span class="wind-flow-speed-label" style="font-size:12px; font-weight:bold; color:#444;"></span>
      </div>
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <div class="wind-flow-wrapper" style="position:relative; width:320px; height:320px; flex-shrink:0;">
          <canvas
            class="wind-flow-bg"
            width="320"
            height="320"
            style="position:absolute; top:0; left:0;"
          ></canvas>
          <canvas
            class="wind-flow-canvas"
            width="320"
            height="320"
            style="position:absolute; top:0; left:0;"
            data-lat="${station.lat}"
            data-lon="${station.lon}"
          ></canvas>
        </div>
        <div class="wind-flow-sidebar" style="display:flex; flex-direction:column; gap:8px; width:220px;">
          <!-- Lämpötila, Vedenkorkeus ja Aallokko näkyvät nyt ylimmässä
               yhteenvetokortissa (ks. currentConditionsCard.js) – ei
               enää toisteta tässä. Tuntikohtainen sääennustenauha
               (aiemmin osa "Sää"-korttia yhdessä auringonnousu/lasku-
               tietojen kanssa) jää edelleen tänne, koska se näyttää
               tulevan kehityksen eikä pelkkää hetkellistä lukemaa;
               .popup-sun-card-luokka ja renderSunCard() säilyvät
               muuttumattomina (sunrise/sunset-elementit vain puuttuvat
               tästä kortista, minkä renderSunCard käsittelee
               turvallisesti). -->
          <div class="popup-card-inner popup-sun-card" style="display:none;">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Sääennuste</div>
            <div class="popup-hourly-day"></div>
            <div class="popup-hourly-forecast"></div>
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px; margin-top:8px; width:320px;">
        <input
          type="range"
          class="wind-flow-slider"
          min="0"
          max="0"
          step="1"
          value="0"
          style="flex:1;"
        >
        <span class="wind-flow-time-label" style="font-size:12px; color:#444; min-width:78px; text-align:right;">Nyt</span>
      </div>
      <div style="display:flex; gap:8px; width:320px;">
        <div class="wind-flow-ticks" style="display:flex; justify-content:space-between; flex:1;"></div>
        <div style="min-width:78px;"></div>
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

export async function renderStationDetail(containerEl, station) {

  try {

    const data = await loadPopupData({
      lat: station.lat,
      lon: station.lon,
      weatherPlace: null,
      weatherFmisid: station.fmisid,
      seaLevelFmisid: null,
      // Maa-asemille (ent. Yr-asemat, station.inland) ei haeta
      // aallonkorkeutta, vaikka niiden type onkin "coastal" – ne
      // eivät ole meren rannalla.
      includeWave: station.type === "coastal" && !station.inland
    });

    updatePopupTitles(containerEl, data);
    renderPopupExtras(containerEl, data);
    renderSunCard(containerEl, data);
    renderWaveCard(containerEl, data, station);
    renderTempCard(containerEl, data);
    renderWindCharts(containerEl, data);

    // Ylimmän yhteenvetokortin tuuli (havainto) + auringon nousu/lasku.
    // Lämpötila, vedenkorkeus ja aallokko käyttävät samoja jaettuja
    // funktioita kuin ennen (renderTempCard/renderWaveCard yllä,
    // renderSeaLevelCard alla) – ne löytävät elementit uudesta
    // sijainnista automaattisesti, koska hakevat aina koko
    // containerElistä eivätkä ole sidottuja mihinkään tiettyyn
    // vanhempaan.
    renderCurrentWindSummary(containerEl, data);
    renderCurrentSunTimes(containerEl, data);

    // Lähimmän vedenkorkeusaseman lukemat (sekä keskiveteen
    // suhteutettu WATLEV että N2000-lukema). Maa-asemille
    // (station.inland) koko kortti piilotetaan – lähin
    // vedenkorkeusasema voisi olla satoja kilometrejä päässä eikä
    // lukema liity mitenkään kyseiseen sisämaan pisteeseen.
    await renderSeaLevelCard(containerEl, station);

    // Tuulen virtaus (Open-Meteo, animoitu hiukkaskenttä) + napit/liukusäädin
    const { stop } = await renderWindFlowAnimation(containerEl, station.lat, station.lon);

    return { data, stop };

  } catch (err) {
    console.error("Asemakortin lataus epäonnistui:", err);
    return { data: null, stop: () => {} };
  }

}
