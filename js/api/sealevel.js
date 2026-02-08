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
  if (!res.ok) {
    console.warn("Sea level observation not available for fmisid", fmisid);
    return null;
  }

  const text = await res.text();

  // 🔑 XML-parsinta
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");

  // FMI mareograph: arvo löytyy <BsWfs:ParameterValue>
  const valueNode = xml.querySelector("BsWfs\\:ParameterValue, ParameterValue");

  if (!valueNode) {
    console.warn("Sea level value missing for fmisid", fmisid);
    return null;
  }

  const value = parseFloat(valueNode.textContent);
  return Number.isFinite(value) ? value : null;
}
