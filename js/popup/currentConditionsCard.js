// ==========================
// Popupin ylin yhteenvetokortti – DESKTOP-versio.
//
// Kokoaa asemakortin tämänhetkisen tilanteen yhteen, heti avautuessa
// näkyvään korttiin: tuulen nopeus/suunta (havainto), lämpötila,
// vedenkorkeus, aallonkorkeus (jos relevantti) ja auringon nousu/
// lasku. Vastaavat yksittäiset lukemat on poistettu popupin muista
// osioista (ks. stationDetail.js) – graafit ja tuuliennusteanimaatio
// näyttävät edelleen kehityksen/trendin, eivät vain hetkellistä
// lukemaa, joten ne säilyvät ennallaan.
//
// Lämpötila-, vedenkorkeus- ja aallokkolohkot käyttävät TARKOITUKSELLA
// samoja luokkanimiä kuin ennen (popup-temp-card, popup-sealevel-card,
// popup-wave-card jne.), jotta jaetut renderöintifunktiot
// (renderTempCard, renderSeaLevelCard, renderWaveCard – kaikki
// hakevat elementit popupEl.querySelector(...)-kutsulla, eivät ole
// sidottuja mihinkään tiettyyn sijaintiin DOM-puussa) toimivat
// muuttumattomina uudessa sijainnissaan. Lämpötila on sijoitettu
// otsikkorivin oikeaan reunaan (.popup-current-header), muut
// omaan ruudukkoonsa (.current-conditions-grid) sen alle.
//
// Auringon nousu/lasku on TARKOITUKSELLA oma, kevyt toteutuksensa
// (renderCurrentSunTimes) eikä käytä popupExtras.js:n renderSunCard-
// funktiota/​.popup-sun-card-luokkaa, koska se on edelleen käytössä
// sekä mobiilissa (muuttumattomana) että desktopin tuntikohtaisen
// sääennustenauhan kortissa (ks. stationDetail.js) – kahta samalla
// luokalla varustettua elementtiä ei voisi molempia löytää
// querySelectorilla.
// ==========================

function formatSunTime(d) {
  return d.toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function currentConditionsCardHTML(station) {
  return `
    <div class="popup-card popup-current-card">
      <div class="popup-current-header">
        <div class="popup-title">${station.name}</div>
        <div class="current-temp-display popup-temp-card">
          <div class="current-label">Lämpötila</div>
          <div class="popup-temp-value">–</div>
        </div>
      </div>
      <div class="popup-extras"></div>

      <div class="current-conditions-grid">

        <div class="current-conditions-item current-wind-item">
          <div class="current-label">Tuuli</div>
          <div class="current-wind-row">
            <span class="current-wind-arrow">↑</span>
            <span class="current-wind-dir">–</span>
          </div>
          <div class="current-wind-speed">–</div>
        </div>

        <div class="current-conditions-item popup-sealevel-card">
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

        <div class="current-conditions-item popup-wave-card" style="display:none;">
          <div class="current-label">Aallokko</div>
          <div class="popup-wave-row">
            <span class="popup-wave-height-value">–</span>
            <span class="popup-wave-period-label">jakso <span class="popup-wave-period-value">–</span></span>
          </div>
        </div>

        <div class="current-conditions-item current-sun-item" style="display:none;">
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
    </div>
  `;
}

// Tuoreimman havaitun tuulilukeman (nopeus + suunta + puuska) haku
// data.obsWindSpeed-sarjasta, sama periaate kuin main.js:n
// karttaikonin päivityksessä käytetty fallback-logiikka.
export function renderCurrentWindSummary(containerEl, data) {

  const speedEl = containerEl.querySelector(".current-wind-speed");
  const dirEl = containerEl.querySelector(".current-wind-dir");
  const arrowEl = containerEl.querySelector(".current-wind-arrow");

  if (!speedEl && !dirEl && !arrowEl) return;

  const obs = Array.isArray(data.obsWindSpeed) ? data.obsWindSpeed : [];
  let latest = null;

  for (let i = obs.length - 1; i >= 0; i--) {
    const p = obs[i];
    if (p && p.windspeedms != null && p.winddirection != null) {
      latest = p;
      break;
    }
  }

  if (!latest) {
    if (speedEl) speedEl.textContent = "–";
    if (dirEl) dirEl.textContent = "–";
    if (arrowEl) arrowEl.style.visibility = "hidden";
    return;
  }

  const speed = Math.round(latest.windspeedms);
  const gust = latest.windgust != null ? Math.round(latest.windgust) : null;

  if (speedEl) {
    speedEl.textContent = gust != null
      ? `${speed} m/s (puuska ${gust} m/s)`
      : `${speed} m/s`;
  }

  if (dirEl) {
    dirEl.textContent = `${Math.round(latest.winddirection)}°`;
  }

  if (arrowEl) {
    arrowEl.style.visibility = "visible";
    // Sama dir+180°-konventio kuin kartan tuuli-ikoneissa ja
    // tuulen aikajanalla – nuoli osoittaa mihin tuuli puhaltaa.
    arrowEl.style.transform = `rotate(${latest.winddirection + 180}deg)`;
  }

}

export function renderCurrentSunTimes(containerEl, data) {

  const wrapper = containerEl.querySelector(".current-sun-item");
  if (!wrapper) return;

  if (!data.sunTimes) {
    wrapper.style.display = "none";
    return;
  }

  const sunriseEl = wrapper.querySelector(".current-sunrise-value");
  const sunsetEl = wrapper.querySelector(".current-sunset-value");

  if (sunriseEl) sunriseEl.textContent = formatSunTime(new Date(data.sunTimes.sunrise));
  if (sunsetEl) sunsetEl.textContent = formatSunTime(new Date(data.sunTimes.sunset));

  wrapper.style.display = "";

}
