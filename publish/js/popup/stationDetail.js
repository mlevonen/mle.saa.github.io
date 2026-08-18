import { loadPopupData } from "../api/dataLoader.js"; import { updatePopupTitles } from "./popupTitles.js"; import { renderPopupExtras, renderSunCard, renderWaveCard, renderTempCard } from "./popupExtras.js"; import { renderWindCharts } from "../charts/windChart.js"; import { renderSeaLevelCard } from "./seaLevelCard.js"; import { renderWindFlowAnimation } from "./windFlowAnimation.js"; import { currentConditionsCardHTML, renderCurrentWindSummary, renderCurrentSunTimes, updateMergedCardVisibility } from "./currentConditionsCard.js"; export function stationDetailHTML(station) { return `
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

      <!-- Sivupalkki (lämpötila/vedenkorkeus/aallokko/sääennuste)
           poistui – kaikki siirtyivät ylimpään yhteenvetokorttiin.
           Animaatio levitetty samaan leveyteen graafien kanssa
           (.wind-flow-wrapper on nyt 100 % leveä samalla
           kääre+kiinteä-korkeus-periaatteella kuin .popup-chart-
           wrapper). Kanvaasien todellinen piirtoresoluutio
           synkronoidaan niiden näytettyyn kokoon windFlowAnimation.js:
           ssä, joten animaatio pysyy terävänä myös ei-neliömäisenä. -->
      <div class="wind-flow-wrapper">
        <canvas class="wind-flow-bg"></canvas>
        <canvas
          class="wind-flow-canvas"
          data-lat="${station.lat}"
          data-lon="${station.lon}"
        ></canvas>
      </div>

      <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
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
      <div style="display:flex; gap:8px;">
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
  `; } export async function renderStationDetail(containerEl, station) { try { const data = await loadPopupData({ lat: station.lat, lon: station.lon, weatherPlace: null, weatherFmisid: station.fmisid, seaLevelFmisid: null,       includeWave: station.type === "coastal" && !station.inland }); updatePopupTitles(containerEl, data); renderPopupExtras(containerEl, data); renderSunCard(containerEl, data); renderWaveCard(containerEl, data, station); renderTempCard(containerEl, data); renderWindCharts(containerEl, data);               renderCurrentWindSummary(containerEl, data); renderCurrentSunTimes(containerEl, data);           await renderSeaLevelCard(containerEl, station);         updateMergedCardVisibility(containerEl);   const { stop } = await renderWindFlowAnimation(containerEl, station.lat, station.lon); return { data, stop }; } catch (err) { console.error("Asemakortin lataus epäonnistui:", err); return { data: null, stop: () => {} }; } }
