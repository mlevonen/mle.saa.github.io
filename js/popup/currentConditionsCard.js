// ==========================
// Popupin ylin yhteenvetokortti – DESKTOP-versio.
//
// Kokoaa asemakortin tämänhetkisen tilanteen yhteen, heti avautuessa
// näkyvään korttiin: tuulen nopeus/suunta (havainto), lämpötila,
// vedenkorkeus, aallonkorkeus (jos relevantti), auringon nousu/lasku
// JA tuntikohtainen sääennuste (kortin alaosassa oikealla). Vastaavat
// yksittäiset lukemat on poistettu popupin muista osioista (ks.
// stationDetail.js) – graafit ja tuuliennusteanimaatio näyttävät
// edelleen kehityksen/trendin, eivät vain hetkellistä lukemaa, joten
// ne säilyvät ennallaan (animaatio on levitetty graafien levyiseksi).
//
// Kaikki tietoryhmät (Tuuli, Lämpötila, Vedenkorkeus, Aallokko,
// Aurinko, Sääennuste) ovat omia "alakorttejaan" (.popup-card-inner)
// yhden yhteisen CSS Grid -ruudukon (.current-conditions-grid)
// sisällä, jotta ne asettuvat tasan sekä vaaka- että pystysuunnassa
// riippumatta yksittäisten korttien sisällön korkeudesta (CSS Grid,
// ei flex-wrap – rivin korkeus ja sarakkeen leveys ovat aina
// yhtenäiset). Sääennuste-alakortti on tarkoituksella koko leveä
// (.current-conditions-item-wide, grid-column:1/-1), koska sen
// vaakavierittyvä tuntilista tarvitsee enemmän tilaa kuin muut.
//
// Lämpötila-, vedenkorkeus- ja aallokkolohkot käyttävät TARKOITUKSELLA
// samoja luokkanimiä kuin ennen (popup-temp-card, popup-sealevel-card,
// popup-wave-card jne.), jotta jaetut renderöintifunktiot
// (renderTempCard, renderSeaLevelCard, renderWaveCard – kaikki
// hakevat elementit popupEl.querySelector(...)-kutsulla, eivät ole
// sidottuja mihinkään tiettyyn sijaintiin DOM-puussa) toimivat
// muuttumattomina uudessa sijainnissaan.
//
// Auringon nousu/lasku on TARKOITUKSELLA oma, kevyt toteutuksensa
// (renderCurrentSunTimes) eikä käytä popupExtras.js:n renderSunCard-
// funktiota/​.popup-sun-card-luokkaa, koska se on edelleen käytössä
// sekä mobiilissa (muuttumattomana) että desktopin sääennuste-
// alakortissa tässä samassa tiedostossa – kahta samalla luokalla
// varustettua elementtiä ei voisi molempia löytää querySelectorilla.
//
// Lämpötila+Aurinko ja Vedenkorkeus+Aallokko on ryhmitelty samoihin
// alakortteihin (kaksi sisäistä, itsenäisesti piiloutuvaa lohkoa
// yhden visuaalisen kortin sisällä). updateMergedCardVisibility()
// piilottaa koko yhdistetyn kortin, jos KAIKKI sen sisäiset osiot
// ovat piilossa (esim. sisämaan asema ilman vedenkorkeutta tai
// aallokkoa) – kutsuttava renderStationDetailissä vasta kun
// renderSeaLevelCard/renderWaveCard ovat asettaneet näkyvyytensä.
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
      <div class="popup-title">${station.name}</div>
      <div class="popup-extras"></div>

      <div class="current-conditions-grid">

        <div class="current-conditions-item popup-card-inner current-wind-item">
          <div class="current-label">Tuuli</div>
          <div class="current-wind-row">
            <span class="current-wind-dir">–</span>
            <span class="current-wind-arrow">
              <svg viewBox="0 0 24 24" width="40" height="40">
                <path d="M12 1 L18 11 L14 11 L14 21 L10 21 L10 11 L6 11 Z" fill="currentColor"/>
              </svg>
            </span>
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
            <div class="current-label">Aallokko</div>
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
  `;
}

// Piilottaa yhdistetyn "alakortin" kokonaan, jos KAIKKI sen sisäiset
// osiot ovat piilossa (esim. sisämaan asemalla, jolla ei ole
// vedenkorkeutta EIKÄ aallokkoa – muuten jäisi näkyviin tyhjä,
// tarkoitukseton laatikko).
function hideEmptyMergedCard(containerEl, wrapperSelector, partSelectors) {
  const wrapper = containerEl.querySelector(wrapperSelector);
  if (!wrapper) return;

  const anyVisible = partSelectors.some(sel => {
    const part = wrapper.querySelector(sel);
    return part && part.style.display !== "none";
  });

  wrapper.style.display = anyVisible ? "" : "none";
}

export function updateMergedCardVisibility(containerEl) {
  hideEmptyMergedCard(containerEl, ".current-sealevel-wave-card", [".popup-sealevel-card", ".popup-wave-card"]);
  // Lämpötila näkyy aina (renderTempCard ei koskaan piilota sitä),
  // joten current-temp-sun-card ei tarvitse vastaavaa käsittelyä.
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
    // Sama nopeusrajoihin perustuva väriasteikko kuin kartan
    // tuuli-ikoneissa (ks. createWindIcon(), js/main.js), jotta
    // nuoli "muuttaa väriä tuulen nopeuden mukaan samalla tavalla
    // kuin kartalla".
    arrowEl.style.color = windSpeedColor(speed);
  }

}

function windSpeedColor(roundedSpeed) {
  return roundedSpeed < 5  ? "#028b09" :
         roundedSpeed < 10 ? "#025981" :
         roundedSpeed < 15 ? "#b67e06" :
                              "#E53935";
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
