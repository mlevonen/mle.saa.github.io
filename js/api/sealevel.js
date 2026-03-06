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
  const waterLevelN2000 = [];
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

  if (name === "WATLEV") {
    waterLevel.push({ time, value: value / 10 });
  }

  if (name === "WLEVN2K_PT1S_INSTANT") {
    waterLevelN2000.push({ time, value: value / 10 });
  }

  if (name.startsWith("TW")) {
    waterTemp.push({ time, value });
  }
}

return { waterLevel, waterLevelN2000, waterTemp }};

export async function fetchSeaLevelForecast(fmisid) {

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::forecast::sealevel::point::simple",
    fmisid: fmisid
  });

  const url = `https://opendata.fmi.fi/wfs?${params}`;
  console.log("SEA LEVEL FORECAST REQUEST:", url);

  const res = await fetch(url);
  if (!res.ok) {
    console.warn("Sea level forecast not available", fmisid);
    return { forecast: [], forecastN2000: [] };
  }

  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");

  const elements = xml.querySelectorAll(
    "BsWfs\\:BsWfsElement, BsWfsElement"
  );

  const forecast = [];
  const forecastN2000 = [];

  for (const el of elements) {

    const timeNode =
      el.getElementsByTagName("BsWfs:Time")[0] ||
      el.getElementsByTagName("Time")[0];

    const nameNode =
      el.getElementsByTagName("BsWfs:ParameterName")[0] ||
      el.getElementsByTagName("ParameterName")[0];

    const valueNode =
      el.getElementsByTagName("BsWfs:ParameterValue")[0] ||
      el.getElementsByTagName("ParameterValue")[0];

    if (!timeNode || !nameNode || !valueNode) continue;

    const time = timeNode.textContent.trim();
    const name = nameNode.textContent.trim();
    const value = Number(valueNode.textContent);

    if (!Number.isFinite(value)) continue;

    if (name === "SeaLevel") {
      forecast.push({ time, value });
    }

    if (name === "SeaLevelN2000") {
      forecastN2000.push({ time, value });
    }
  }

  return { forecast, forecastN2000 };
}

//MULTILEVELHAKU

export async function fetchSeaLevelMulti(fmisids, stations) {

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    storedquery_id: "fmi::observations::mareograph::simple",
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

    const nameNode = el.querySelector(
      "BsWfs\\:ParameterName, ParameterName"
    );

    const valueNode = el.querySelector(
      "BsWfs\\:ParameterValue, ParameterValue"
    );

    const posNode = el.querySelector(
      "gml\\:pos, pos"
    );

    if (!nameNode || !valueNode || !posNode) continue;

    const name = nameNode.textContent.trim();
    if (name !== "WATLEV") continue;

    const value = Number(valueNode.textContent);
    if (!Number.isFinite(value)) continue;

    const [lat, lon] = posNode.textContent
      .trim()
      .split(/\s+/)
      .map(Number);

    // etsi asema koordinaatin perusteella
    const station = stations.find(
      s =>
        Math.abs(s.lat - lat) < 0.01 &&
        Math.abs(s.lon - lon) < 0.01
    );

    if (!station) continue;

    result[station.fmisid] = Math.round(value / 10);

  }

  return result;
}