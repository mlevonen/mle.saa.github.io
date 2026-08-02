// ==========================
// Sadetutkan aikaliukusäädin
//
// Klikkaamalla kartan oikean yläkulman "Sadetutka"-nappia avautuu
// kortti, jossa liukusäätimellä voi selata tutkakuvan historiaa.
//
// HUOM ennuste: Ilmatieteen laitoksen avoimen WMS-tutkarajapinnan
// (openwms.fmi.fi/geoserver/wms) aikaulottuvuus sisältää vain
// menneitä/nykyisiä havaintoja – testattu suoraan rajapinnasta
// (tulevaisuuteen osoittava TIME-arvo palauttaa
// "InvalidDimensionValue"-virheen). Avoimessa datassa ei siis ole
// sademallin ennustetta tälle tasolle, joten liukusäädin kattaa
// vain historian.
// ==========================

const STEP_MINUTES = 5;
const HISTORY_STEPS = 36; // 36 x 5 min = 3 h historiaa
const LIVE_REFRESH_MS = 5 * 60 * 1000;

function floorToStep(date) {
  const ms = date.getTime();
  const stepMs = STEP_MINUTES * 60 * 1000;
  return new Date(Math.floor(ms / stepMs) * stepMs);
}

function formatTimeLabel(date) {
  return date.toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Helsinki"
  });
}

export function initRadarPanel(map, radarLayer) {

  const RadarControl = L.Control.extend({

    options: { position: "topright" },

    onAdd() {

      const container = L.DomUtil.create("div", "radar-control leaflet-bar");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const toggleBtn = L.DomUtil.create("button", "radar-control-toggle", container);
      toggleBtn.type = "button";
      toggleBtn.title = "Sadetutka";
      toggleBtn.innerHTML = "🌧️";

      const panel = L.DomUtil.create("div", "radar-panel", container);
      panel.innerHTML = `
        <div class="radar-panel-header">Sadetutka</div>
        <div class="radar-panel-time">Nyt</div>
        <input type="range" class="radar-slider" min="0" max="${HISTORY_STEPS}" value="${HISTORY_STEPS}" step="1">
        <div class="radar-panel-row">
          <span class="radar-panel-time-label">-3 h</span>
          <button type="button" class="radar-play" title="Toista historia">&#9654;</button>
          <span class="radar-panel-time-label">Nyt</span>
        </div>
        <div class="radar-panel-note">
          Historia n. 3 h taaksepäin. Ennustetta ei ole saatavilla
          Ilmatieteen laitoksen avoimessa datassa tälle tasolle.
        </div>
      `;

      const timeEl = panel.querySelector(".radar-panel-time");
      const sliderEl = panel.querySelector(".radar-slider");
      const playBtn = panel.querySelector(".radar-play");

      let open = false;
      let liveRefreshTimer = null;
      let playTimer = null;

      function stopPlay() {
        if (playTimer) {
          clearInterval(playTimer);
          playTimer = null;
          playBtn.innerHTML = "&#9654;";
        }
      }

      function applySliderPosition() {

        const v = Number(sliderEl.value);
        const atLive = v === HISTORY_STEPS;

        if (atLive) {
          radarLayer.setParams({ time: "current" });
          timeEl.textContent = "Nyt";
          return;
        }

        const stepsBack = HISTORY_STEPS - v;
        const target = new Date(
          floorToStep(new Date()).getTime() - stepsBack * STEP_MINUTES * 60 * 1000
        );

        radarLayer.setParams({ time: target.toISOString() });
        timeEl.textContent = formatTimeLabel(target);

      }

      function startLiveRefresh() {
        stopLiveRefresh();
        liveRefreshTimer = setInterval(() => {
          // Päivitetään vain, jos säädin on edelleen "Nyt"-kohdassa
          if (Number(sliderEl.value) === HISTORY_STEPS) {
            applySliderPosition();
          }
        }, LIVE_REFRESH_MS);
      }

      function stopLiveRefresh() {
        if (liveRefreshTimer) {
          clearInterval(liveRefreshTimer);
          liveRefreshTimer = null;
        }
      }

      function openPanel() {
        open = true;
        container.classList.add("open");
        if (!map.hasLayer(radarLayer)) {
          map.addLayer(radarLayer);
        }
        applySliderPosition();
        startLiveRefresh();
      }

      function closePanel() {
        open = false;
        container.classList.remove("open");
        stopPlay();
        stopLiveRefresh();
        if (map.hasLayer(radarLayer)) {
          map.removeLayer(radarLayer);
        }
      }

      L.DomEvent.on(toggleBtn, "click", () => {
        if (open) {
          closePanel();
        } else {
          openPanel();
        }
      });

      L.DomEvent.on(sliderEl, "input", () => {
        stopPlay();
        applySliderPosition();
      });

      L.DomEvent.on(playBtn, "click", () => {

        if (playTimer) {
          stopPlay();
          return;
        }

        playBtn.innerHTML = "&#9616;&#9616;";

        playTimer = setInterval(() => {
          let v = Number(sliderEl.value) + 1;
          if (v > HISTORY_STEPS) v = 0;
          sliderEl.value = v;
          applySliderPosition();
        }, 600);

      });

      return container;

    }

  });

  map.addControl(new RadarControl());

}
