export async function fetchHarmonieForecastByFmisid(fmisid) {

  const url = `https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::forecast::harmonie::surface::point::multipointcoverage&fmisid=${fmisid}`;

  const res = await fetch(url);
  const text = await res.text();

  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "text/xml");

  // ==========================
  // AIKALEIMAT
  // ==========================
  const positionsText =
    xml.querySelector("gmlcov\\:positions")?.textContent.trim();

  if (!positionsText) return null;

  const posValues = positionsText.split(/\s+/);

  const times = [];
  for (let i = 2; i < posValues.length; i += 3) {
    times.push(Number(posValues[i]) * 1000); // unix → ms
  }

  // ==========================
  // DATA ARVOT
  // ==========================
  const valuesText =
    xml.querySelector("gml\\:doubleOrNilReasonTupleList")?.textContent.trim();

  if (!valuesText) return null;

  const values = valuesText.split(/\s+/).map(v =>
    v === "NaN" ? null : Number(v)
  );

  const blockSize = 21;

  const fcTemp = [];
  const fcWindSpeed = [];
  const fcWindDir = [];
  const fcWindGust = [];

  times.forEach((time, i) => {
    const offset = i * blockSize;

    fcTemp.push({
      utctime: new Date(time).toISOString(),
      temperature: values[offset + 2]
    });

    fcWindDir.push({
      utctime: new Date(time).toISOString(),
      winddirection: values[offset + 5]
    });

    fcWindSpeed.push({
      utctime: new Date(time).toISOString(),
      windspeedms: values[offset + 6]
    });

    fcWindGust.push({
      utctime: new Date(time).toISOString(),
      windgust: values[offset + 20]
    });
  });

  return {
    fcTemp,
    fcWindSpeed,
    fcWindDir,
    fcWindGust
  };
}

