// ==========================
// Sadetutkan aikaliukusäädin
//
// Klikkaamalla kartan oikean yläkulman "Sadetutka"-nappia avautuu
// kortti, jossa liukusäätimellä voi selata tutkakuvan historiaa.
//
// Tutkadata: RainViewer (api.rainviewer.com) – pehmennetyt tiilet,
// ei niin rasteroituneen/lohkoisen näköisiä kuin raaka WMS-tutkakuva.
// Rajapinta palauttaa vain menneet/nykyiset kehykset (n. 2 h
// historiaa 10 min välein) – ennustetta ei ole saatavilla ilmaisessa
// rajapinnassa, joten liukusäädin kattaa vain historian.
// ==========================

import { fetchRadarFrames, radarTileUrl } from "./api/rainviewer.js";

const LIVE_REFRESH_MS = 5 * 60 * 1000;

function formatTimeLabel(date) {
  return date.toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Helsinki"
  });
}

function formatHistorySpan(frames) {
  if (frames.length < 2) return "";
  const spanMin = Math.round((frames.at(-1).time - frames[0].time) / 60000);
  if (spanMin < 60) return `-${spanMin} min`;
  const hours = (spanMin / 60).toFixed(1).replace(/\.0$/, "");
  return `-${hours} h`;
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
        <div class="radar-panel-time">Ladataan…</div>
        <input type="range" class="radar-slider" min="0" max="0" value="0" step="1" disabled>
        <div class="radar-panel-row">
          <span class="radar-panel-time-label radar-panel-time-start">–</span>
          <button type="button" class="radar-play" title="Toista historia" disabled>&#9654;</button>
          <span class="radar-panel-time-label">Nyt</span>
        </div>
        <div class="radar-panel-note">
          Tutkadata: RainViewer. Ennustetta ei ole saatavilla ilmaisessa rajapinnassa.
        </div>
      `;

      const timeEl = panel.querySelector(".radar-panel-time");
      const sliderEl = panel.querySelector(".radar-slider");
      const playBtn = panel.querySelector(".radar-play");
      const startLabelEl = panel.querySelector(".radar-panel-time-start");
      const noteEl = panel.querySelector(".radar-panel-note");

      let open = false;
      let liveRefreshTimer = null;
      let playTimer = null;
      let frames = [];
      let host = "";
      let loadFailed = false;

      function stopPlay() {
        if (playTimer) {
          clearInterval(playTimer);
          playTimer = null;
          playBtn.innerHTML = "&#9654;";
        }
      }

      function applySliderPosition() {

        if (!frames.length) return;

        const v = Number(sliderEl.value);
        const frame = frames[v];
        const atLive = v === frames.length - 1;

        radarLayer.setUrl(radarTileUrl(host, frame.path));
        timeEl.textContent = atLive ? "Nyt" : formatTimeLabel(frame.time);

      }

      async function loadFrames({ keepPosition } = {}) {

        try {

          const wasAtLive = !frames.length || Number(sliderEl.value) === frames.length - 1;

          const result = await fetchRadarFrames();
          host = result.host;
          frames = result.frames;
          loadFailed = false;

          if (!frames.length) {
            timeEl.textContent = "Ei dataa";
            return;
          }

          sliderEl.max = frames.length - 1;
          sliderEl.disabled = false;
          playBtn.disabled = false;
          startLabelEl.textContent = formatHistorySpan(frames) || "–";

          if (!keepPosition || wasAtLive) {
            sliderEl.value = frames.length - 1;
          } else {
            // Pidetään käyttäjän valitsema kohta suunnilleen ennallaan,
            // jos hän oli selannut historiaa kun tuore kehyslista tuli.
            sliderEl.value = Math.min(Number(sliderEl.value), frames.length - 1);
          }

          applySliderPosition();

        } catch (err) {
          console.warn("RainViewer-tutkakehysten haku epäonnistui:", err);
          loadFailed = true;
          timeEl.textContent = "Ei saatavilla";
          noteEl.textContent = "Tutkadatan haku epäonnistui juuri nyt. Yritä myöhemmin uudelleen.";
        }

      }

      function startLiveRefresh() {
        stopLiveRefresh();
        liveRefreshTimer = setInterval(() => {
          loadFrames({ keepPosition: true });
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
        loadFrames();
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

        if (!frames.length) return;

        if (playTimer) {
          stopPlay();
          return;
        }

        playBtn.innerHTML = "&#9616;&#9616;";

        playTimer = setInterval(() => {
          let v = Number(sliderEl.value) + 1;
          if (v > frames.length - 1) v = 0;
          sliderEl.value = v;
          applySliderPosition();
        }, 600);

      });

      return container;

    }

  });

  map.addControl(new RadarControl());

}
