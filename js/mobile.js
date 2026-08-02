// ==========================
// Mobiilinäkymä: tekstipohjainen lista havaintopisteistä
// merialueittain, kortti avautuu "bottom sheet" -tyylisenä
// kun asemaa napautetaan.
//
// Käyttää samaa asemakortin runkoa/logiikkaa kuin desktop-
// popupitkin (js/popup/stationDetail.js), joten kartta-
// pohjaista Leafletia ei tarvita lainkaan tässä näkymässä.
//
// stations.js ladataan (kuten index.html:ssäkin) tavallisena
// <script>-tagina ennen tätä moduulia, joten globaali `stations`-
// muuttuja on suoraan käytettävissä ilman importtia.
// ==========================

import { groupBySeaArea } from "./seaAreas.js";
import { stationDetailHTML, renderStationDetail } from "./popup/stationDetail.js";

const listEl = document.getElementById("station-list");
const overlayEl = document.getElementById("detail-overlay");
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

  sheetBodyEl.innerHTML = stationDetailHTML(station);
  overlayEl.classList.add("open");
  overlayEl.scrollTop = 0;

  const { stop } = await renderStationDetail(sheetBodyEl, station);
  currentStop = stop;
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
      .forEach(station => {

        const li = document.createElement("li");

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "station-item";
        btn.innerHTML = `
          <span class="station-item-name">${station.name}</span>
          <span class="station-item-chevron">›</span>
        `;
        btn.addEventListener("click", () => openStation(station));

        li.appendChild(btn);
        ul.appendChild(li);

      });

    section.appendChild(ul);
    listEl.appendChild(section);

  });

}
