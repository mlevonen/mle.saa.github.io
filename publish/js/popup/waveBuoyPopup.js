import { fetchWaveBuoyObservation } from "../api/waveHeight.js"; const MAX_WAVE_ESTIMATE_FACTOR = 1.8; export async function renderWaveBuoyPopup(popup, station) { const popupEl = popup.getElement(); if (!popupEl) return; const bodyEl = popupEl.querySelector(".wave-buoy-body"); if (!bodyEl) return; bodyEl.innerHTML = `<div class="info-panel-loading">Ladataan…</div>`; try { const obs = await fetchWaveBuoyObservation(station.fmisid); if (!obs || obs.height == null) { bodyEl.innerHTML = `<div class="info-panel-empty">Havaintoa ei juuri nyt saatavilla.</div>`; return; } const estimatedMax = Number.isFinite(obs.height) ? obs.height * MAX_WAVE_ESTIMATE_FACTOR : null; const rows = [ ["Merkitsevä aallonkorkeus", Number.isFinite(obs.height) ? `${obs.height.toFixed(1)} m` : "–"], ["Korkein aalto (arvio)", estimatedMax != null ? `~${estimatedMax.toFixed(1)} m` : "–"], ["Aallon jakso", Number.isFinite(obs.period) ? `${obs.period.toFixed(1)} s` : "–"], ["Tulosuunta", Number.isFinite(obs.direction) ? `${Math.round(obs.direction)}°` : "–"], ["Veden lämpötila", Number.isFinite(obs.waterTemp) ? `${obs.waterTemp.toFixed(1)} °C` : "–"] ]; bodyEl.innerHTML = rows.map(([label, value]) => `
      <div class="wave-buoy-row">
        <span class="wave-buoy-label">${label}</span>
        <span class="wave-buoy-value">${value}</span>
      </div>
    `).join("") + `
      <div class="wave-buoy-note">
        Korkein aalto on arvio (~1.8 × merkitsevä aallonkorkeus), ei suora mittaus.
      </div>
    `; } catch (err) { console.warn("Aaltopoijun popup-haku epäonnistui:", err); bodyEl.innerHTML = `<div class="info-panel-error">Haku ei onnistunut juuri nyt.</div>`; } }
