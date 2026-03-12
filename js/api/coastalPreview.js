import { smartSymbolIcon } from "../popup/popupExtras.js";
import { fetchObservationSeriesByFmisid } from "./dataLoader.js";

// ==========================
// COASTAL PREVIEW SYSTEM
// ==========================

const CACHE_KEY = "coastalPreviewCache";
const CACHE_TTL = 5 * 60 * 1000;


// ==========================
// CACHE
// ==========================

function loadCache() {

  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;

  try {

    const data = JSON.parse(raw);

    if (Date.now() - data.time > CACHE_TTL) {
      return null;
    }

    return data.values;

  } catch {
    return null;
  }

}

function saveCache(values) {

  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      time: Date.now(),
      values
    })
  );

}

async function fetchCoastalMulti(fmisids) {

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::weather::simple",
    fmisid: fmisids.join(",")
  });

  const url = `https://opendata.fmi.fi/wfs/fin?${params}`;

  const res = await fetch(url);
  if (!res.ok) return {};

  const text = await res.text();

  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");

  const elements = xml.querySelectorAll(
    "BsWfs\\:BsWfsElement, BsWfsElement"
  );

  const result = {};

  for (const el of elements) {

    const idNode = el.querySelector(
      "BsWfs\\:fmisid, fmisid"
    );

    const nameNode = el.querySelector(
      "BsWfs\\:ParameterName, ParameterName"
    );

    const valueNode = el.querySelector(
      "BsWfs\\:ParameterValue, ParameterValue"
    );

    if (!idNode || !nameNode || !valueNode) continue;

    const id = idNode.textContent.trim();
    const name = nameNode.textContent.trim();
    const value = Number(valueNode.textContent);

    if (!Number.isFinite(value)) continue;

    if (!result[id]) result[id] = {};

    if (name === "WS_PT10M_AVG") {
      result[id].wind = value;
    }

    if (name === "WD_PT10M_AVG") {
      result[id].dir = value;
    }

  }

  return result;


}


//updateMarkers(values, markerRegistry, createWindIcon);
function updateMarkers(values, markerRegistry, createWindIcon) {


Object.entries(values).forEach(([fmisid, data]) => {
console.log("MARKER SYMBOL:", data.symbol);
  const marker = markerRegistry[fmisid];
  if (!marker) return;

  const symbolUrl = smartSymbolIcon(data.symbol);

  const icon = createWindIcon(
    data.wind,
    data.dir,
    symbolUrl
  );

  marker.setIcon(icon);
  
});

}

export async function updateCoastalPreview(
  stations,
  markerRegistry,
  createWindIcon
) {

  const coastalStations = stations.filter(
    s => s.type === "coastal" && s.featured
  );

  const values = {};   // ← TÄMÄ TÄRKEÄ

  for (const station of coastalStations) {

    const series = await fetchObservationSeriesByFmisid(station.fmisid);

      console.log("SERIES LENGTH:", station.name, series.length);

      let windRow = null;
      let symbol = null;

      for (let i = series.length - 1; i >= 0; i--) {

        console.log("SYMBOL TEST:", station.name, symbol);

        const row = series[i];

        if (!windRow && row.windspeedms != null && row.winddirection != null) {
          windRow = row;
        }

        if (symbol == null && Number.isFinite(row.smartsymbol) && row.smartsymbol > 0) {
          symbol = row.smartsymbol;
        }

        if (windRow && symbol != null) break;

      }

    

      if (!windRow) continue;

      values[station.fmisid] = {
        wind: windRow.windspeedms,
        dir: windRow.winddirection,
        symbol: symbol
      };
  }

  console.log("VALUES OBJECT:", values);

  updateMarkers(values, markerRegistry, createWindIcon);

  saveCache(values);

}

export function loadCoastalPreviewCache(
  markerRegistry,
  createWindIcon
) {

  const cached = loadCache();
  if (!cached) return;

  updateMarkers(cached, markerRegistry, createWindIcon);

}