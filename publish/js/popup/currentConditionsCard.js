function formatSunTime(d) { return d.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" }); } export function currentConditionsCardHTML(station) { return `
    <div class="popup-card popup-current-card">
      <div class="popup-title">${station.name}</div>
      <div class="popup-extras"></div>

      <div class="current-conditions-grid">

        <div class="current-conditions-item popup-card-inner current-wind-item">
          <!-- Nuolelle oma vaalea "kortti" tumman taustan päällä,
               jotta nuoli erottuu aina riippumatta sen omasta
               (tuulen mukaan vaihtuvasta) väristä. Sijoitettu
               absoluuttisesti kortin oikeaan yläkulmaan (ks. CSS),
               joten sen paikka lähdekoodissa ei vaikuta ulkoasuun. -->
          <span class="current-wind-arrow-box">
            <span class="current-wind-arrow">
              <svg viewBox="0 0 24 24" width="46" height="46">
                <path d="M12 1 L18 11 L14 11 L14 21 L10 21 L10 11 L6 11 Z" fill="currentColor"/>
              </svg>
            </span>
          </span>
          <div class="current-label">Tuuli</div>
          <div class="current-wind-row">
            <span class="current-wind-dir">–</span>
          </div>
          <div class="current-wind-speed">–</div>
        </div>

        <!-- Lämpötila + Aurinko samassa alakortissa. Molemmat pysyvät
             omina sisäisinä lohkoinaan (.popup-temp-card/.current-sun-
             item), jotta niiden erillinen näkyvyyslogiikka (lämpötila
             näkyy aina, aurinkotieto piilotetaan jos ei saatavilla)
             toimii edelleen itsenäisesti – vain ULOMPI kortti on
             visuaalisesti yhtenäinen. -->
        <div class="current-conditions-item popup-card-inner current-temp-sun-card">
          <div class="popup-temp-card">
            <div class="current-label">Lämpötila</div>
            <div class="popup-temp-value">–</div>
          </div>
          <div class="current-sun-item" style="display:none;">
            <div class="current-label">Aurinko</div>
            <div class="popup-sun-row">
              <div class="popup-inline-item">
                <img src="./js/assets/icons/sunrise.svg" class="popup-icon" alt="Auringonnousu">
                <span class="current-sunrise-value">–</span>
              </div>
              <div class="popup-inline-item">
                <img src="./js/assets/icons/sunset.svg" class="popup-icon" alt="Auringonlasku">
                <span class="current-sunset-value">–</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Vedenkorkeus + Aallokko samassa alakortissa, samalla
             periaatteella kuin yllä (kumpikin osio piiloutuu
             itsenäisesti; jos molemmat piiloutuvat esim. sisämaan
             asemalla, hideEmptyMergedCard piilottaa myös koko
             ulomman kortin, ettei jää tyhjää laatikkoa). -->
        <div class="current-conditions-item popup-card-inner current-sealevel-wave-card">
          <div class="popup-sealevel-card">
            <div class="current-label">Vedenkorkeus</div>
            <div class="wind-flow-sealevel-row">
              <span class="wind-flow-sealevel-label">Keskivesi</span>
              <span class="wind-flow-sealevel-value" data-kind="watlev">–</span>
            </div>
            <div class="wind-flow-sealevel-row">
              <span class="wind-flow-sealevel-label">N2000</span>
              <span class="wind-flow-sealevel-value" data-kind="n2000">–</span>
            </div>
          </div>
          <div class="popup-wave-card" style="display:none;">
            <div class="current-label popup-wave-label-row">
              Aallokko
              <button type="button" class="popup-info-btn" aria-label="Tietoa aallonkorkeuslukemasta">?</button>
            </div>
            <!-- Selitys sille miksi lukema ei aina vastaa avomeren
                 aallokkoa – ks. renderWaveCard, popupExtras.js, joka
                 sitoo klikkauksen tähän (hidden-attribuutin toggle). -->
            <div class="popup-wave-info-text" hidden>
              Lukema on aaltomallin ennuste tarkalleen havaintoaseman
              sijainnissa. Moni asema on satamassa tai muuten suojaisassa
              paikassa, joten se voi poiketa avomeren aallokosta.
            </div>
            <div class="popup-wave-row">
              <span class="popup-wave-height-value">–</span>
              <span class="popup-wave-period-label">jakso <span class="popup-wave-period-value">–</span></span>
            </div>
          </div>
        </div>

        <!-- Tuntikohtainen sääennuste, sama alakortti-tyyli kuin
             muutkin ryhmät, mutta koko leveä (.current-conditions-
             item-wide) koska vaakavierittyvä tuntilista tarvitsee
             enemmän tilaa. Käyttää samaa jaettua renderSunCard-
             funktiota kuin ennen (sunrise/sunset-elementit vain
             puuttuvat tästä yhteydestä – ne näkyvät jo yllä omana
             Aurinko-kohtanaan – mikä käsitellään turvallisesti). -->
        <div class="current-conditions-item current-conditions-item-wide popup-card-inner popup-sun-card" style="display:none;">
          <div class="current-label">Sääennuste</div>
          <div class="popup-hourly-day"></div>
          <div class="popup-hourly-forecast"></div>
        </div>

      </div>
    </div>
  `; }         function hideEmptyMergedCard(containerEl, wrapperSelector, partSelectors) { const wrapper = containerEl.querySelector(wrapperSelector); if (!wrapper) return; const anyVisible = partSelectors.some(sel => { const part = wrapper.querySelector(sel); return part && part.style.display !== "none"; }); wrapper.style.display = anyVisible ? "" : "none"; } export function updateMergedCardVisibility(containerEl) { hideEmptyMergedCard(containerEl, ".current-sealevel-wave-card", [".popup-sealevel-card", ".popup-wave-card"]);     }       export function renderCurrentWindSummary(containerEl, data) { const speedEl = containerEl.querySelector(".current-wind-speed"); const dirEl = containerEl.querySelector(".current-wind-dir"); const arrowEl = containerEl.querySelector(".current-wind-arrow"); if (!speedEl && !dirEl && !arrowEl) return; const obs = Array.isArray(data.obsWindSpeed) ? data.obsWindSpeed : []; let latest = null; for (let i = obs.length - 1; i >= 0; i--) { const p = obs[i]; if (p && p.windspeedms != null && p.winddirection != null) { latest = p; break; } } if (!latest) { if (speedEl) speedEl.textContent = "–"; if (dirEl) dirEl.textContent = "–"; if (arrowEl) arrowEl.style.visibility = "hidden"; return; } const speed = Math.round(latest.windspeedms); const gust = latest.windgust != null ? Math.round(latest.windgust) : null; if (speedEl) { speedEl.textContent = gust != null ? `${speed} m/s (puuska ${gust} m/s)` : `${speed} m/s`; } if (dirEl) { dirEl.textContent = `${Math.round(latest.winddirection)}°`; } if (arrowEl) { arrowEl.style.visibility = "visible";     arrowEl.style.transform = `rotate(${latest.winddirection + 180}deg)`;         arrowEl.style.color = windSpeedColor(speed); } } function windSpeedColor(roundedSpeed) { return roundedSpeed < 5 ? "#028b09" : roundedSpeed < 10 ? "#025981" : roundedSpeed < 15 ? "#b67e06" : "#E53935"; } export function renderCurrentSunTimes(containerEl, data) { const wrapper = containerEl.querySelector(".current-sun-item"); if (!wrapper) return; if (!data.sunTimes) { wrapper.style.display = "none"; return; } const sunriseEl = wrapper.querySelector(".current-sunrise-value"); const sunsetEl = wrapper.querySelector(".current-sunset-value"); if (sunriseEl) sunriseEl.textContent = formatSunTime(new Date(data.sunTimes.sunrise)); if (sunsetEl) sunsetEl.textContent = formatSunTime(new Date(data.sunTimes.sunset)); wrapper.style.display = ""; }
