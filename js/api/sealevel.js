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

// hae kaikki BsWfsElementit
  const elements = xml.querySelectorAll(
  "BsWfs\\:BsWfsElement, BsWfsElement"
);

for (const el of elements) {
    const nameNode = el.querySelector(
    "BsWfs\\:ParameterName, ParameterName"
    );
    const valueNode = el.querySelector(
    "BsWfs\\:ParameterValue, ParameterValue"
    );

  if (!nameNode || !valueNode) continue;

  // TW = merivedenkorkeus
  if (nameNode.textContent.trim() === "TW") {
    const meters = parseFloat(valueNode.textContent);
    if (!Number.isFinite(meters)) return null;

    // 🔑 MUUNNETAAN SENTTIMETREIKSI
    return Math.round(meters * 100);
  }
}

console.warn("Sea level TW value not found for fmisid", fmisid);
return null;}
