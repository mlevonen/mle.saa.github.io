// ==========================
// Vedenkorkeuskortin täyttö – jaettu desktop-popupin JA mobiilinäkymän
// kesken.
//
// renderSeaLevelCard(containerEl, station) hakee lähimmän
// vedenkorkeusaseman lukemat (WATLEV + N2000) ja täyttää ne
// containerEl:n sisältä löytyviin elementteihin. Piilottaa kortin
// kokonaan maa-asemilta (station.inland), koska lähin
// vedenkorkeusasema voisi olla satoja kilometrejä päässä eikä
// lukema liity mitenkään kyseiseen sisämaan pisteeseen.
//
// Odottaa containerEl:n sisältä löytyvän:
//   .popup-sealevel-card
//   .wind-flow-sealevel-value[data-kind="watlev"]
//   .wind-flow-sealevel-value[data-kind="n2000"]
// (puuttuvat elementit ohitetaan hiljaisesti – funktio ei vaadi
// tiettyä ympäröivää rakennetta.)
// ==========================

import { fetchSeaLevel, findNearestSeaLevelStation } from "../api/sealevel.js";

export async function renderSeaLevelCard(containerEl, station) {

  const seaLevelCard = containerEl.querySelector(".popup-sealevel-card");
  const seaLevelWatlevEl = containerEl.querySelector('.wind-flow-sealevel-value[data-kind="watlev"]');
  const seaLevelN2000El = containerEl.querySelector('.wind-flow-sealevel-value[data-kind="n2000"]');

  if (station.inland) {
    if (seaLevelCard) seaLevelCard.style.display = "none";
    return;
  }

  if (seaLevelCard) seaLevelCard.style.display = "";

  if (!seaLevelWatlevEl && !seaLevelN2000El) return;

  const nearestSea = findNearestSeaLevelStation(station.lat, station.lon);
  const formatLevel = v => v != null ? `${v > 0 ? "+" : ""}${v} cm` : "–";

  if (!nearestSea) {
    if (seaLevelWatlevEl) seaLevelWatlevEl.textContent = "–";
    if (seaLevelN2000El) seaLevelN2000El.textContent = "–";
    return;
  }

  // HUOM: asemanimi voi olla pitkä (esim. "Turku Ruissalo
  // Saaronniemi") ja se katkaistaan tarvittaessa visuaalisesti CSS:n
  // ellipsis-säännöllä (ks. .wind-flow-sealevel-value, index.html),
  // jotta se ei enää pakota koko korttia (ja CSS Grid -saraketta)
  // leveämmäksi. title-attribuutti näyttää silti täyden nimen hover-
  // vihjeenä.
  try {
    const { watlev, n2000 } = await fetchSeaLevel(nearestSea.fmisid);
    if (seaLevelWatlevEl) {
      seaLevelWatlevEl.textContent = `${formatLevel(watlev)} (${nearestSea.name})`;
      seaLevelWatlevEl.title = nearestSea.name;
    }
    if (seaLevelN2000El) {
      seaLevelN2000El.textContent = `${formatLevel(n2000)} (${nearestSea.name})`;
      seaLevelN2000El.title = nearestSea.name;
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
  }

}
