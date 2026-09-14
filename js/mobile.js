// ==========================
// Mobiilinäkymä: tekstipohjainen lista havaintopisteistä
// merialueittain, kortti avautuu "bottom sheet" -tyylisenä
// kun asemaa napautetaan.
//
// Käyttää mobiilikohtaista asemakortin runkoa/logiikkaa
// (js/popup/mobileStationDetail.js), joka jakaa datan lataus- ja
// alikorttilogiikan desktop-popupin kanssa mutta pinoo kortit
// omaan, kevyempään layoutiinsa (ei sivupalkkia, graafit linkin
// takana, tekstimuotoinen tuulen aikajana). Karttapohjaista
// Leafletia ei tarvita lainkaan tässä näkymässä.
//
// stations.js ladataan (kuten index.html:ssäkin) tavallisena
// <script>-tagina ennen tätä moduulia, joten globaali `stations`-
// muuttuja on suoraan käytettävissä ilman importtia.
// ==========================

import { groupBySeaArea, sortStationsWithinArea } from "./seaAreas.js";
import { mobileStationDetailHTML, renderMobileStationDetail } from "./popup/mobileStationDetail.js";
import { getFavoriteIds, isFavorite, toggleFavorite } from "./utils/favorites.js";
import { CHANGELOG, CHANGELOG_NOTE, CHANGELOG_CONTACT_EMAIL } from "./changelogData.js";
import { fetchWaterTempPoints } from "./api/waterTempPoints.js";
import { waterTempColor } from "./popup/seaLevelCard.js";
import { fetchObservationSeriesByFmisid } from "./api/dataLoader.js";
import { fetchCurrentWindMulti } from "./api/openMeteoWind.js";
import { loadPreviewCache, savePreviewCache } from "./utils/previewCache.js";

const listEl = document.getElementById("station-list");
const overlayEl = document.getElementById("detail-overlay");
const sheetEl = document.getElementById("detail-sheet");
const sheetBodyEl = document.getElementById("detail-sheet-body");
const closeBtn = document.getElementById("detail-close");

// Käynnissä olevan tuulivirtausanimaation pysäytysfunktio
// (renderStationDetail palauttaa oman per-kutsu-instanssinsa).
let currentStop = null;

function closeSheet() {
  if (currentStop) {
    currentStop();
    currentStop = null;
  }
  overlayEl.classList.remove("open");
  sheetBodyEl.innerHTML = "";
}

closeBtn.addEventListener("click", closeSheet);

// Tausta kiinni napautettaessa (ei itse korttia)
overlayEl.addEventListener("click", e => {
  if (e.target === overlayEl) closeSheet();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && overlayEl.classList.contains("open")) closeSheet();
});

async function openStation(station) {

  // Pysäytä edellisen kortin animaatio, jos käyttäjä ehti napauttaa
  // uutta asemaa ennen edellisen sulkemista.
  if (currentStop) {
    currentStop();
    currentStop = null;
  }

  sheetBodyEl.innerHTML = mobileStationDetailHTML(station);
  overlayEl.classList.add("open");

  // HUOM: skrollattava elementti on #detail-sheet (overflow-y:auto),
  // ei #detail-overlay (kiinteä koko ruudun kehys, ei itse skrollaa).
  // Aiemmin väärä elementti nollattiin, jolloin edellisen aseman
  // skrollausasema jäi voimaan uutta korttia avatessa – tämä saattoi
  // yhdessä lyhyemmän sisällön kanssa työntää "Sulje"-napin näkymän
  // yläpuolelle.
  sheetEl.scrollTop = 0;

  const { stop } = await renderMobileStationDetail(sheetBodyEl, station);
  currentStop = stop;
}

// ==========================
// Muutokset – sama sisältö/data kuin desktopin Muutokset-napissa
// (js/changelogControl.js), avataan tässä samaan "bottom sheet" -
// kehykseen kuin asemakortitkin. Ei tarvitse omaa stop-funktiota,
// koska sisältö on staattista tekstiä (ei animaatioita/ajastimia).
// ==========================

function changelogHTML() {
  return `
    <div class="popup-card">
      <div class="popup-title">Viimeisimmät muutokset</div>
      <div class="changelog-note">${CHANGELOG_NOTE}</div>
      <div class="changelog-list">
        ${CHANGELOG.map(entry => `
          <div class="changelog-entry">
            <div class="changelog-date">${entry.date}</div>
            <ul class="changelog-items">
              ${entry.items.map(item => `<li>${item}</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
      <div class="changelog-contact">
        Kysyttävää tai palautetta? <a href="mailto:${CHANGELOG_CONTACT_EMAIL}">${CHANGELOG_CONTACT_EMAIL}</a>
      </div>
    </div>
  `;
}

function openChangelog() {
  if (currentStop) {
    currentStop();
    currentStop = null;
  }
  sheetBodyEl.innerHTML = changelogHTML();
  overlayEl.classList.add("open");
  sheetEl.scrollTop = 0;
}

// ==========================
// Muut vedenlämpötilat – samat pisteet jotka desktopilla näytetään
// kartalla "Vedenlämpö"-napin pallomerkkeinä (ks. js/api/waterTempPoints.js:
// SYKE:n sisävesiasemat + pk-seudun UiRaS-uimapaikat, joilla ei ole omaa
// havaintoasemaa sivustolla). Mobiilissa ei ole karttaa, joten sama data
// näytetään tässä listana, avataan "Katso muutokset" -rivin YLÄPUOLELLE
// sijoitetusta omasta rivistään. Voidaan merkitä suosikiksi samalla
// tähdellä kuin havaintoasematkin (ks. createWaterTempLi) – suosikiksi
// merkityt näkyvät sitten YLIMMÄSSÄ Suosikit-osiossa asemasuosikkien
// joukossa (ks. refreshFavoritesSection).
//
// Haku on välimuistitettu itse waterTempPoints.js:ssä (15 min TTL),
// joten listan voi avata useaan kertaan ilman turhia verkkopyyntöjä.
// ==========================

function waterTempListHTML() {
  return `
    <div class="popup-card">
      <div class="popup-title">Muut vedenlämpötilat</div>
      <div class="changelog-note">
        Pisteet, joilla ei ole omaa havaintoasemaa tällä sivustolla: sisävedet
        (Suomen ympäristökeskus) ja pääkaupunkiseudun uimapaikat (Helsingin
        kaupunki / Forum Virium Helsinki).
      </div>
      <div class="watertemp-list-body">
        <p class="empty-note">Ladataan…</p>
      </div>
    </div>
  `;
}

function createWaterTempLi(point) {

  const li = document.createElement("li");

  const row = document.createElement("div");
  row.className = "station-item";

  const fav = isFavorite(point.id);

  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "station-favorite-btn" + (fav ? " is-favorite" : "");
  favBtn.dataset.stationId = point.id;
  favBtn.setAttribute("aria-pressed", String(fav));
  favBtn.setAttribute("aria-label", fav ? "Poista suosikeista" : "Lisää suosikiksi");
  favBtn.textContent = fav ? "★" : "☆";
  favBtn.addEventListener("click", e => {
    e.stopPropagation();
    handleToggleFavorite(point.id);
  });

  // HUOM: tavallinen <div>, ei <button> kuten createStationLi:ssä –
  // rivillä ei ole "avaa"-toimintoa (kaikki oleellinen tieto on jo
  // näkyvissä rivillä itsessään), joten se ei saa näyttää klikattavalta
  // (ei cursor:pointer/hover-tilaa, ks. .watertemp-item-row mobile.html:ssä).
  const infoEl = document.createElement("div");
  infoEl.className = "station-item-open watertemp-item-row";
  infoEl.innerHTML = `
    <span class="watertemp-item-circle" style="background:${waterTempColor(point.temp)}">${Math.round(point.temp)}°</span>
    <span class="station-item-name">${point.name}</span>
  `;

  row.appendChild(favBtn);
  row.appendChild(infoEl);
  li.appendChild(row);

  return li;

}

function appendWaterTempGroup(containerEl, title, points) {

  if (!points.length) return;

  const heading = document.createElement("h2");
  heading.className = "watertemp-group-title";
  heading.textContent = title;
  containerEl.appendChild(heading);

  const ul = document.createElement("ul");
  ul.className = "station-list";
  points.forEach(p => ul.appendChild(createWaterTempLi(p)));
  containerEl.appendChild(ul);

}

async function openWaterTempList() {

  if (currentStop) {
    currentStop();
    currentStop = null;
  }

  sheetBodyEl.innerHTML = waterTempListHTML();
  overlayEl.classList.add("open");
  sheetEl.scrollTop = 0;

  const bodyEl = sheetBodyEl.querySelector(".watertemp-list-body");

  try {

    const points = await fetchWaterTempPoints();

    if (!points.length) {
      bodyEl.innerHTML = `<p class="empty-note">Vedenlämpöpisteitä ei löytynyt juuri nyt.</p>`;
      return;
    }

    const byName = (a, b) => a.name.localeCompare(b.name, "fi");
    const syke = points.filter(p => p.source === "syke").sort(byName);
    const uiras = points.filter(p => p.source === "uiras").sort(byName);

    bodyEl.innerHTML = "";
    appendWaterTempGroup(bodyEl, "Sisävedet", syke);
    appendWaterTempGroup(bodyEl, "Pääkaupunkiseudun uimapaikat", uiras);

  } catch (err) {
    console.warn("Vedenlämpöjen haku epäonnistui:", err);
    bodyEl.innerHTML = `<p class="empty-note">Haku ei onnistunut juuri nyt.</p>`;
  }

}

// ==========================
// Suosikkiasemat: tähti + kiinnitetty "Suosikit"-osio listan alussa
// ==========================
// Tähdellä merkitty asema näkyy KAHDESSA paikassa: kiinnitetyssä
// Suosikit-osiossa listan alussa (nopea pääsy ilman skrollausta) JA
// omalla totutulla paikallaan merialueryhmässään (asema ei koskaan
// "katoa" sieltä mihin käyttäjä sen odottaa löytävänsä). Molemmat
// rivit rakennetaan samalla createStationLi()-funktiolla ja pidetään
// synkassa data-station-id-attribuutin kautta, kun tähteä napautetaan.

function updateFavoriteButtons(stationId, isFav) {
  document.querySelectorAll(`.station-favorite-btn[data-station-id="${stationId}"]`)
    .forEach(btn => {
      btn.classList.toggle("is-favorite", isFav);
      btn.setAttribute("aria-pressed", String(isFav));
      btn.setAttribute("aria-label", isFav ? "Poista suosikeista" : "Lisää suosikiksi");
      btn.textContent = isFav ? "★" : "☆";
    });
}

function handleToggleFavorite(stationId) {
  const isFav = toggleFavorite(stationId);
  updateFavoriteButtons(stationId, isFav);
  refreshFavoritesSection();
}

function createStationLi(station) {

  const li = document.createElement("li");

  const row = document.createElement("div");
  row.className = "station-item";

  const fav = isFavorite(station.id);

  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "station-favorite-btn" + (fav ? " is-favorite" : "");
  favBtn.dataset.stationId = station.id;
  favBtn.setAttribute("aria-pressed", String(fav));
  favBtn.setAttribute("aria-label", fav ? "Poista suosikeista" : "Lisää suosikiksi");
  favBtn.textContent = fav ? "★" : "☆";
  favBtn.addEventListener("click", e => {
    // HUOM: erillinen sisarnappi (ei sisäkkäinen <button> avausnapin
    // sisällä – se olisi virheellistä HTML:ää eikä toimisi luotettavasti
    // kosketuslaitteilla). stopPropagation estää silti tämän napautuksen
    // kuplimasta avausnapin kuuntelijaan, jos elementit joskus asetellaan
    // toisin.
    e.stopPropagation();
    handleToggleFavorite(station.id);
  });

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "station-item-open";
  openBtn.innerHTML = `
    <span class="station-item-main">
      <span class="station-item-name">${station.name}</span>
      <span class="station-item-wind" data-wind-for="${station.id}"></span>
    </span>
    <span class="station-item-chevron">›</span>
  `;
  openBtn.addEventListener("click", () => openStation(station));

  row.appendChild(favBtn);
  row.appendChild(openBtn);
  li.appendChild(row);

  return li;

}

// ==========================
// Tuulen nopeus + suuntanuoli listarivillä (nimen perässä) – EI popupin
// sisällä, ei siis muutoksia mobileStationDetail.js:ään. Käyttäjä näkee
// näin tuulen jo ilman kortin avaamista.
//
// Sama datalähde/prioriteetti kuin desktopin kartan tuuli-ikoneilla
// (ks. js/main.js): ensin yritetään FMI:n oma havainto asemalta
// (fetchObservationSeriesByFmisid), ja vain jos sieltä ei löydy
// kelvollista lukemaa (esim. Helsinki Helsingin majakka), käytetään
// Open-Meteon koordinaattipohjaista nykytuulta varana. Tulos
// välimuistitetaan (5 min) samalla periaatteella kuin kartan
// tuuli-ikonit, jotta listan avatessa nähdään heti viimeksi tunnettu
// lukema ennen tuoreen datan saapumista.
// ==========================

function windSpeedColor(speed) {
  const s = Math.round(speed);
  return s < 5  ? "#028b09" :
         s < 10 ? "#025981" :
         s < 15 ? "#b67e06" :
                  "#E53935";
}

function windIndicatorHTML(speed, dir) {
  if (!Number.isFinite(speed) || !Number.isFinite(dir)) return "";
  const color = windSpeedColor(speed);
  return `
    <svg viewBox="0 0 24 24" width="16" height="16" style="flex:none; transform:rotate(${dir + 180}deg); color:${color};">
      <path d="M12 1 L18 11 L14 11 L14 21 L10 21 L10 11 L6 11 Z" fill="currentColor"/>
    </svg>
    <span style="color:${color};">${Math.round(speed)} m/s</span>
  `;
}

// Asema voi näkyä KAHDESSA rivissä (Suosikit + oma merialueensa) –
// päivitetään kaikki data-wind-for-attribuutilla löytyvät rivit kerralla,
// sama periaate kuin updateFavoriteButtons().
function updateWindIndicators(values) {
  Object.entries(values).forEach(([id, w]) => {
    if (!w || !Number.isFinite(w.speed) || !Number.isFinite(w.dir)) return;
    document.querySelectorAll(`.station-item-wind[data-wind-for="${id}"]`)
      .forEach(el => { el.innerHTML = windIndicatorHTML(w.speed, w.dir); });
  });
}

const WIND_LIST_CACHE_KEY = "mobileWindListCache";
const WIND_LIST_CACHE_TTL = 5 * 60 * 1000;

async function loadStationWindIndicators() {

  // 1. Näytä heti viimeksi tunnetut lukemat (jos alle 5 min vanhoja)
  const cached = loadPreviewCache(WIND_LIST_CACHE_KEY, WIND_LIST_CACHE_TTL);
  if (cached) updateWindIndicators(cached);

  // 2. Hae tuoreet lukemat rinnakkain kaikille rannikkoasemille
  const freshValues = {};
  const fallbackStations = [];

  await Promise.all(coastalStations.map(async station => {
    try {

      const series = await fetchObservationSeriesByFmisid(station.fmisid);

      const latest = [...series].reverse().find(
        p => p.windspeedms != null && p.winddirection != null
      );

      if (!latest) {
        fallbackStations.push(station);
        return;
      }

      freshValues[station.id] = {
        speed: latest.windspeedms,
        dir: latest.winddirection,
        gust: latest.windgust
      };

    } catch (err) {
      console.warn("Tuulilukeman haku epäonnistui (mobiililista):", station.name, err);
      fallbackStations.push(station);
    }
  }));

  if (fallbackStations.length) {
    try {
      const fallbackValues = await fetchCurrentWindMulti(fallbackStations);
      fallbackStations.forEach(station => {
        const w = fallbackValues[station.id];
        if (w && w.speed != null && w.dir != null) {
          freshValues[station.id] = w;
        }
      });
    } catch (err) {
      console.warn("Open-Meteo-varatuulen haku epäonnistui (mobiililista):", err);
    }
  }

  updateWindIndicators(freshValues);
  savePreviewCache(WIND_LIST_CACHE_KEY, freshValues);

}

// ==========================
// Lista merialueittain
// ==========================
// MVP kattaa rannikko-/maa-asemat (type "coastal"), joilla on
// täysi asemakortti (tuuli, lämpötila, vedenkorkeus, sää).
// Aaltopoijut (type "wavebuoy") käyttävät desktopilla kevyempää,
// Leaflet-popup-sidonnaista omaa näkymäänsä eikä niitä ole vielä
// sovitettu tähän listaan.

const coastalStations = stations.filter(s => s.type === "coastal");
const groups = groupBySeaArea(coastalStations);

// Suosikit-osio kiinnitetään AINA listan ensimmäiseksi lapseksi (piilossa,
// jos suosikkeja ei ole), ja vasta sen jälkeen lisätään merialueryhmät –
// näin DOM-järjestys pysyy oikeana riippumatta siitä milloin osiota
// päivitetään.
const favoritesSection = document.createElement("section");
favoritesSection.className = "sea-area-section favorites-section";
favoritesSection.style.display = "none";

const favoritesHeading = document.createElement("h2");
favoritesHeading.className = "sea-area-title favorites-title";
favoritesHeading.textContent = "★ Suosikit";
favoritesSection.appendChild(favoritesHeading);

const favoritesList = document.createElement("ul");
favoritesList.className = "station-list";
favoritesSection.appendChild(favoritesList);

listEl.appendChild(favoritesSection);

// Vedenlämpöpisteiden (SYKE/UiRaS) välimuisti Suosikit-osiota varten –
// haetaan vain KERRAN per istunto ja vain jos tarpeen (ks. alla), jotta
// jokainen tähdellyksen togglaus ei laukaise turhaa verkkopyyntöä
// niille käyttäjille joilla ei ole yhtään vedenlämpösuosikkia.
let waterTempPointsPromise = null;

async function refreshFavoritesSection() {

  const favIds = getFavoriteIds();
  const favStations = coastalStations.filter(s => favIds.includes(s.id));

  // Sama järjestys kuin muualla listassa (etelästä pohjoiseen, sitten
  // rannikon suuntaa mukaileva järjestys – ks. sortStationsWithinArea),
  // ei lisäysjärjestys – pysyy ennustettavana.
  const ordered = groupBySeaArea(favStations)
    .flatMap(g => sortStationsWithinArea(g.area, g.stations));

  favoritesList.innerHTML = "";
  ordered.forEach(station => favoritesList.appendChild(createStationLi(station)));

  // Suosikki-id:t, jotka EIVÄT täsmää mihinkään rannikkoasemaan, ovat
  // (ainoan muun suosikoitavan asian ollessa vedenlämpöpisteet)
  // todennäköisesti niitä – haetaan pisteet vain jos tällaisia löytyy.
  const matchedStationIds = new Set(favStations.map(s => s.id));
  const leftoverIds = favIds.filter(id => !matchedStationIds.has(id));

  let waterTempFavCount = 0;

  if (leftoverIds.length) {

    try {

      if (!waterTempPointsPromise) {
        waterTempPointsPromise = fetchWaterTempPoints();
      }

      const points = await waterTempPointsPromise;

      const favPoints = points
        .filter(p => leftoverIds.includes(p.id))
        .sort((a, b) => a.name.localeCompare(b.name, "fi"));

      favPoints.forEach(p => favoritesList.appendChild(createWaterTempLi(p)));
      waterTempFavCount = favPoints.length;

    } catch (err) {
      console.warn("Suosikkien vedenlämpöpisteiden haku epäonnistui:", err);
    }

  }

  favoritesSection.style.display = (ordered.length + waterTempFavCount) ? "" : "none";

}

if (!groups.length) {

  const empty = document.createElement("p");
  empty.className = "empty-note";
  empty.textContent = "Havaintopisteitä ei löytynyt.";
  listEl.appendChild(empty);

} else {

  groups.forEach(({ area, stations: areaStations }) => {

    const section = document.createElement("section");
    section.className = "sea-area-section";

    const heading = document.createElement("h2");
    heading.className = "sea-area-title";
    heading.textContent = area;
    section.appendChild(heading);

    const ul = document.createElement("ul");
    ul.className = "station-list";

    sortStationsWithinArea(area, areaStations)
      .forEach(station => ul.appendChild(createStationLi(station)));

    section.appendChild(ul);
    listEl.appendChild(section);

  });

}

// Listan toiseksi viimeinen rivi: linkki Muut vedenlämpötilat -listaan
// (ks. openWaterTempList). Sijoitettu juuri "Katso muutokset" -rivin
// YLÄPUOLELLE, samalla matalan käyttötiheyden -periaatteella kuin se –
// ei saa kilpailla huomiosta suosikkien/asemalistan kanssa sovellusta
// avatessa.
const waterTempFooterBtn = document.createElement("button");
waterTempFooterBtn.type = "button";
waterTempFooterBtn.className = "changelog-footer-btn";
waterTempFooterBtn.innerHTML = `
  <span>💧 Muut vedenlämpötilat</span>
  <span class="station-item-chevron">›</span>
`;
waterTempFooterBtn.addEventListener("click", openWaterTempList);
listEl.appendChild(waterTempFooterBtn);

// Listan viimeinen rivi: linkki Muutokset-sisältöön. Tarkoituksella
// aivan lopussa (ei alussa/kiinnitettynä) – matalan käyttötiheyden
// toiminto, joka ei saa kilpailla huomiosta suosikkien/asemalistan
// kanssa sovellusta avatessa (sama periaate kuin desktopin syrjään
// sijoitetussa Muutokset-napissa).
const changelogFooterBtn = document.createElement("button");
changelogFooterBtn.type = "button";
changelogFooterBtn.className = "changelog-footer-btn";
changelogFooterBtn.innerHTML = `
  <span>🆕 Katso muutokset</span>
  <span class="station-item-chevron">›</span>
`;
changelogFooterBtn.addEventListener("click", openChangelog);
listEl.appendChild(changelogFooterBtn);

refreshFavoritesSection();
loadStationWindIndicators();
