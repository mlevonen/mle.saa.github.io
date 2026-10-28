const VELOCITY_JS = "https://cdn.jsdelivr.net/npm/leaflet-velocity@2.1.4/dist/leaflet-velocity.min.js";
const LAND_TOPO = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-10m.json";
const TOPOJSON_JS = "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js";
const VELOCITY_CSS = "https://cdn.jsdelivr.net/npm/leaflet-velocity@2.1.4/dist/leaflet-velocity.min.css";
const DATA_BASE = /(^|\.)merisaa\.fi$/.test(location.hostname)
? "windgrid/data/"
: "https://merisaa.fi/windgrid/data/";
const STALE_ORIGIN_HOURS = 9;
const STALE_CHECK_HOURS = 6;
const PLAY_INTERVAL_MS = 1200;
const WARMUP_MS = 250;
const FADE_MS = 900;
const PARTICLE_DENSITY = 1 / 4000;
const PARTICLE_DENSITY_FAR = 1 / 4500;
const FAR_PARTICLE_COLORS = [
"rgb(240,240,240)", "rgb(232,232,232)", "rgb(190,190,190)", "rgb(140,140,140)", "rgb(100,100,100)", "rgb(85,85,85)", "rgb(75,75,75)", "rgb(70,70,70)", "rgb(80,80,80)", "rgb(100,100,100)", "rgb(150,150,150)", "rgb(215,215,215)", "rgb(235,235,235)", "rgb(245,245,245)", "rgb(250,250,250)"
];
const PARTICLE_LINE_WIDTH = 1.5;
const PARTICLE_LINE_WIDTH_NEAR = 2.2;
const PARTICLE_TRAIL_OPACITY = 0.85;
const PARTICLE_SPEED = 0.012;
const MAP_DIM_FILTER = "brightness(0.68) saturate(0.8)";
const OPEN_BOUNDS = [[56.6, 15.5], [66.0, 30.5]];
const ZOOM_PARTICLES = 10;
const FIELD_OPACITY = 0.62;
const FIELD_UPSCALE = 6;
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

/* Tuulikartan ollessa auki piilotetaan havaintopisteiden merkit/lukemat */
.windmap-on .leaflet-marker-pane,
.windmap-on .leaflet-shadow-pane,
.windmap-on .leaflet-tooltip-pane { visibility: hidden; }

/* Värikenttätilassa tausta vaimennetaan, jotta kenttä ja hiukkaset erottuvat */
.windmap-far .leaflet-tile-pane { filter: saturate(0.45) brightness(0.9); }

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

/* Pisteennusteen ikkuna (klikkaus kartalla) */
.windmap-popup .leaflet-popup-content { margin: 8px 10px 6px; }
.windmap-fc-title { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
.windmap-fc canvas { display: block; cursor: pointer; }
.windmap-fc-hover { font-size: 12px; min-height: 16px; color: #222; margin-top: 2px; }
.windmap-fc-note { font-size: 10px; color: #777; }

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
const COLOR_LUT = (() => {
const stops = COLOR_SCALE.map(c => c.match(/\d+/g).map(Number));
const lut = new Uint8ClampedArray(256 * 3);
for (let i = 0; i < 256; i++) {
const pos = (i / 255) * (stops.length - 1);
const a = Math.floor(pos), b = Math.min(a + 1, stops.length - 1), f = pos - a;
for (let c = 0; c < 3; c++) lut[i * 3 + c] = stops[a][c] + (stops[b][c] - stops[a][c]) * f;
}
return lut;
})();
function splitAtDateline(ring) {
const pieces = [];
let cur = [ring[0]];
for (let i = 1; i < ring.length; i++) {
if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) { pieces.push(cur); cur = [ring[i]]; }
else cur.push(ring[i]);
}
pieces.push(cur);
const n = ring.length;
if (pieces.length > 1 && Math.abs(ring[0][0] - ring[n - 1][0]) <= 180) {
const last = pieces.pop();
pieces[0] = last.concat(pieces[0]);
}
return pieces;
}
function clipRing(ring, x0, y0, x1, y1) {
const edges = [
[p => p[0] >= x0, (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + t * (b[1] - a[1])]; }],
[p => p[0] <= x1, (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + t * (b[1] - a[1])]; }],
[p => p[1] >= y0, (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y0]; }],
[p => p[1] <= y1, (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y1]; }]
];
let pts = ring;
for (const [inside, inter] of edges) {
const out = [];
for (let i = 0; i < pts.length; i++) {
const cur = pts[i], prev = pts[(i + pts.length - 1) % pts.length];
const ci = inside(cur), pi = inside(prev);
if (ci) { if (!pi) out.push(inter(prev, cur)); out.push(cur); }
else if (pi) out.push(inter(prev, cur));
}
pts = out;
if (!pts.length) break;
}
return pts;
}
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
if (!new URLSearchParams(location.search).has("tuulikartta")) return;
const panelsEl = document.querySelector(".info-panels");
if (!panelsEl) return;
const styleEl = document.createElement("style");
styleEl.textContent = STYLE;
document.head.appendChild(styleEl);
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
if (window.L) {
L.DomEvent.disableClickPropagation(panel);
L.DomEvent.disableScrollPropagation(panel);
}
const readoutEl = document.createElement("div");
readoutEl.className = "windmap-readout";
document.body.appendChild(readoutEl);
let manifest = null;
let layers = [null, null];
let front = 0;
let currentData = null;
let visible = false;
let playing = false;
let requestToken = 0;
const cache = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIRS = ["P", "KO", "I", "KA", "E", "LO", "L", "LU"];
function sampleAt(latlng) {
if (!currentData) return null;
const h = currentData[0].header;
const col = Math.round((latlng.lng - h.lo1) / h.dx);
const row = Math.round((h.la1 - latlng.lat) / h.dy);
if (col < 0 || row < 0 || col >= h.nx || row >= h.ny) return null;
const k = row * h.nx + col;
return { u: currentData[0].data[k], v: currentData[1].data[k] };
}
let fieldLayer = null;
let particlesOn = false;
const mercY = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const invMercY = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
function fieldDims(h) {
const lonSpan = (h.nx - 1) * h.dx;
const laTop = h.la1, laBot = h.la1 - (h.ny - 1) * h.dy;
const yTop = mercY(laTop), yBot = mercY(laBot);
const W = (h.nx - 1) * FIELD_UPSCALE;
const H = Math.max(2, Math.round(W * (yTop - yBot) / (lonSpan * Math.PI / 180)));
return { lonSpan, laTop, laBot, yTop, yBot, W, H };
}
let landMask = null;
let landMaskTried = false;
async function ensureLandMask(h) {
if (landMask || landMaskTried) return;
landMaskTried = true;
try {
if (!window.topojson) await loadScript(TOPOJSON_JS);
const topo = await fetchJson(LAND_TOPO);
const land = topojson.feature(topo, topo.objects.land);
const d = fieldDims(h);
const cv = document.createElement("canvas");
cv.width = d.W; cv.height = d.H;
const ctx = cv.getContext("2d");
ctx.fillStyle = "#000";
const px = lon => (lon - h.lo1) / d.lonSpan * (d.W - 1);
const py = lat => (mercY(lat) - d.yTop) / (d.yBot - d.yTop) * (d.H - 1);
const latMin = d.laBot - 1, latMax = d.laTop + 1, lonMin = h.lo1 - 1, lonMax = h.lo1 + d.lonSpan + 1;
const polys = [];
const geoms = land.type === "FeatureCollection" ? land.features.map(f => f.geometry) : [land.geometry || land];
geoms.forEach(g => {
if (g.type === "Polygon") polys.push(g.coordinates);
else if (g.type === "MultiPolygon") g.coordinates.forEach(c => polys.push(c));
});
polys.forEach(rings => {
let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
rings[0].forEach(pt => {
if (pt[0] < mnx) mnx = pt[0]; if (pt[0] > mxx) mxx = pt[0];
if (pt[1] < mny) mny = pt[1]; if (pt[1] > mxy) mxy = pt[1];
});
if (mxx < lonMin || mnx > lonMax || mxy < latMin || mny > latMax) return;
ctx.beginPath();
rings.forEach(ring => {
splitAtDateline(ring).forEach(piece => {
const cr = clipRing(piece, lonMin, latMin, lonMax, latMax);
if (cr.length < 3) return;
cr.forEach((pt, i) => {
if (i === 0) ctx.moveTo(px(pt[0]), py(pt[1])); else ctx.lineTo(px(pt[0]), py(pt[1]));
});
ctx.closePath();
});
});
ctx.fill("evenodd");
});
const id = ctx.getImageData(0, 0, d.W, d.H).data;
const m = new Uint8Array(d.W * d.H);
for (let i = 0; i < m.length; i++) m[i] = id[i * 4 + 3];
landMask = m;
if (currentData) updateField(currentData);
} catch (err) {
console.warn("Maamaskin lataus epäonnistui, kenttä näytetään ilman rajausta:", err);
}
}
function renderFieldUrl(data) {
const h = data[0].header, U = data[0].data, V = data[1].data;
const nx = h.nx, ny = h.ny;
const speed = new Float32Array(nx * ny);
for (let k = 0; k < speed.length; k++) speed[k] = Math.hypot(U[k], V[k]);
const lonSpan = (nx - 1) * h.dx;
const laTop = h.la1, laBot = h.la1 - (ny - 1) * h.dy;
const yTop = mercY(laTop), yBot = mercY(laBot);
const W = (nx - 1) * FIELD_UPSCALE;
const H = Math.max(2, Math.round(W * (yTop - yBot) / (lonSpan * Math.PI / 180)));
const canvas = document.createElement("canvas");
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext("2d");
const img = ctx.createImageData(W, H);
const px = img.data;
for (let py = 0; py < H; py++) {
const lat = invMercY(yTop + (py / (H - 1)) * (yBot - yTop));
const rf = Math.min(Math.max((h.la1 - lat) / h.dy, 0), ny - 1.0001);
const r0 = Math.floor(rf), fr = rf - r0;
for (let pxx = 0; pxx < W; pxx++) {
const cf = Math.min((pxx / (W - 1)) * (nx - 1), nx - 1.0001);
const c0 = Math.floor(cf), fc = cf - c0;
const i00 = r0 * nx + c0;
const s = (speed[i00] * (1 - fc) + speed[i00 + 1] * fc) * (1 - fr) +
(speed[i00 + nx] * (1 - fc) + speed[i00 + nx + 1] * fc) * fr;
const li = Math.min(255, Math.max(0, Math.round(s / 25 * 255))) * 3;
const o = (py * W + pxx) * 4;
px[o] = COLOR_LUT[li]; px[o + 1] = COLOR_LUT[li + 1]; px[o + 2] = COLOR_LUT[li + 2]; px[o + 3] = landMask ? 255 - landMask[py * W + pxx] : 255;
}
}
ctx.putImageData(img, 0, 0);
return {
url: canvas.toDataURL("image/png"),
bounds: [[laBot, h.lo1], [laTop, h.lo1 + lonSpan]]
};
}
function updateField(data) {
if (!ZOOM_PARTICLES) return;
const f = renderFieldUrl(data);
if (!fieldLayer) {
fieldLayer = L.imageOverlay(f.url, f.bounds, { opacity: FIELD_OPACITY, interactive: false });
fieldLayer.addTo(map);
const el = fieldLayer.getElement();
if (el) el.style.transition = "opacity 400ms";
} else {
fieldLayer.setUrl(f.url);
}
fieldLayer.setOpacity(particlesOn ? 0 : FIELD_OPACITY);
}
function updateReadout(latlng) {
if (!currentData || !latlng) return;
const s = sampleAt(latlng);
if (!s) {
readoutEl.textContent = "Ei tuulitietoa";
return;
}
const u = s.u, v = s.v;
const speed = Math.hypot(u, v);
const from = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
const name = DIRS[Math.round(from / 45) % 8];
readoutEl.textContent =
"Tuuli " + speed.toFixed(1).replace(".", ",") + " m/s, " + name + " (" + Math.round(from) + "°)";
}
function onMouseMove(e) {
updateReadout(e.latlng);
const oe = e.originalEvent;
if (oe) {
readoutEl.style.left = Math.min(oe.clientX + 16, window.innerWidth - 220) + "px";
readoutEl.style.top = Math.max(oe.clientY - 34, 4) + "px";
readoutEl.style.bottom = "auto";
}
}
function onMouseOut() { readoutEl.textContent = ""; readoutEl.style.display = ""; }
const FC_W = 440, FC_H = 200, FC_L = 30, FC_R = 8, FC_T = 10, FC_B = 44;
let fcToken = 0;
function sampleFrom(data, latlng) {
const h = data[0].header;
const col = Math.round((latlng.lng - h.lo1) / h.dx);
const row = Math.round((h.la1 - latlng.lat) / h.dy);
if (col < 0 || row < 0 || col >= h.nx || row >= h.ny) return null;
const k = row * h.nx + col;
const u = data[0].data[k], v = data[1].data[k];
return { speed: Math.hypot(u, v), from: (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360 };
}
async function loadAllHours(onProgress) {
const idxs = manifest.hours.map((_, i) => i);
const total = idxs.length;
let done = 0;
const worker = async () => {
while (idxs.length) {
await loadHour(idxs.shift());
onProgress(++done, total);
}
};
await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
}
const fcNum = x => x.toFixed(1).replace(".", ",");
const fcDirName = deg => DIRS[Math.round(deg / 45) % 8];
function fcLabel(pt) {
const d = new Date(pt.time);
const when = d.toLocaleString("fi-FI", { weekday: "short", hour: "2-digit", minute: "2-digit" });
return when + ": " + fcNum(pt.speed) + " m/s, " + fcDirName(pt.from) + " (" + Math.round(pt.from) + "°)";
}
function drawForecast(canvas, series, cur, hover) {
const dpr = window.devicePixelRatio || 1;
canvas.width = FC_W * dpr; canvas.height = FC_H * dpr;
canvas.style.width = FC_W + "px"; canvas.style.height = FC_H + "px";
const ctx = canvas.getContext("2d");
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
ctx.clearRect(0, 0, FC_W, FC_H);
const plotW = FC_W - FC_L - FC_R, plotH = FC_H - FC_T - FC_B;
const n = series.length, bw = plotW / n;
const maxSp = Math.max(10, Math.ceil(Math.max.apply(null, series.map(p => p.speed)) / 5) * 5);
const yOf = v => FC_T + plotH - v / maxSp * plotH;
ctx.font = "10px sans-serif";
ctx.textBaseline = "middle"; ctx.textAlign = "right";
for (let v = 0; v <= maxSp; v += 5) {
ctx.strokeStyle = v === 0 ? "#888" : "#e0e0e0"; ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(FC_L, yOf(v) + 0.5); ctx.lineTo(FC_W - FC_R, yOf(v) + 0.5); ctx.stroke();
ctx.fillStyle = "#555"; ctx.fillText(String(v), FC_L - 4, yOf(v));
}
ctx.textAlign = "left"; ctx.fillStyle = "#555";
ctx.fillText("m/s", 2, 5);
series.forEach((pt, i) => {
const li = Math.min(255, Math.round(pt.speed / 25 * 255)) * 3;
ctx.fillStyle = "rgb(" + COLOR_LUT[li] + "," + COLOR_LUT[li + 1] + "," + COLOR_LUT[li + 2] + ")";
const x = FC_L + i * bw, y = yOf(pt.speed);
ctx.fillRect(x + 0.5, y, Math.max(1, bw - 1), FC_T + plotH - y);
});
if (cur >= 0 && cur < n) {
ctx.strokeStyle = "#0d47a1"; ctx.lineWidth = 2;
ctx.strokeRect(FC_L + cur * bw + 0.5, FC_T, Math.max(1, bw - 1), plotH);
}
if (hover >= 0 && hover < n) {
ctx.fillStyle = "rgba(0,0,0,0.12)";
ctx.fillRect(FC_L + hover * bw, FC_T, bw, plotH);
}
ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
series.forEach((pt, i) => {
const cx = FC_L + i * bw + bw / 2;
const hr = new Date(pt.time).getHours();
if (i % 3 === 1) {
ctx.save();
ctx.translate(cx, FC_T + plotH + 13);
ctx.rotate((pt.from + 180) * Math.PI / 180);
ctx.strokeStyle = "#333"; ctx.lineWidth = 1.4;
ctx.beginPath();
ctx.moveTo(0, 6); ctx.lineTo(0, -6);
ctx.moveTo(-3.5, -2); ctx.lineTo(0, -6.5); ctx.lineTo(3.5, -2);
ctx.stroke();
ctx.restore();
}
if (hr % 6 === 0) {
ctx.fillStyle = "#333"; ctx.font = "10px sans-serif";
ctx.fillText(String(hr).padStart(2, "0"), cx, FC_H - 15);
if (hr === 0) {
const day = new Date(pt.time).toLocaleDateString("fi-FI", { weekday: "short", day: "numeric", month: "numeric" });
ctx.font = "bold 10px sans-serif";
ctx.fillText(day, cx, FC_H - 3);
}
ctx.strokeStyle = "#bbb"; ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(cx, FC_T + plotH); ctx.lineTo(cx, FC_T + plotH + 3); ctx.stroke();
}
});
}
async function onMapClick(e) {
if (!visible || !manifest) return;
const latlng = e.latlng;
const box = document.createElement("div");
box.className = "windmap-fc";
const title = document.createElement("div");
title.className = "windmap-fc-title";
title.textContent = "Tuuliennuste " + latlng.lat.toFixed(2).replace(".", ",") + "° N, " +
latlng.lng.toFixed(2).replace(".", ",") + "° E";
const status = document.createElement("div");
status.className = "windmap-fc-hover";
status.textContent = "Ladataan ennustetta…";
box.appendChild(title);
box.appendChild(status);
const popup = L.popup({ maxWidth: FC_W + 30, minWidth: FC_W, className: "windmap-popup", autoPanPadding: [10, 70] })
.setLatLng(latlng).setContent(box).openOn(map);
const token = ++fcToken;
try {
await loadAllHours((d, t) => { if (token === fcToken) status.textContent = "Ladataan ennustetta… " + d + "/" + t; });
} catch (err) {
console.warn("Ennusteen lataus epäonnistui:", err);
if (token === fcToken) status.textContent = "Ennustetta ei saatu ladattua.";
return;
}
if (token !== fcToken || !popup.isOpen()) return;
const series = [];
for (let i = 0; i < manifest.hours.length; i++) {
const smp = sampleFrom(cache.get(manifest.hours[i].file), latlng);
if (!smp) { status.textContent = "Ei tuulitietoa tässä kohdassa."; return; }
series.push({ time: manifest.hours[i].time, speed: smp.speed, from: smp.from });
}
const canvas = document.createElement("canvas");
box.insertBefore(canvas, status);
const note = document.createElement("div");
note.className = "windmap-fc-note";
note.textContent = "10 m tuuli, lähin hilapiste. Nuoli osoittaa suuntaan, jonne tuuli puhaltaa. Klikkaa palkkia siirtääksesi kartan siihen tuntiin.";
box.appendChild(note);
const hint = "Vie hiiri palkin päälle";
status.textContent = hint;
const idxAt = ev => {
const r = canvas.getBoundingClientRect();
return Math.floor((ev.clientX - r.left - FC_L) / ((FC_W - FC_L - FC_R) / series.length));
};
const redraw = hover => drawForecast(canvas, series, Number(slider.value), hover);
redraw(-1);
canvas.addEventListener("mousemove", ev => {
const i = idxAt(ev);
if (i >= 0 && i < series.length) { status.textContent = fcLabel(series[i]); redraw(i); }
else { status.textContent = hint; redraw(-1); }
});
canvas.addEventListener("mouseleave", () => { status.textContent = hint; redraw(-1); });
canvas.addEventListener("click", async ev => {
const i = idxAt(ev);
if (i < 0 || i >= series.length) return;
stopPlaying();
await showHour(i, false);
redraw(i);
});
popup.update();
}
function makeLayer(data) {
const lyr = L.velocityLayer({
displayValues: false,
data,
maxVelocity: 25,
velocityScale: PARTICLE_SPEED,
lineWidth: particlesOn ? PARTICLE_LINE_WIDTH_NEAR : PARTICLE_LINE_WIDTH,
particleMultiplier: particlesOn ? PARTICLE_DENSITY : PARTICLE_DENSITY_FAR,
colorScale: particlesOn ? COLOR_SCALE : FAR_PARTICLE_COLORS,
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
`${new Date(manifest.origin).toLocaleDateString("fi-FI")}). Lähde: Ilmatieteen laitos (CC BY 4.0). 10 m tuuli. Klikkaa karttaa nähdäksesi paikan ennusteen.`;
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
async function showHour(index, smooth) {
const token = ++requestToken;
const data = await loadHour(index);
if (token !== requestToken) return;
updateField(data);
currentData = data;
if (!layers[front]) {
layers[front] = makeLayer(data);
setLayerOpacity(layers[front], 1);
} else if (!smooth) {
layers[front].setData(data);
setLayerOpacity(layers[front], 1);
if (layers[1 - front]) setLayerOpacity(layers[1 - front], 0);
} else {
const back = 1 - front;
if (!layers[back]) {
layers[back] = makeLayer(data);
setLayerOpacity(layers[back], 0);
} else {
layers[back].setData(data);
}
await sleep(WARMUP_MS);
if (token !== requestToken || !visible) return;
setLayerOpacity(layers[back], 1);
setLayerOpacity(layers[front], 0);
front = back;
}
currentData = data;
slider.value = index;
timeEl.textContent = fmtTime(manifest.hours[index].time);
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
function applyMode() {
if (!visible || !currentData) return;
const want = map.getZoom() >= ZOOM_PARTICLES;
if (want === particlesOn) return;
particlesOn = want;
const cont = map.getContainer();
requestToken++;
layers.forEach(lyr => { if (lyr) map.removeLayer(lyr); });
layers = [makeLayer(currentData), null];
front = 0;
setLayerOpacity(layers[0], 1);
cont.classList.toggle("windmap-dim", particlesOn);
cont.classList.toggle("windmap-far", !particlesOn);
if (fieldLayer) fieldLayer.setOpacity(particlesOn ? 0 : FIELD_OPACITY);
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
if (OPEN_BOUNDS) map.fitBounds(OPEN_BOUNDS, { animate: false, padding: [10, 10] });
particlesOn = map.getZoom() >= ZOOM_PARTICLES;
visible = true;
await showHour(nearestHourIndex(), false);
const cont = map.getContainer();
cont.classList.add("windmap-on");
if (particlesOn) cont.classList.add("windmap-dim"); else if (ZOOM_PARTICLES) cont.classList.add("windmap-far");
if (ZOOM_PARTICLES) ensureLandMask(currentData[0].header);
map.on("mousemove", onMouseMove);
map.on("mouseout", onMouseOut);
map.on("click", onMapClick);
map.on("zoomend", applyMode);
readoutEl.classList.add("visible");
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
requestToken++;
layers.forEach(lyr => { if (lyr) map.removeLayer(lyr); });
layers = [null, null];
front = 0;
currentData = null;
map.off("mousemove", onMouseMove);
map.off("mouseout", onMouseOut);
map.off("click", onMapClick);
fcToken++;
map.closePopup();
map.off("zoomend", applyMode);
readoutEl.classList.remove("visible");
readoutEl.textContent = "";
panel.classList.remove("visible");
btn.classList.remove("active");
map.getContainer().classList.remove("windmap-dim", "windmap-on", "windmap-far");
if (fieldLayer) { map.removeLayer(fieldLayer); fieldLayer = null; }
particlesOn = false;
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
