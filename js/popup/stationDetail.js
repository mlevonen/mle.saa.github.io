// ==========================
// Asemakortin sisältö – jaettu desktop-popupin JA mobiilinäkymän
// kesken.
//
// stationDetailHTML(station)  → HTML-runko (samat luokat/rakenne
//   kuin ennen suoraan main.js:n marker.bindPopup()-kutsussa).
// renderStationDetail(containerEl, station) → täyttää rungon
//   datalla (havainnot, ennusteet, tuulivirtausanimaatio ym.).
//   Palauttaa { data, stop } – stop() pysäyttää mahdollisen
//   käynnissä olevan tuulivirtausanimaation.
//
// Kumpikaan funktio ei tiedä mitään Leafletista – containerEl voi
// olla mikä tahansa DOM-elementti (Leaflet-popupin sisältöelementti
// TAI tavallinen <div> mobiilinäkymän asemakortissa).
// ==========================

import { loadPopupData } from "../api/dataLoader.js";
import { updatePopupTitles } from "./popupTitles.js";
import { renderPopupExtras, renderSunCard, renderWaveCard, renderTempCard } from "./popupExtras.js";
import { renderWindCharts } from "../charts/windChart.js";
import { fetchSeaLevel, findNearestSeaLevelStation } from "../api/sealevel.js";
import { fetchWindGridSeries } from "../api/openMeteoWind.js";
import { renderWindFlow } from "../charts/windFlow.js";
import { drawMapBackground } from "../charts/miniMapBackground.js";

export function stationDetailHTML(station) {
  return `
    <div class="popup-title">${station.name}</div>
    <div class="popup-extras"></div>

    <div class="popup-note">
      ℹ️ Graafit perustuvat Ilmatieteen laitoksen dataan, tuuliennusteanimaatio Open-Meteon (MET Nordic) malliin. Eri ennustemallien vuoksi tuulilukemat voivat poiketa hieman toisistaan.
    </div>

    <div class="popup-card">
      <div><strong>Tuuli (havainto)</strong></div>
      <canvas
        class="popup-chart"
        width="650"
        height="140"
        data-lat="${station.lat}"
        data-lon="${station.lon}"
        data-fmisid="${station.fmisid}"
        data-type="wind-obs"
      ></canvas>
    </div>

    <div class="popup-card">
      <div><strong>Tuuli (ennuste)</strong></div>
      <canvas
        class="popup-chart"
        width="650"
        height="140"
        data-lat="${station.lat}"
        data-lon="${station.lon}"
        data-fmisid="${station.fmisid}"
        data-type="wind-fc"
      ></canvas>
    </div>

    <div class="popup-card">
      <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
        <strong>Tuuliennusteanimaatio</strong>
        <span class="wind-flow-speed-label" style="font-size:12px; font-weight:bold; color:#444;"></span>
      </div>
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <div class="wind-flow-wrapper" style="position:relative; width:320px; height:320px; flex-shrink:0;">
          <canvas
            class="wind-flow-bg"
            width="320"
            height="320"
            style="position:absolute; top:0; left:0;"
          ></canvas>
          <canvas
            class="wind-flow-canvas"
            width="320"
            height="320"
            style="position:absolute; top:0; left:0;"
            data-lat="${station.lat}"
            data-lon="${station.lon}"
          ></canvas>
        </div>
        <div class="wind-flow-sidebar" style="display:flex; flex-direction:column; gap:8px; width:345px;">
          <div class="popup-card-inner popup-temp-card">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Lämpötila</div>
            <div class="popup-temp-value">–</div>
          </div>

          <div class="popup-card-inner popup-sealevel-card">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Vedenkorkeus</div>
            <div class="wind-flow-sealevel-row">
              <span class="wind-flow-sealevel-label">Keskivesi</span>
              <span class="wind-flow-sealevel-value" data-kind="watlev">–</span>
            </div>
            <div class="wind-flow-sealevel-row">
              <span class="wind-flow-sealevel-label">N2000</span>
              <span class="wind-flow-sealevel-value" data-kind="n2000">–</span>
            </div>
          </div>

          <div class="popup-card-inner popup-wave-card" style="display:none;">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Aallokko</div>
            <div class="popup-wave-row">
              <span class="popup-wave-height-value">–</span>
              <span class="popup-wave-period-label">jakso <span class="popup-wave-period-value">–</span></span>
            </div>
          </div>

          <div class="popup-card-inner popup-sun-card" style="display:none;">
            <div style="font-size:12px; font-weight:600; margin-bottom:2px;">Sää</div>
            <div class="popup-sun-row">
              <div class="popup-inline-item">
                <img src="./js/assets/icons/sunrise.svg" class="popup-icon" alt="Auringonnousu">
                <span class="popup-sunrise-value">–</span>
              </div>
              <div class="popup-inline-item">
                <img src="./js/assets/icons/sunset.svg" class="popup-icon" alt="Auringonlasku">
                <span class="popup-sunset-value">–</span>
              </div>
            </div>
            <div class="popup-hourly-day"></div>
            <div class="popup-hourly-forecast"></div>
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px; margin-top:8px; width:320px;">
        <input
          type="range"
          class="wind-flow-slider"
          min="0"
          max="0"
          step="1"
          value="0"
          style="flex:1;"
        >
        <span class="wind-flow-time-label" style="font-size:12px; color:#444; min-width:78px; text-align:right;">Nyt</span>
      </div>
      <div style="display:flex; gap:8px; width:320px;">
        <div class="wind-flow-ticks" style="display:flex; justify-content:space-between; flex:1;"></div>
        <div style="min-width:78px;"></div>
      </div>

      <div class="wind-flow-controls">
        <button type="button" class="wind-flow-btn" data-offset="2">💨 2h</button>
        <button type="button" class="wind-flow-btn" data-offset="6">💨 6h</button>
        <button type="button" class="wind-flow-btn" data-offset="12">💨 12h</button>
        <button type="button" class="wind-flow-btn" data-offset="18">💨 18h</button>
        <button type="button" class="wind-flow-btn" data-offset="24">💨 24h</button>
        <button type="button" class="wind-flow-btn wind-flow-btn-last" data-offset="24">💨 …</button>
      </div>
    </div>
  `;
}

export async function renderStationDetail(containerEl, station) {

  let localStopWindFlow = null;

  function stop() {
    if (localStopWindFlow) {
      localStopWindFlow();
      localStopWindFlow = null;
    }
  }

  try {

    const data = await loadPopupData({
      lat: station.lat,
      lon: station.lon,
      weatherPlace: null,
      weatherFmisid: station.fmisid,
      seaLevelFmisid: null,
      // Maa-asemille (ent. Yr-asemat, station.inland) ei haeta
      // aallonkorkeutta, vaikka niiden type onkin "coastal" – ne
      // eivät ole meren rannalla.
      includeWave: station.type === "coastal" && !station.inland
    });

    updatePopupTitles(containerEl, data);
    renderPopupExtras(containerEl, data);
    renderSunCard(containerEl, data);
    renderWaveCard(containerEl, data, station);
    renderTempCard(containerEl, data);
    renderWindCharts(containerEl, data);

    // Lähimmän vedenkorkeusaseman lukemat sivupalkkiin (sekä
    // keskiveteen suhteutettu WATLEV että N2000-lukema). Maa-
    // asemille (station.inland) koko kortti piilotetaan – lähin
    // vedenkorkeusasema voisi olla satoja kilometrejä päässä eikä
    // lukema liity mitenkään kyseiseen sisämaan pisteeseen.
    const seaLevelCard = containerEl.querySelector(".popup-sealevel-card");
    const seaLevelWatlevEl = containerEl.querySelector('.wind-flow-sealevel-value[data-kind="watlev"]');
    const seaLevelN2000El = containerEl.querySelector('.wind-flow-sealevel-value[data-kind="n2000"]');

    if (station.inland) {
      if (seaLevelCard) seaLevelCard.style.display = "none";
    } else {

      if (seaLevelCard) seaLevelCard.style.display = "";

      if (seaLevelWatlevEl || seaLevelN2000El) {
        const nearestSea = findNearestSeaLevelStation(station.lat, station.lon);
        const formatLevel = v => v != null ? `${v > 0 ? "+" : ""}${v} cm` : "–";

        if (!nearestSea) {
          if (seaLevelWatlevEl) seaLevelWatlevEl.textContent = "–";
          if (seaLevelN2000El) seaLevelN2000El.textContent = "–";
        } else {
          try {
            const { watlev, n2000 } = await fetchSeaLevel(nearestSea.fmisid);
            if (seaLevelWatlevEl) {
              seaLevelWatlevEl.textContent = `${formatLevel(watlev)} (${nearestSea.name})`;
            }
            if (seaLevelN2000El) {
              seaLevelN2000El.textContent = `${formatLevel(n2000)} (${nearestSea.name})`;
            }
          } catch (err) {
            if (seaLevelWatlevEl) seaLevelWatlevEl.textContent = `– (${nearestSea.name})`;
            if (seaLevelN2000El) seaLevelN2000El.textContent = `– (${nearestSea.name})`;
          }
        }
      }
    }

    // Tuulen virtaus (Open-Meteo, animoitu hiukkaskenttä) + napit/liukusäädin
    const flowCanvas = containerEl.querySelector(".wind-flow-canvas");
    const flowBgCanvas = containerEl.querySelector(".wind-flow-bg");
    const flowButtons = containerEl.querySelectorAll(".wind-flow-btn");
    const flowSlider = containerEl.querySelector(".wind-flow-slider");
    const flowTimeLabel = containerEl.querySelector(".wind-flow-time-label");
    const flowTicksEl = containerEl.querySelector(".wind-flow-ticks");
    const flowSpeedLabel = containerEl.querySelector(".wind-flow-speed-label");

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

      localStopWindFlow = renderWindFlow(flowCanvas, {
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

    if (flowCanvas) {
      try {
        windSeriesData = await fetchWindGridSeries(station.lat, station.lon);

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
    }

    return { data, stop };

  } catch (err) {
    console.error("Asemakortin lataus epäonnistui:", err);
    return { data: null, stop };
  }

}
