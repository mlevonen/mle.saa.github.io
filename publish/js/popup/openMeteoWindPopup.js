import { renderWindFlowAnimation } from "./windFlowAnimation.js"; export function openMeteoWindPopupHTML(station) { return `
    <div class="popup-title">${station.name}</div>

    <div class="popup-note">
      ℹ️ Tuuliennuste Open-Meteon säämallista (ei Ilmatieteen laitoksen havaintoa). Havaintoja, lämpötilaa tai vedenkorkeutta ei ole saatavilla tälle pisteelle.
    </div>

    <div class="popup-card">
      <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
        <strong>Tuuliennusteanimaatio</strong>
        <span class="wind-flow-speed-label" style="font-size:12px; font-weight:bold; color:#444;"></span>
      </div>

      <div class="wind-flow-wrapper" style="position:relative; width:320px; height:320px;">
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
  `; }     export async function renderOpenMeteoWindPopup(containerEl, station) { const { stop } = await renderWindFlowAnimation(containerEl, station.lat, station.lon); return stop; }
