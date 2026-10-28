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

// Toistossa tuntien välinen siirtymä tehdään ristiinhäivytyksellä (kaksi
// päällekkäistä hiukkaskerrosta): piilossa oleva kerros saa seuraavan tunnin
// datan, "lämpiää" WARMUP_MS ja häivytetään näkyviin FADE_MS aikana samalla
// kun nykyinen häivytetään pois. Näin hiukkaset eivät nollaudu/hyppää.
// PLAY_INTERVAL_MS pitää olla pidempi kuin WARMUP_MS + FADE_MS.
const PLAY_INTERVAL_MS = 1200;
const WARMUP_MS = 250;
const FADE_MS = 900;

// Hiukkasten ulkoasun säätö (kokeellinen, helppo hienosäätää):
//  PARTICLE_DENSITY      hiukkasia / kuvapiste (pienempi = harvempi). 1/220 oli liian tiheä.
//  PARTICLE_LINE_WIDTH   viivan paksuus pikseleinä
//  PARTICLE_TRAIL_OPACITY  0..1, pienempi = lyhyempi/haalea häntä, suurempi = pidempi
//  PARTICLE_SPEED        hiukkasten liikenopeus
const PARTICLE_DENSITY = 1 / 700;
const PARTICLE_LINE_WIDTH = 1.5;
const PARTICLE_TRAIL_OPACITY = 0.85;
const PARTICLE_SPEED = 0.012;

// Taustakartan tummennus tuulikartan ollessa päällä (1 = ei tummennusta).
// brightness: 0.55 oli liian tumma; saturate: värikylläisyys.
const MAP_DIM_FILTER = "brightness(0.68) saturate(0.8)";

// Väriasteikko 0 -> 25+ m/s. Kaikki sävyt ovat kylläisiä (ei lähes valkoisia),
// jotta heikkokin tuuli erottuu kartasta. Legenda-palkki rakentuu tästä automaattisesti.
const COLOR_SCALE = [
  "rgb(70,130,255)", "rgb(30,165,245)", "rgb(0,195,225)", "rgb(0,205,170)",
  "rgb(40,200,110)", "rgb(110,210,60)", "rgb(175,215,40)", "rgb(240,215,35)",
  "rgb(255,175,30)", "rgb(255,135,30)", "rgb(250,95,40)", "rgb(240,55,50)",
  "rgb(215,30,75)", "rgb(190,25,120)", "rgb(150,30,170)"
];

const STYLE = `
.windmap-toggle-btn.active { background: #e3f2fd; color: #0d47a1; }
.windmap-toggle-btn.loading { opacity: 0.6; cursor: wait; }

/* Tummennetaan taustakartta, jotta vaaleat tuulihiukkaset erottuvat */
.windmap-dim .leaflet-tile-pane { filter: ${MAP_DIM_FILTER}; }

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

.windmap-readout {
  position: fixed;
  left: 10px;
  bottom: 28px;
  z-index: 2000;
  white-space: nowrap;
  background: rgba(255,255,255,0.92);
  border-radius: 4px;
  padding: 4px 9px;
  font-size: 14px;
  font-weight: 700;
  color: #222;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  display: none;
  pointer-events: none;
}
.windmap-readout.visible { display: block; }
.windmap-readout:empty { display: none !important; }

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

  // Hiirellä osoitetun kohdan tuulilukema (oma, koska ristiinhäivytyksessä
  // kaksi kerrosta eikä kirjaston oma lukema pysyisi ajan tasalla)
  const readoutEl = document.createElement("div");
  readoutEl.className = "windmap-readout";
  document.body.appendChild(readoutEl);

  let manifest = null;
  let layers = [null, null];   // kaksi päällekkäistä velocity-kerrosta
  let front = 0;               // kumpi kerroksista on nyt näkyvissä
  let currentData = null;      // näytettävän tunnin data (lukemaa varten)
  let visible = false;
  let playing = false;
  let requestToken = 0;
  const cache = new Map();

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const DIRS = ["P", "KO", "I", "KA", "E", "LO", "L", "LU"];

  function updateReadout(latlng) {
    if (!currentData || !latlng) return;
    const h = currentData[0].header;
    const col = Math.round((latlng.lng - h.lo1) / h.dx);
    const row = Math.round((h.la1 - latlng.lat) / h.dy);
    if (col < 0 || row < 0 || col >= h.nx || row >= h.ny) {
      readoutEl.textContent = "Ei tuulitietoa";
      return;
    }
    const k = row * h.nx + col;
    const u = currentData[0].data[k];
    const v = currentData[1].data[k];
    const speed = Math.hypot(u, v);
    // suunta = mistä tuuli puhaltaa (meteorologinen)
    const from = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
    const name = DIRS[Math.round(from / 45) % 8];
    readoutEl.textContent =
      "Tuuli " + speed.toFixed(1).replace(".", ",") + " m/s, " + name + " (" + Math.round(from) + "°)";
  }

  function onMouseMove(e) {
    updateReadout(e.latlng);
    // Lukema seuraa hiirtä (kiinteä vasen alakulma voi jäädä muiden elementtien alle)
    const oe = e.originalEvent;
    if (oe) {
      readoutEl.style.left = Math.min(oe.clientX + 16, window.innerWidth - 220) + "px";
      readoutEl.style.top = Math.max(oe.clientY - 34, 4) + "px";
      readoutEl.style.bottom = "auto";
    }
  }
  function onMouseOut() { readoutEl.textContent = ""; readoutEl.style.display = ""; }

  function makeLayer(data) {
    const lyr = L.velocityLayer({
      displayValues: false,
      data,
      maxVelocity: 25,
      velocityScale: PARTICLE_SPEED,
      lineWidth: PARTICLE_LINE_WIDTH,
      particleMultiplier: PARTICLE_DENSITY,
      colorScale: COLOR_SCALE,
      opacity: PARTICLE_TRAIL_OPACITY
    });
    lyr.addTo(map);
    const c = canvasOf(lyr);
    if (c) c.style.transition = "opacity " + FADE_MS + "ms linear";
    return lyr;
  }

  function canvasOf(lyr) {
    return lyr && lyr._canvasLayer && lyr._canvasLayer._canvas;
  }

  function setLayerOpacity(lyr, value) {
    const c = canvasOf(lyr);
    if (c) c.style.opacity = String(value);
  }

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

  // smooth = true: ristiinhäivytys (toisto). false: välitön vaihto (liukusäädin, alku).
  async function showHour(index, smooth) {
    const token = ++requestToken;
    const data = await loadHour(index);
    if (token !== requestToken) return; // uudempi pyyntö ohitti tämän

    if (!layers[front]) {
      // ensimmäinen näyttö
      layers[front] = makeLayer(data);
      setLayerOpacity(layers[front], 1);
    } else if (!smooth) {
      // välitön vaihto: päivitä näkyvä kerros, piilota toinen
      layers[front].setData(data);
      setLayerOpacity(layers[front], 1);
      if (layers[1 - front]) setLayerOpacity(layers[1 - front], 0);
    } else {
      // ristiinhäivytys: valmistele piilossa oleva kerros
      const back = 1 - front;
      if (!layers[back]) {
        layers[back] = makeLayer(data);
        setLayerOpacity(layers[back], 0);
      } else {
        layers[back].setData(data);
      }
      await sleep(WARMUP_MS); // hiukkaset ehtivät piirtää hännät
      if (token !== requestToken || !visible) return;
      setLayerOpacity(layers[back], 1);
      setLayerOpacity(layers[front], 0);
      front = back;
    }

    currentData = data;
    slider.value = index;
    timeEl.textContent = fmtTime(manifest.hours[index].time);
    // esilataus seuraavalle tunnille
    if (index + 1 < manifest.hours.length) loadHour(index + 1).catch(() => {});
  }

  function stopPlaying() {
    playing = false;
    playBtn.textContent = "▶";
  }

  async function startPlaying() {
    playing = true;
    playBtn.textContent = "❚❚";
    while (playing && visible) {
      const t0 = Date.now();
      let next = Number(slider.value) + 1;
      if (next >= manifest.hours.length) next = 0;
      try {
        await showHour(next, true);
      } catch (err) {
        console.warn("Toisto pysähtyi:", err);
        stopPlaying();
        return;
      }
      await sleep(Math.max(0, PLAY_INTERVAL_MS - (Date.now() - t0)));
    }
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
      await showHour(nearestHourIndex(), false);

      map.getContainer().classList.add("windmap-dim");
      map.on("mousemove", onMouseMove);
      map.on("mouseout", onMouseOut);
      readoutEl.classList.add("visible");
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
    requestToken++; // keskeytä mahdollinen käynnissä oleva siirtymä
    layers.forEach(lyr => { if (lyr) map.removeLayer(lyr); });
    layers = [null, null];
    front = 0;
    currentData = null;
    map.off("mousemove", onMouseMove);
    map.off("mouseout", onMouseOut);
    readoutEl.classList.remove("visible");
    readoutEl.textContent = "";
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
    showHour(Number(slider.value), false).catch(err => console.warn(err));
  });

}
