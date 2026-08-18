// ==========================
// Tuuliennusteanimaation ohjaus (kanvaasi + liukusäädin + napit +
// nykytuulilukema otsikossa).
//
// Jaettu osa, jota käyttävät sekä täysi asemakortti
// (js/popup/stationDetail.js) että kevyt Open-Meteo-tuuliasemien
// popup (js/popup/openMeteoWindPopup.js). Odottaa että containerEl
// sisältää jo tarvittavat elementit valmiiksi renderöitynä HTML-
// templatesta: canvas.wind-flow-canvas, canvas.wind-flow-bg,
// .wind-flow-btn (napit), .wind-flow-slider, .wind-flow-time-label,
// .wind-flow-ticks, .wind-flow-speed-label (valinnainen).
//
// Palauttaa { stop, data } – stop() pysäyttää käynnissä olevan
// animaation, data on fetchWindGridSeries():n palauttama sarja.
// ==========================

import { fetchWindGridSeries } from "../api/openMeteoWind.js";
import { renderWindFlow } from "../charts/windFlow.js";
import { drawMapBackground } from "../charts/miniMapBackground.js";

export async function renderWindFlowAnimation(containerEl, lat, lon) {

  let localStop = null;

  function stop() {
    if (localStop) {
      localStop();
      localStop = null;
    }
  }

  const flowCanvas = containerEl.querySelector(".wind-flow-canvas");
  const flowBgCanvas = containerEl.querySelector(".wind-flow-bg");
  const flowButtons = containerEl.querySelectorAll(".wind-flow-btn");
  const flowSlider = containerEl.querySelector(".wind-flow-slider");
  const flowTimeLabel = containerEl.querySelector(".wind-flow-time-label");
  const flowTicksEl = containerEl.querySelector(".wind-flow-ticks");
  const flowSpeedLabel = containerEl.querySelector(".wind-flow-speed-label");

  if (!flowCanvas) return { stop, data: null };

  // Asetetaan kanvaasien sisäinen piirtoresoluutio vastaamaan niiden
  // todellista CSS-renderöityä kokoa. Aiemmin kanvaasit olivat aina
  // kiinteän 320×320-neliön kokoisia (sekä HTML-attribuutti että
  // näytetty koko), mutta desktopilla animaatio levitettiin nyt
  // popupin/graafien levyiseksi (ei enää neliö) ja mobiilissa koko
  // voi vaihdella näytön leveyden mukaan – ilman tätä synkronointia
  // kanvaasi piirtyisi vanhaan kiinteään resoluutioon ja selain
  // venyttäisi/sumentaisi sen näytettyyn kokoon.
  function syncCanvasResolution(canvas) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  syncCanvasResolution(flowCanvas);
  syncCanvasResolution(flowBgCanvas);

  let windSeriesData = null;

  function renderFlowTicks(maxIdx) {
    if (!flowTicksEl) return;

    const tickCount = maxIdx >= 4 ? 5 : maxIdx + 1;
    const ticks = [];

    for (let i = 0; i < tickCount; i++) {
      ticks.push(Math.round((maxIdx * i) / (tickCount - 1)));
    }

    flowTicksEl.innerHTML = ticks
      .map(h => `<span>${h === 0 ? "nyt" : h + "h"}</span>`)
      .join("");
  }

  function showWindFlowOffset(offsetHours) {

    if (!windSeriesData || !windSeriesData.series.length) return;

    const idx = Math.max(
      0,
      Math.min(windSeriesData.series.length - 1, offsetHours)
    );

    stop();

    localStop = renderWindFlow(flowCanvas, {
      grid: windSeriesData.series[idx],
      size: windSeriesData.size
    });

    flowButtons.forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.offset) === idx);
    });

    if (flowSlider) flowSlider.value = idx;

    if (flowTimeLabel) {
      const hourDate = windSeriesData.hours[idx];
      flowTimeLabel.textContent = idx === 0
        ? "Nyt"
        : `+${idx}h (${hourDate.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })})`;
    }

    if (flowSpeedLabel) {
      const wind = windSeriesData.stationWind?.[idx];
      if (wind && wind.speed != null) {
        const speedTxt = wind.speed.toFixed(1);
        const gustTxt = wind.gust != null ? `, puuskat ${wind.gust.toFixed(1)} m/s` : "";
        flowSpeedLabel.textContent = `💨 ${speedTxt} m/s${gustTxt}`;
      } else {
        flowSpeedLabel.textContent = "";
      }
    }
  }

  flowButtons.forEach(btn => {
    btn.onclick = () => showWindFlowOffset(Number(btn.dataset.offset));
  });

  if (flowSlider) {
    flowSlider.oninput = () => showWindFlowOffset(Number(flowSlider.value));
  }

  try {
    // Kanvaasin kuvasuhde (syncCanvasResolution on jo asettanut
    // canvas.width/height todelliseen renderöityyn kokoon yllä).
    // Välitetään se haulle, jotta haettu maastoalue levenee samassa
    // suhteessa kuin kanvaasi on neliötä leveämpi – muuten sekä
    // karttatausta (miniMapBackground.js) että virtausviivat
    // (windFlow.js) venyisivät sivusuunnassa, koska molemmat
    // piirtävät aina täyteen kanvaasin leveyteen/korkeuteen. Neliö-
    // muotoisilla kanvaaseilla (esim. Ruotsi/Viro-asemien 320×320-
    // popup) suhde on 1 eikä mikään muutu.
    const aspectRatio = flowCanvas.height > 0
      ? flowCanvas.width / flowCanvas.height
      : 1;

    windSeriesData = await fetchWindGridSeries(lat, lon, aspectRatio);

    if (flowBgCanvas) {
      drawMapBackground(flowBgCanvas, windSeriesData.bounds).catch(err => {
        console.warn("Karttataustan lataus epäonnistui:", err);
      });
    }

    const maxIdx = windSeriesData.series.length - 1;

    if (flowSlider) {
      flowSlider.max = maxIdx;
    }

    renderFlowTicks(maxIdx);

    // "Viimeisin ennuste" -nappi osoittaa aina sarjan viimeiseen
    // saatavilla olevaan tuntiin (yleensä ~36-47h, riippuu kellonajasta).
    const lastBtn = containerEl.querySelector(".wind-flow-btn-last");
    if (lastBtn) {
      lastBtn.dataset.offset = maxIdx;
      lastBtn.textContent = `💨 ${maxIdx}h (viimeisin)`;
    }

    showWindFlowOffset(0);

  } catch (err) {
    console.warn("Tuulivirtauksen haku epäonnistui:", err);
  }

  return { stop, data: windSeriesData };
}
