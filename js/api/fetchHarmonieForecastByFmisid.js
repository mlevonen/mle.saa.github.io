export async function fetchHarmonieForecastByFmisid(fmisid) {

  const url = `
    https://opendata.fmi.fi/wfs
    ?service=WFS
    &version=2.0.0
    &request=getFeature
    &storedquery_id=fmi::forecast::harmonie::surface::point::multipointcoverage
    &fmisid=${fmisid}
  `.replace(/\s+/g, "");

  const res = await fetch(url);
  if (!res.ok) throw new Error("Harmonie forecast fetch failed");

  const xmlText = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  // 1️⃣ Hae unix-aikaleimat
  const positionsNode = xml.querySelector("gmlcov\\:positions");
  if (!positionsNode) return [];

  const posValues = positionsNode.textContent.trim().split(/\s+/);

  const times = [];
  for (let i = 2; i < posValues.length; i += 3) {
    times.push(Number(posValues[i]));
  }

  // 2️⃣ Hae tupleList
  const tupleNode = xml.querySelector("gml\\:doubleOrNilReasonTupleList");
  if (!tupleNode) return [];

  const values = tupleNode.textContent.trim().split(/\s+/).map(v =>
    v === "NaN" ? null : Number(v)
  );

  // 3️⃣ Kenttiä on 21 kappaletta (kuten dokumentissa)
  const FIELD_COUNT = 21;

  const forecast = [];

  for (let i = 0; i < times.length; i++) {

    const base = i * FIELD_COUNT;
    const slot = values.slice(base, base + FIELD_COUNT);

    if (slot.length !== FIELD_COUNT) continue;

    forecast.push({
      time: new Date(times[i] * 1000),
      pressure: slot[0],
      temperature: slot[2],
      windDirection: slot[5],
      windSpeed: slot[6],
      windGust: slot[20]
    });
  }

  return forecast;
}
