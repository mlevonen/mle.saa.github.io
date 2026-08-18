import { parseFmiUtc } from "../utils/time.js"; import { renderWindCharts } from "../charts/windChart.js"; const PAST_HOURS = 12; const FUTURE_HOURS = 36; const MATCH_TOLERANCE_MS = 40 * 60 * 1000; export function windTimelineListHTML() { return `
    <div class="popup-card wind-timeline-card">
      <div class="wind-timeline-header">
        <strong>Tuuli</strong>
        <a href="#" class="wind-charts-toggle">Näytä graafit ↓</a>
      </div>

      <div class="wind-charts-panel" style="display:none;">
        <div class="popup-card-inner">
          <div class="wind-obs-card-title" style="font-size:12px; font-weight:600; margin-bottom:4px;"><strong>Tuuli (havainto)</strong></div>
          <div class="popup-chart-wrapper">
            <canvas class="popup-chart" width="650" height="140" data-type="wind-obs"></canvas>
          </div>
        </div>
        <div class="popup-card-inner" style="margin-top:8px;">
          <div style="font-size:12px; font-weight:600; margin-bottom:4px;">Tuuli (ennuste)</div>
          <div class="popup-chart-wrapper">
            <canvas class="popup-chart" width="650" height="140" data-type="wind-fc"></canvas>
          </div>
        </div>
      </div>

      <div class="wind-timeline-list"></div>
    </div>
  `; } function nearestPoint(points, targetTime) { if (!Array.isArray(points) || !points.length) return null; let closest = null; let minDiff = Infinity; for (const p of points) { const t = parseFmiUtc(p.utctime).getTime(); if (Number.isNaN(t)) continue; const diff = Math.abs(t - targetTime.getTime()); if (diff < minDiff) { minDiff = diff; closest = p; } } return closest ? { point: closest, diffMs: minDiff } : null; }     function combineForecast(fcWindSpeed, fcWindDir, fcWindGust) { if (!Array.isArray(fcWindSpeed)) return []; return fcWindSpeed.map((p, i) => ({ utctime: p.utctime, windspeedms: p.windspeedms, winddirection: fcWindDir?.[i]?.winddirection, windgust: fcWindGust?.[i]?.windgust })); } export function sampleHourly(data, now = new Date()) { const obsPoints = Array.isArray(data.obsWindSpeed) ? data.obsWindSpeed : []; const fcCombined = combineForecast(data.fcWindSpeed, data.fcWindDir, data.fcWindGust); const rows = [];   for (let offset = -PAST_HOURS; offset <= -1; offset++) { const target = new Date(now.getTime() + offset * 60 * 60 * 1000); const nearest = nearestPoint(obsPoints, target); if (nearest && nearest.diffMs <= MATCH_TOLERANCE_MS) { rows.push({ time: target, phase: "obs", offset, ...nearest.point }); } }   const freshObs = obsPoints .filter(p => parseFmiUtc(p.utctime).getTime() <= now.getTime() + 15 * 60 * 1000) .sort((a, b) => parseFmiUtc(b.utctime) - parseFmiUtc(a.utctime))[0]; if (freshObs) { rows.push({ time: parseFmiUtc(freshObs.utctime), phase: "now", offset: 0, ...freshObs }); } else { const nearestFc = nearestPoint(fcCombined, now); if (nearestFc) { rows.push({ time: parseFmiUtc(nearestFc.point.utctime), phase: "now", offset: 0, ...nearestFc.point }); } }   for (let offset = 1; offset <= FUTURE_HOURS; offset++) { const target = new Date(now.getTime() + offset * 60 * 60 * 1000); const nearest = nearestPoint(fcCombined, target); if (nearest && nearest.diffMs <= MATCH_TOLERANCE_MS) { rows.push({ time: target, phase: "fc", offset, ...nearest.point }); } } return rows; } export function renderWindTimelineList(containerEl, data) {     const toggleLink = containerEl.querySelector(".wind-charts-toggle"); const chartsPanel = containerEl.querySelector(".wind-charts-panel"); let chartsRendered = false; if (toggleLink && chartsPanel) { toggleLink.addEventListener("click", e => { e.preventDefault(); const isOpen = chartsPanel.style.display !== "none"; if (isOpen) { chartsPanel.style.display = "none"; toggleLink.textContent = "Näytä graafit ↓"; } else { chartsPanel.style.display = ""; toggleLink.textContent = "Piilota graafit ↑"; if (!chartsRendered) { renderWindCharts(containerEl, data); chartsRendered = true; } } }); } const listEl = containerEl.querySelector(".wind-timeline-list"); if (!listEl) return; const now = new Date(); const rows = sampleHourly(data, now); if (!rows.length) { listEl.innerHTML = `<div class="wind-timeline-empty">Tuulitietoja ei ole saatavilla.</div>`; return; } let html = ""; let lastDayKey = null; rows.forEach(row => { const dayKey = row.time.toLocaleDateString("fi-FI", { day: "numeric", month: "numeric" }); if (dayKey !== lastDayKey) { const dayLabel = row.time.toLocaleDateString("fi-FI", { weekday: "short", day: "numeric", month: "numeric" }); html += `<div class="wind-timeline-day">${dayLabel}</div>`; lastDayKey = dayKey; } const isNow = row.phase === "now"; const timeLabel = isNow ? "Nyt" : row.time.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" }); const speed = row.windspeedms != null ? `${Math.round(row.windspeedms)} m/s` : "–"; const gust = row.windgust != null ? `puuska ${Math.round(row.windgust)} m/s` : ""; const arrow = row.winddirection != null ? `<span class="wind-timeline-arrow" style="transform:rotate(${row.winddirection + 180}deg);">↑</span>` : `<span class="wind-timeline-arrow wind-timeline-arrow-empty">–</span>`;         html += `
      <div class="wind-timeline-row${isNow ? " wind-timeline-row-now" : ""}"${isNow ? ' data-row-now="true"' : ""}>
        <span class="wind-timeline-time">${timeLabel}</span>
        ${arrow}
        <span class="wind-timeline-speed">${speed}</span>
        <span class="wind-timeline-gust">${gust}</span>
      </div>
    `; }); listEl.innerHTML = html;               }
