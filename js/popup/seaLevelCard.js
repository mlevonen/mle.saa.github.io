// ==========================
// Vedenkorkeuskortin täyttö – jaettu desktop-popupin JA mobiilinäkymän
// kesken.
//
// renderSeaLevelCard(containerEl, station) hakee lähimmän
// vedenkorkeusaseman lukemat (WATLEV + N2000 + veden pintalämpötila)
// ja täyttää ne containerEl:n sisältä löytyviin elementteihin.
// Piilottaa kortin kokonaan maa-asemilta (station.inland), koska
// lähin vedenkorkeusasema voisi olla satoja kilometrejä päässä eikä
// lukema liity mitenkään kyseiseen sisämaan pisteeseen.
//
// Odottaa containerEl:n sisältä löytyvän:
//   .popup-sealevel-card
//   .wind-flow-sealevel-value[data-kind="watlev"]
//   .wind-flow-sealevel-value[data-kind="n2000"]
//   .current-watertemp-block (valinnainen, ks. currentConditionsCard.js –
//     sisempi lohko .current-watertemp-item-kortin sisällä; ulomman
//     kortin näkyvyyden päättää updateMergedCardVisibility yhdessä
//     .current-visibility-blockin kanssa, ei tämä tiedosto)
// (puuttuvat elementit ohitetaan hiljaisesti – funktio ei vaadi
// tiettyä ympäröivää rakennetta.)
//
// HUOM veden lämpötila: sama "fmi::observations::mareograph::instant::
// simple" -kutsu (fetchSeaLevel) sisältää myös TW-parametrin (veden
// pintalämpötila celsiusasteina), joten sama, jo tehty verkkopyyntö
// riittää sekä vedenkorkeus- että vedenlämpökorttiin – ei tarvita
// erillistä hakua.
// ==========================

import { fetchSeaLevel, findNearestSeaLevelStation } from "../api/sealevel.js";

// Väriasteikko veden lämpötilalle – karkea "miltä tuntuisi uida"
// -jaottelu, sama periaate kuin tuulen nopeuden väriasteikossa
// (ks. currentConditionsCard.js windSpeedColor()).
export function waterTempColor(t) {
  if (t == null) return "#9e9e9e";
  return t < 10 ? "#0277bd" :
         t < 15 ? "#0097a7" :
         t < 18 ? "#00897b" :
         t < 22 ? "#43a047" :
                  "#fb8c00";
}

export async function renderSeaLevelCard(containerEl, station) {

  const seaLevelCard = containerEl.querySelector(".popup-sealevel-card");
  const seaLevelWatlevEl = containerEl.querySelector('.wind-flow-sealevel-value[data-kind="watlev"]');
  const seaLevelN2000El = containerEl.querySelector('.wind-flow-sealevel-value[data-kind="n2000"]');

  const waterTempWrapper = containerEl.querySelector(".current-watertemp-block");
  const waterTempValueEl = containerEl.querySelector(".current-watertemp-value");
  const waterTempCircleEl = containerEl.querySelector(".current-watertemp-circle");
  const waterTempSourceEl = containerEl.querySelector(".current-watertemp-source");

  if (station.inland) {
    if (seaLevelCard) seaLevelCard.style.display = "none";
    if (waterTempWrapper) waterTempWrapper.style.display = "none";
    return;
  }

  if (seaLevelCard) seaLevelCard.style.display = "";

  if (!seaLevelWatlevEl && !seaLevelN2000El && !waterTempWrapper) return;

  const nearestSea = findNearestSeaLevelStation(station.lat, station.lon);
  const formatLevel = v => v != null ? `${v > 0 ? "+" : ""}${v} cm` : "–";

  if (!nearestSea) {
    if (seaLevelWatlevEl) seaLevelWatlevEl.textContent = "–";
    if (seaLevelN2000El) seaLevelN2000El.textContent = "–";
    if (waterTempWrapper) waterTempWrapper.style.display = "none";
    return;
  }

  // HUOM: asemanimi voi olla pitkä (esim. "Turku Ruissalo
  // Saaronniemi") ja se katkaistaan tarvittaessa visuaalisesti CSS:n
  // ellipsis-säännöllä (ks. .wind-flow-sealevel-value, index.html),
  // jotta se ei enää pakota koko korttia (ja CSS Grid -saraketta)
  // leveämmäksi. title-attribuutti näyttää silti täyden nimen hover-
  // vihjeenä.
  try {
    const { watlev, n2000, waterTemp } = await fetchSeaLevel(nearestSea.fmisid);
    if (seaLevelWatlevEl) {
      seaLevelWatlevEl.textContent = `${formatLevel(watlev)} (${nearestSea.name})`;
      seaLevelWatlevEl.title = nearestSea.name;
    }
    if (seaLevelN2000El) {
      seaLevelN2000El.textContent = `${formatLevel(n2000)} (${nearestSea.name})`;
      seaLevelN2000El.title = nearestSea.name;
    }

    if (waterTempWrapper) {
      if (Number.isFinite(waterTemp)) {
        if (waterTempValueEl) waterTempValueEl.textContent = `${waterTemp.toFixed(1)} °C`;
        if (waterTempCircleEl) waterTempCircleEl.style.backgroundColor = waterTempColor(waterTemp);
        if (waterTempSourceEl) {
          waterTempSourceEl.textContent = `Lähin: ${nearestSea.name}`;
          waterTempSourceEl.title = nearestSea.name;
        }
        waterTempWrapper.style.display = "";
      } else {
        // Ei lukemaa juuri nyt – piilotetaan kokonaan sen sijaan että
        // näytettäisiin harhaanjohtava tyhjä/harmaa kortti.
        waterTempWrapper.style.display = "none";
      }
    }
  } catch (err) {
    if (seaLevelWatlevEl) {
      seaLevelWatlevEl.textContent = `– (${nearestSea.name})`;
      seaLevelWatlevEl.title = nearestSea.name;
    }
    if (seaLevelN2000El) {
      seaLevelN2000El.textContent = `– (${nearestSea.name})`;
      seaLevelN2000El.title = nearestSea.name;
    }
    if (waterTempWrapper) waterTempWrapper.style.display = "none";
  }

}
