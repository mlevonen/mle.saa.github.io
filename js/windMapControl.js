// ==========================
// "Tuulikartta" (KOKEELLINEN) – koko näytön elävä tuulikartta
//
// Piirtää kartan päälle liikkuvat tuulihiukkaset (leaflet-velocity) ja
// aikaliukusäätimen. Data tulee webhotellin ajastetun skriptin
// (server/windgrid/update.py) tuottamista tiedostoista:
//   windgrid/data/manifest.json   – lista tunneista + ajon tiedot
//   windgrid/data/wind_YYYYMMDDTHH.json – yksi tunti (u/v, leaflet-velocity-muoto)
// Lähde: Ilmatieteen laitos, Harmonie (CC BY 4.0).
//
// PIILOTETTU: ominaisuus aktivoituu vain, jos osoitteessa on
// ?tuulikartta=1 (esim. https://merisaa.fi/?tuulikartta=1). Ilman sitä
// tämä moduuli ei tee mitään (ei nappia, ei verkkopyyntöjä), joten
// tavallisille käyttäjille sivu on täsmälleen ennallaan.
//
// ERISTETTY: ei vaadi muutoksia index.html:ään. Tyylit injektoidaan
// täältä ja leaflet-velocity ladataan CDN:stä vasta ensimmäisellä
// kytkennällä. Pois ottaminen: poista import + initWindMapControl-kutsu
// main.js:stä (ks. kommentit sieltä).
// ==========================

const VELOCITY_JS = "https://cdn.jsdelivr.net/npm/leaflet-velocity@2.1.4/dist/leaflet-velocity.min.js";
const VELOCITY_CSS = "https://cdn.jsdelivr.net/npm/leaflet-velocity@2.1.4/dist/leaflet-velocity.min.css";

// Merisaa.fi:ssä data on samalla palvelimella; muualta (esim. Vercel-demo)
// haetaan tuotannosta (palvelin lähettää CORS-otsakkeen, ks. data/.htaccess).
const DATA_BASE = /(^|\.)merisaa\.fi$/.test(location.hostname)
  ? "windgrid/data/"
  : "https://merisaa.fi/windgrid/data/";

const STALE_ORIGIN_HOURS = 9;   // Harmonie-ajo yli näin vanha -> varoitus
const STALE_CHECK_HOURS = 6;    // päivitysskripti ei ole ajossa -> varoitus
const PLAY_INTERVAL_MS = 1200;

const COLOR_SCALE = [
  "rgb(36,104,180)", "rgb(60,157,194)", "rgb(128,205,193)", "rgb(151,218,168)",
  "rgb(198,231,181)", "rgb(238,247,217)", "rgb(255,238,159)", "rgb(252,217,125)",
  "rgb(255,182,100)", "rgb(252,150,75)", "rgb(250,112,52)", "rgb(245,64,32)",
  "rgb(237,45,28)", "rgb(220,24,32)", "rgb(180,0,35)"
];

const STYLE = `
.windmap-toggle-btn.active { background: #e3f2fd; color: #0d47a1; }
.windmap-toggle-btn.loading { opacity: 0.6; cursor: wait; }

/* Tummennetaan taustakartta, jotta vaaleat tuulihiukkaset erottuvat */
.windmap-dim .leaflet-tile-pane { filter: brightness(0.55) saturate(0.6); }

.windmap-panel {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  width: min(560px, calc(100vw - 280px));
  min-width: 300px;
  background: rgba(255,255,255,0.95);
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  padding: 10px 14px 8px;
  z-index: 1000;
  font-family: inherit;
  font-size: 13px;
  color: #222;
  display: none;
}
.windmap-panel.visible { display: block; }

.windmap-row { display: flex; align-items: center; gap: 10px; }
.windmap-play {
  flex: none; width: 34px; height: 34px; border-radius: 50%;
  border: none; background: #0d47a1; color: #fff; font-size: 14px; cursor: pointer;
}
.windmap-slider { flex: 1; min-width: 0; }
.windmap-time { flex: none; min-width: 132px; text-align: right; font-weight: 700; }

.windmap-info { margin-top: 6px; font-size: 11px; color: #666; line-height: 1.35; }
.windmap-warn { color: #c62828; font-weight: 700; }
.windmap-legend {
  height: 8px; margin-top: 8px; border-radius: 4px;
  background: linear-gradient(to right, ${COLOR_SCALE.join(",")});
}
.windmap-legend-labels {
  display: flex; justify-content: space-between;
  font-size: 10px; color: #666; margin-top: 2px;
}
`;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Skriptin lataus epäonnistui: " + src));
    document.head.appendChild(s);
  });
}

function loadCss(href) {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("fi-FI", {
    weekday: "short", day: "numeric", month: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function fmtClock(iso) {
  return new Date(iso).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" });
}

export function initWindMapControl(map) {

  // Piilotettu: vain ?tuulikartta=1
  if (!new URLSearchParams(location.search).has("tuulikartta")) return;

  const panelsEl = document.querySelector(".info-panels");
  if (!panelsEl) return;

  const styleEl = document.createElement("style");
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  // Nappi samalla ulkoasulla kuin Vedenlämpö/Merivaroitukset
  const wrap = document.createElement("div");
  wrap.className = "info-panel";
  wrap.innerHTML = `
    <button type="button" class="info-panel-header windmap-toggle-btn" id="windmap-toggle-btn">
      <span class="btn-icon-label">
        <span class="windmap-icon">🌬️</span>
        <span>Tuulikartta (testi)</span>
      </span>
    </button>`;
  panelsEl.appendChild(wrap);
  const btn = wrap.querySelector("button");

  // Aikaliukusäädin
  const panel = document.createElement("div");
  panel.className = "windmap-panel";
  panel.innerHTML = `
    <div class="windmap-row">
      <button type="button" class="windmap-play" aria-label="Toista">▶</button>
      <input type="range" class="windmap-slider" min="0" max="0" value="0" step="1">
      <span class="windmap-time">–</span>
    </div>
    <div class="windmap-legend"></div>
    <div class="windmap-legend-labels"><span>0</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25+ m/s</span></div>
    <div class="windmap-info"></div>`;
  document.body.appendChild(panel);

  const playBtn = panel.querySelector(".windmap-play");
  const slider = panel.querySelector(".windmap-slider");
  const timeEl = panel.querySelector(".windmap-time");
  const infoEl = panel.querySelector(".windmap-info");

  // Leaflet-klikit eivät saa kulkea paneelin läpi kartalle
  if (window.L) {
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);
  }

  let manifest = null;
  let layer = null;
  let visible = false;
  let playing = false;
  let timer = null;
  let requestToken = 0;
  const cache = new Map();

  function setInfo(html) { infoEl.innerHTML = html; }

  function describeManifest() {
    const originH = (Date.now() - new Date(manifest.origin).getTime()) / 3600e3;
    const checkedH = (Date.now() - new Date(manifest.checked || manifest.updated).getTime()) / 3600e3;
    let html = `Ennuste: Harmonie-ajo ${fmtClock(manifest.origin)} (` +
      `${new Date(manifest.origin).toLocaleDateString("fi-FI")}). Lähde: Ilmatieteen laitos (CC BY 4.0). 10 m tuuli.`;
    if (originH > STALE_ORIGIN_HOURS || checkedH > STALE_CHECK_HOURS) {
      html = `<span class="windmap-warn">Tuulidata ei ole ajan tasalla (ajo ${fmtTime(manifest.origin)}).</span> ` + html;
    }
    return html;
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status + " (" + url + ")");
    return res.json();
  }

  async function loadHour(index) {
    const h = manifest.hours[index];
    if (!cache.has(h.file)) {
      cache.set(h.file, await fetchJson(DATA_BASE + h.file + "?o=" + encodeURIComponent(manifest.origin)));
    }
    return cache.get(h.file);
  }

  async function showHour(index) {
    const token = ++requestToken;
    const data = await loadHour(index);
    if (token !== requestToken) return; // uudempi pyyntö ohitti tämän
    if (!layer) {
      layer = L.velocityLayer({
        displayValues: true,
        displayOptions: {
          velocityType: "Tuuli",
          position: "bottomleft",
          emptyString: "Ei tuulitietoa",
          angleConvention: "meteoCW",
          showCardinal: false,
          speedUnit: "m/s",
          directionString: "Suunta",
          speedString: "Nopeus"
        },
        data,
        maxVelocity: 25,
        velocityScale: 0.012,
        lineWidth: 2,
        particleMultiplier: 1 / 220,
        colorScale: COLOR_SCALE,
        opacity: 0.9
      });
      layer.addTo(map);
    } else {
      layer.setData(data);
    }
    slider.value = index;
    timeEl.textContent = fmtTime(manifest.hours[index].time);
    // esilataus seuraavalle tunnille
    if (index + 1 < manifest.hours.length) loadHour(index + 1).catch(() => {});
  }

  function stopPlaying() {
    playing = false;
    playBtn.textContent = "▶";
    if (timer) { clearInterval(timer); timer = null; }
  }

  function startPlaying() {
    playing = true;
    playBtn.textContent = "❚❚";
    timer = setInterval(() => {
      let next = Number(slider.value) + 1;
      if (next >= manifest.hours.length) next = 0;
      showHour(next).catch(() => stopPlaying());
    }, PLAY_INTERVAL_MS);
  }

  function nearestHourIndex() {
    const now = Date.now();
    let idx = 0;
    manifest.hours.forEach((h, i) => {
      if (new Date(h.time).getTime() <= now) idx = i;
    });
    return idx;
  }

  async function turnOn() {
    btn.classList.add("loading");
    try {
      if (!window.L || !L.velocityLayer) {
        loadCss(VELOCITY_CSS);
        await loadScript(VELOCITY_JS);
      }
      manifest = await fetchJson(DATA_BASE + "manifest.json?t=" + Math.floor(Date.now() / 60000));
      if (!manifest.hours || !manifest.hours.length) throw new Error("Tyhjä manifest");

      slider.max = manifest.hours.length - 1;
      panel.classList.add("visible");
      setInfo(describeManifest());
      await showHour(nearestHourIndex());

      map.getContainer().classList.add("windmap-dim");
      visible = true;
      btn.classList.add("active");
    } catch (err) {
      console.warn("Tuulikartan lataus epäonnistui:", err);
      panel.classList.add("visible");
      timeEl.textContent = "–";
      setInfo(`<span class="windmap-warn">Tuulidataa ei saatu juuri nyt.</span>`);
      visible = true;
      btn.classList.add("active");
    } finally {
      btn.classList.remove("loading");
    }
  }

  function turnOff() {
    stopPlaying();
    if (layer) { map.removeLayer(layer); layer = null; }
    panel.classList.remove("visible");
    btn.classList.remove("active");
    map.getContainer().classList.remove("windmap-dim");
    visible = false;
  }

  btn.addEventListener("click", () => { visible ? turnOff() : turnOn(); });

  playBtn.addEventListener("click", () => {
    if (!manifest) return;
    playing ? stopPlaying() : startPlaying();
  });

  slider.addEventListener("input", () => {
    if (!manifest) return;
    showHour(Number(slider.value)).catch(err => console.warn(err));
  });

}
