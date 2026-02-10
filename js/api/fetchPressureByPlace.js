export async function fetchPressureByPlace(place) {
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 3600_000);

  const url =
    "https://opendata.fmi.fi/wfs" +
    "?service=WFS" +
    "&version=2.0.0" +
    "&request=getFeature" +
    "&storedquery_id=fmi::observations::weather::simple" +
    `&place=${encodeURIComponent(place)}` +
    "&parameters=pressure" +
    `&starttime=${start.toISOString()}` +
    `&endtime=${end.toISOString()}`;

  const res = await fetch(url);
  const xmlText = await res.text();

  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  const times = [...xml.querySelectorAll("BsWfs\\:Time")];
  const values = [...xml.querySelectorAll("BsWfs\\:ParameterValue")];

  if (!times.length || !values.length) return [];

  return times.map((t, i) => ({
    utctime: t.textContent,
    pressurehpa: Number(values[i]?.textContent)
  })).filter(p => !Number.isNaN(p.pressurehpa));
}