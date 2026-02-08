export async function fetchSeaLevel(fmisid) {
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 3600_000).toISOString();
  const end = now.toISOString();

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::mareograph::instant::timevaluepair",
    fmisid: fmisid,
    starttime: start,
    endtime: end,
    timestep: 60
  });

  // 🔑 HUOMAA /wfs/fin
  const url = `https://opendata.fmi.fi/wfs/fin?${params}`;
  console.log("SEA LEVEL OBS REQUEST:", url);

  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok || text.startsWith("<")) {
    console.warn("Sea level observation not available for fmisid", fmisid);
    return null;
  }

  const json = JSON.parse(text);

  if (!Array.isArray(json) || json.length === 0) return null;

  // FMI palauttaa [{ time, value }]
  const latest = json.at(-1);

  return latest?.value ?? null;
}
