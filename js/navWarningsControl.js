// ==========================
// "Merivaroitukset"-nappi – näyttää/piilottaa kartalla Traficomin
// voimassa olevat merivaroitukset (pisteet, viivat ja alueet).
//
// Data: Traficomin avoin WFS (CC BY 4.0), tasot navigational_warnings_p
// (pisteet), _l (viivat) ja _a (alueet). Sama sisältö, jota Fintraffic
// jakelee S-124-muodossa ECDIS-laitteille – tämä GeoJSON-rajapinta on
// selaimesta suoraan käytettävissä (CORS sallittu).
//
// Nappi on tavallinen HTML-painike .info-panels-säiliössä (id
// "navwarnings-toggle-btn"), Vedenlämpö-napin alla. Päälle/pois-toggle,
// data haetaan uudelleen aina kun nappi kytketään päälle (varoituksia
// tulee ja poistuu jatkuvasti, ja datamäärä on pieni).
//
// Pienet varoitusalueet/-viivat eivät näy kaukaa zoomattuna, joten
// jokaiselle viivalle ja alueelle piirretään lisäksi keskipistemerkki.
// ==========================

const WFS_BASE =
  "https://julkinen.traficom.fi/inspirepalvelu/avoin/wfs" +
  "?service=WFS&version=2.0.0&request=GetFeature" +
  "&outputFormat=application/json&srsName=EPSG:4326&typeNames=";

const LAYERS = [
  "navigational_warnings_p",
  "navigational_warnings_l",
  "navigational_warnings_a"
];

const COLOR = "#e65100";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Varoitustekstit tulevat kokonaan isoilla kirjaimilla. Muutetaan
// luettavammaksi: pienet kirjaimet + isot alkukirjaimet lauseiden ja
// rivien alkuun. Koordinaattien ilmansuunnat (61-16.12N 021-21.23E)
// ja N2000 pidetään isoina.
function normalizeText(text) {
  if (!text) return "";
  let t = String(text).trim().toLowerCase();
  t = t.replace(/(\d)([nsew])\b/g, (m, d, c) => d + c.toUpperCase());
  t = t.replace(/\bn2000\b/g, "N2000");
  t = t.replace(/(^|[.!?]\s+|\n\s*)(\S)/g, (m, pre, ch) => pre + ch.toUpperCase());
  return t;
}

function pick(props, base) {
  return props[base + "_FI"] || props[base + "_EN"] || props[base + "_SV"] || "";
}

function formatTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("fi-FI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function popupHTML(props) {
  const place = normalizeText(pick(props, "LOCALITYLOCATIONNAME"));
  const area = pick(props, "GENERALAREALOCATIONNAME");
  const type = pick(props, "NAVWARNTYPEGENERAL");
  const detail = pick(props, "WARNINGINFORMATIONNAVWARNTYPEDETAILS");
  const body = normalizeText(pick(props, "WARNINGINFORMATION"));
  const time = formatTime(props.PUBLICATIONTIME);

  return `
    <div class="navwarn-popup">
      <div class="navwarn-popup-title">${escapeHtml(place || "Merivaroitus")}</div>
      <div class="navwarn-popup-meta">${escapeHtml([area, type].filter(Boolean).join(" · "))}</div>
      ${detail ? `<div class="navwarn-popup-detail">${escapeHtml(detail)}</div>` : ""}
      <div class="navwarn-popup-text">${escapeHtml(body).replace(/\n/g, "<br>")}</div>
      ${time ? `<div class="navwarn-popup-time">Julkaistu: ${time}</div>` : ""}
      <div class="navwarn-popup-source">Lähde: Traficom (CC BY 4.0). Ei korvaa virallisia merivaroituksia.</div>
    </div>
  `;
}

function createMarker(latlng, props) {
  const icon = L.divIcon({
    className: "navwarn-marker",
    html: `<div class="navwarn-marker-circle">!</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13]
  });
  return L.marker(latlng, { icon, zIndexOffset: 800 }).bindPopup(popupHTML(props));
}

function featureToLayers(feature) {
  const props = feature.properties || {};
  const geom = feature.geometry;
  const layers = [];
  if (!geom) return layers;

  if (geom.type === "MultiPoint" || geom.type === "Point") {
    const coords = geom.type === "Point" ? [geom.coordinates] : geom.coordinates;
    coords.forEach(c => layers.push(createMarker([c[1], c[0]], props)));
    return layers;
  }

  // Viiva tai alue: itse geometria + keskipistemerkki
  const shape = L.geoJSON(feature, {
    style: {
      color: COLOR,
      weight: 3,
      opacity: 0.9,
      fillColor: COLOR,
      fillOpacity: 0.2
    }
  });
  shape.eachLayer(l => l.bindPopup(popupHTML(props)));
  layers.push(shape);

  const center = shape.getBounds().getCenter();
  layers.push(createMarker(center, props));
  return layers;
}

async function fetchWarnings() {
  const results = await Promise.all(
    LAYERS.map(async name => {
      try {
        const res = await fetch(WFS_BASE + name);
        if (!res.ok) return [];
        const json = await res.json();
        return json.features || [];
      } catch (err) {
        console.warn("Merivaroitusten haku epäonnistui (" + name + "):", err);
        return [];
      }
    })
  );
  return results.flat();
}

export function initNavWarningsControl(map) {

  const toggleBtn = document.getElementById("navwarnings-toggle-btn");
  if (!toggleBtn) return;

  const labelEl = document.getElementById("navwarnings-label");
  const baseLabel = labelEl ? labelEl.textContent : "";

  toggleBtn.title = "Näytä/piilota voimassa olevat merivaroitukset kartalla";

  let layerGroup = null;
  let visible = false;

  async function showWarnings() {

    toggleBtn.classList.add("loading");

    try {
      const features = await fetchWarnings();

      if (layerGroup) map.removeLayer(layerGroup);
      layerGroup = L.layerGroup();

      features.forEach(f =>
        featureToLayers(f).forEach(l => layerGroup.addLayer(l))
      );

      layerGroup.addTo(map);
      visible = true;
      toggleBtn.classList.add("active");
      if (labelEl) labelEl.textContent = baseLabel + " (" + features.length + ")";

    } catch (err) {
      console.warn("Merivaroitusten näyttäminen epäonnistui:", err);
    } finally {
      toggleBtn.classList.remove("loading");
    }

  }

  function hideWarnings() {
    if (layerGroup) map.removeLayer(layerGroup);
    visible = false;
    toggleBtn.classList.remove("active");
    if (labelEl) labelEl.textContent = baseLabel;
  }

  toggleBtn.addEventListener("click", () => {
    if (visible) {
      hideWarnings();
    } else {
      showWarnings();
    }
  });

}
