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
    const d = series?.at(-1);

    console.log("RAW coastal object:", station.name, d);

    if (!d || d.windspeedms == null || d.winddirection == null) continue;

    values[station.fmisid] = {
      wind: d.windspeedms,
      dir: d.winddirection,
      symbol: d.smartsymbol
    };

  }

  console.log("VALUES OBJECT:", values);

  updateMarkers(values, markerRegistry, createWindIcon);

  saveCache(values);

}


{
  const values = {};

  const coastalStations = stations.filter(
    s => s.type === "coastal" && s.featured
  );

  const requests = coastalStations.map(async station => {

    try {

      const data = await loadPopupData({
        lat: station.lat,
        lon: station.lon,
        weatherPlace: null,
        weatherFmisid: station.fmisid,
        seaLevelFmisid: null
      });

      const latestWind = data.obsWindSpeed?.at(-1);

      if (!latestWind) return;

      values[station.fmisid] = {
        wind: latestWind.windspeedms,
        dir: latestWind.winddirection,
        symbol: latestWind.smartsymbol
      };

      console.log("COASTAL SYMBOL:", station.name, latestWind.smartsymbol);



    } catch {}

  });

  await Promise.all(requests);


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