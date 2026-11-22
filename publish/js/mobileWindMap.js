const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const STYLE = `
.mwm-overlay {
  position: fixed; inset: 0; z-index: 5000; background: #fff;
  display: none; flex-direction: column;
}
.mwm-overlay.visible { display: flex; }
.mwm-head {
  flex: none; display: flex; align-items: center; gap: 10px;
  padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
  background: #0d3b55; color: #fff;
  font: 700 16px/1.2 "Helvetica Neue", Arial, Helvetica, sans-serif;
}
.mwm-back {
  border: none; background: rgba(255,255,255,0.18); color: #fff; cursor: pointer;
  width: 36px; height: 36px; border-radius: 50%; font-size: 22px; line-height: 1;
}
.mwm-map { flex: 1 1 auto; min-height: 0; position: relative; }
.mwm-loading {
  position: absolute; inset: 0; z-index: 400; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.7); font: 700 14px sans-serif; color: #0d3b55;
}
`;
let overlay = null;
let map = null;
let ctrl = null;
let opening = false;
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
function closeOverlay() {
if (!overlay) return;
if (ctrl) ctrl.turnOff();
overlay.classList.remove("visible");
document.documentElement.style.overflow = "";
}
export async function openMobileWindMap() {
if (opening) return;
opening = true;
try {
if (!overlay) {
const st = document.createElement("style");
st.textContent = STYLE;
document.head.appendChild(st);
overlay = document.createElement("div");
overlay.className = "mwm-overlay";
overlay.innerHTML = `
        <div class="mwm-head">
          <button type="button" class="mwm-back" aria-label="Takaisin">‹</button>
          <span>Tuulikartta</span>
        </div>
        <div class="mwm-map"><div class="mwm-loading">Ladataan karttaa…</div></div>`;
document.body.appendChild(overlay);
overlay.querySelector(".mwm-back").addEventListener("click", () => {
if (history.state && history.state.mwm) history.back(); else closeOverlay();
});
window.addEventListener("popstate", () => {
if (overlay.classList.contains("visible")) closeOverlay();
});
}
overlay.classList.add("visible");
document.documentElement.style.overflow = "hidden";
history.pushState({ mwm: true }, "");
const mapHost = overlay.querySelector(".mwm-map");
if (!map) {
if (!window.L) {
loadCss(LEAFLET_CSS);
await loadScript(LEAFLET_JS);
}
const mapEl = document.createElement("div");
mapEl.style.cssText = "position:absolute;inset:0";
mapHost.appendChild(mapEl);
map = L.map(mapEl, { zoomControl: true, attributionControl: false }).setView([60, 25], 6);
L.control.attribution({ position: "topright", prefix: false }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
attribution: "&copy; OpenStreetMap"
}).addTo(map);
const { initWindMapControl } = await import("./windMapControl.js");
ctrl = initWindMapControl(map, { mobile: true, container: overlay });
} else {
setTimeout(() => map.invalidateSize(), 50);
}
if (ctrl && !ctrl.isVisible()) await ctrl.turnOn();
const loading = mapHost.querySelector(".mwm-loading");
if (loading) loading.remove();
} catch (err) {
console.warn("Tuulikartan avaus epäonnistui:", err);
const loading = overlay && overlay.querySelector(".mwm-loading");
if (loading) loading.textContent = "Karttaa ei saatu ladattua. Yritä myöhemmin uudelleen.";
} finally {
opening = false;
}
}
