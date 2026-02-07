const FMI_WFS = "https://opendata.fmi.fi/wfs";

export async function fetchSeaLevel(lat, lon) {
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 3600_000).toISOString();
  const end = now.toISOString();

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::sealevel::timevaluepair",
    latlon: `${lat},${lon}`,
    starttime: start,
    endtime: end,
    timestep: "60",
    outputFormat: "application/json"
  });

  const url = `${FMI_WFS}?${params}`;
  console.log("SEA LEVEL REQUEST:", url);

  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok || text.startsWith("<")) {
    console.warn("Sea level not available");
    return null;
  }

  const json = JSON.parse(text);
  return json;
}
