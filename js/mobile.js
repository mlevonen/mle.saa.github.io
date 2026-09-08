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

import { groupBySeaArea } from "./seaAreas.js";
import { mobileStationDetailHTML, renderMobileStationDetail } from "./popup/mobileStationDetail.js";
import { getFavoriteIds, isFavorite, toggleFavorite } from "./utils/favorites.js";
import { CHANGELOG } from "./changelogData.js";

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
    <span class="station-item-name">${station.name}</span>
    <span class="station-item-chevron">›</span>
  `;
  openBtn.addEventListener("click", () => openStation(station));

  row.appendChild(favBtn);
  row.appendChild(openBtn);
  li.appendChild(row);

  return li;

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

function refreshFavoritesSection() {

  const favIds = getFavoriteIds();
  const favStations = coastalStations.filter(s => favIds.includes(s.id));

  // Sama järjestys kuin muualla listassa (etelästä pohjoiseen, sitten
  // aakkosjärjestys), ei lisäysjärjestys – pysyy ennustettavana.
  const ordered = groupBySeaArea(favStations)
    .flatMap(g => g.stations.slice().sort((a, b) => a.name.localeCompare(b.name, "fi")));

  favoritesList.innerHTML = "";
  ordered.forEach(station => favoritesList.appendChild(createStationLi(station)));

  favoritesSection.style.display = ordered.length ? "" : "none";

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

    areaStations
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "fi"))
      .forEach(station => ul.appendChild(createStationLi(station)));

    section.appendChild(ul);
    listEl.appendChild(section);

  });

}

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
