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

function updateMarkers(values, markerRegistry, createWindIcon) {

  Object.entries(values).forEach(([fmisid, data]) => {

    const marker = markerRegistry[fmisid];
    if (!marker) return;

    const station = marker.station;

    marker.previewData = marker.previewData || {};
    marker.previewData.wind = data.wind;

    const icon = createWindIcon(
      data.wind,
      data.dir
    );

    marker.setIcon(icon);

  });

}

export async function updateCoastalPreview(
  stations,
  markerRegistry,
  loadPopupData,
  createWindIcon
) {

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
        dir: latestWind.winddirection
      };

    } catch {}

  });

  await Promise.all(requests);

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