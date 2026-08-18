export function parseMarineBulletinHtml(html) { const doc = new DOMParser().parseFromString(html, "text/html"); const title = doc.querySelector("h1")?.textContent?.trim() || "Säätiedotus merenkulkijoille"; const warningsText = doc.querySelector("#marine-warnings .weather-forecast__weather") ?.textContent?.trim() || ""; const inferenceText = doc.querySelector("#marine-inference .weather-forecast__weather") ?.textContent?.trim() || "";     const areas = Array.from( doc.querySelectorAll("section.weather-forecast--marine") ) .filter(section => section.querySelector("h3.weather-forecast__title")) .map(section => { const areaName = section.querySelector("h3.weather-forecast__title") ?.textContent?.trim() || ""; const wind = section.querySelector(".weather-forecast__wind") ?.textContent?.trim() || ""; const weather = section.querySelector( ".weather-forecast__content .weather-forecast__weather" )?.textContent?.trim() || ""; return { areaName, wind, weather }; }) .filter(area => area.areaName); return { title, warningsText, inferenceText, areas }; } function escapeHtml(str) { return String(str) .replace(/&/g, "&amp;") .replace(/</g, "&lt;") .replace(/>/g, "&gt;"); } export function renderMarineBulletinHtml(bulletin) { const { title, warningsText, inferenceText, areas } = bulletin; let html = `<div class="marine-bulletin-title">${escapeHtml(title)}</div>`; if (warningsText) { html += `
      <div class="marine-bulletin-block marine-bulletin-warning">
        <div class="marine-bulletin-block-title">⚠️ Varoitukset merialueilla</div>
        <div class="marine-bulletin-text">${escapeHtml(warningsText)}</div>
      </div>
    `; } if (inferenceText) { html += `
      <div class="marine-bulletin-block">
        <div class="marine-bulletin-block-title">Yleiskatsaus (24 h)</div>
        <div class="marine-bulletin-text">${escapeHtml(inferenceText)}</div>
      </div>
    `; } areas.forEach(area => { html += `
      <div class="marine-bulletin-block">
        <div class="marine-bulletin-block-title">${escapeHtml(area.areaName)}</div>
        ${area.wind ? `<div class="marine-bulletin-text">${escapeHtml(area.wind)}</div>` : ""}
        ${area.weather ? `<div class="marine-bulletin-text marine-bulletin-text-secondary">${escapeHtml(area.weather)}</div>` : ""}
      </div>
    `; }); if (!warningsText && !inferenceText && !areas.length) { html += `<div class="info-panel-empty">Tiedotetta ei juuri nyt saatavilla.</div>`; } return html; }
