export async function fetchSeaLevel(fmisid) {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::mareograph::instant::simple",
    fmisid: fmisid
  });

  const url = `https://opendata.fmi.fi/wfs/fin?${params}`;
  console.log("SEA LEVEL OBS REQUEST:", url);

  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok || text.startsWith("<")) {
    console.warn("Sea level observation not available for fmisid", fmisid);
    return null;
  }

  const json = JSON.parse(text);

  const feature = json?.features?.[0];
  const value = feature?.properties?.value;

  if (value == null) return null;

  return value; // cm
}
