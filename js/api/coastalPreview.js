//import { smartSymbolIcon } from "../popup/popupExtras.js";

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

function updateMarkers(values, markerRegistry, createWindIcon) {

  Object.entries(values).forEach(([fmisid, data]) => {

    const marker = markerRegistry[fmisid];
    if (!marker) return;

    if (marker.previewData?.wind === data.wind &&
        marker.previewData?.dir === data.dir) {
      return;
    }

    marker.previewData = marker.previewData || {};
    marker.previewData.wind = data.wind;

    const symbol = marker.previewData?.symbol;
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

  const ids = coastalStations.map(s => s.fmisid);

  const data = await fetchCoastalMulti(ids);

  const values = {};

  coastalStations.forEach(station => {
console.log("Coastal station:", station.name);
    const d = data[station.fmisid];
    if (!d || d.wind == null || d.dir == null) return;

  values[station.fmisid] = {
    wind: d.wind,
    dir: d.dir
  };
    console.log("coastal symbol:", station.name, d.symbol);
  });

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