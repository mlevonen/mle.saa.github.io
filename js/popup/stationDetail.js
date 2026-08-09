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

export function stationDetailHTML(station) {
  return `
    <div class="popup-title">${station.name}</div>
    <div class="popup-extras"></div>

    <div class="popup-note">
      ℹ️ Graafit perustuvat Ilmatieteen laitoksen dataan, tuuliennusteanimaatio Open-Meteon (MET Nordic) malliin. Eri ennustemallien vuoksi tuulilukemat voivat poiketa hieman toisistaan.
    </div>

    <div class="popup-card">
      <div><strong>Tuuli (havainto)</strong></div>
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

    <div class="popup-card">
      <div><strong>Tuuli (ennuste)</strong></div>
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
        <div class="wind-flow-sidebar" style="display:flex; flex-direction:column; gap:8px; width:345px;">
          <div class="popup-card-inner popup-temp-card">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Lämpötila</div>
            <div class="popup-temp-value">–</div>
          </div>

          <div class="popup-card-inner popup-sealevel-card">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Vedenkorkeus</div>
            <div class="wind-flow-sealevel-row">
              <span class="wind-flow-sealevel-label">Keskivesi</span>
              <span class="wind-flow-sealevel-value" data-kind="watlev">–</span>
            </div>
            <div class="wind-flow-sealevel-row">
              <span class="wind-flow-sealevel-label">N2000</span>
              <span class="wind-flow-sealevel-value" data-kind="n2000">–</span>
            </div>
          </div>

          <div class="popup-card-inner popup-wave-card" style="display:none;">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Aallokko</div>
            <div class="popup-wave-row">
              <span class="popup-wave-height-value">–</span>
              <span class="popup-wave-period-label">jakso <span class="popup-wave-period-value">–</span></span>
            </div>
          </div>

          <div class="popup-card-inner popup-sun-card" style="display:none;">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Sää</div>
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

    // Lähimmän vedenkorkeusaseman lukemat sivupalkkiin (sekä
    // keskiveteen suhteutettu WATLEV että N2000-lukema). Maa-
    // asemille (station.inland) koko kortti piilotetaan – lähin
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
