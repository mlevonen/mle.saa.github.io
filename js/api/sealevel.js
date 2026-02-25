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

  const name = nameNode.textContent.trim();

  if (name === "WATLEV" || name === "TW") {
    const mm = Number(valueNode.textContent);
    if (!Number.isFinite(mm)) return null;

    return Math.round(mm / 10); // cm
  }
}


console.warn("Sea level TW value not found for fmisid", fmisid);
return null;}

export async function fetchSeaLevelSeries(fmisid) {

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::mareograph::simple",
    fmisid: fmisid
  });

  const url = `https://opendata.fmi.fi/wfs/fin?${params}`;
  console.log("SEA LEVEL SERIES REQUEST:", url);

  const res = await fetch(url);
  if (!res.ok) {
    console.warn("Sea level series not available for fmisid", fmisid);
    return { waterLevel: [], waterTemp: [] };
  }

  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");

  const elements = xml.querySelectorAll(
    "BsWfs\\:BsWfsElement, BsWfsElement"
  );

  const waterLevel = [];
  const waterTemp = [];

  for (const el of elements) {

    const timeNode = el.querySelector(
      "BsWfs\\:Time, Time"
    );

    const nameNode = el.querySelector(
      "BsWfs\\:ParameterName, ParameterName"
    );

    const valueNode = el.querySelector(
      "BsWfs\\:ParameterValue, ParameterValue"
    );

    if (!timeNode || !nameNode || !valueNode) continue;

    const time = timeNode.textContent.trim();
    const name = nameNode.textContent.trim();
    const value = Number(valueNode.textContent);

    if (!Number.isFinite(value)) continue;

    // 🔵 Vedenkorkeus (mm → cm)
    if (name === "WATLEV") {
      waterLevel.push({
        time,
        value: value / 10
      });
    }

    // 🔵 Veden lämpötila (°C)
    if (name === "TW_PT1H_AVG" || name === "TW") {
      waterTemp.push({
        time,
        value
      });
    }
  }

  return { waterLevel, waterTemp };
}
