export async function fetchPressureByPlace(place) {
  const url =
    "https://opendata.fmi.fi/wfs" +
    "?service=WFS" +
    "&version=2.0.0" +
    "&request=getFeature" +
    "&storedquery_id=fmi::observations::weather::simple" +
    `&place=${encodeURIComponent(place)}` +
    "&parameters=pressure";

  const res = await fetch(url);
  const xmlText = await res.text();

  // Etsitään viimeisin painearvo
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  const times = [...xml.querySelectorAll("BsWfs\\:Time")];
  const values = [...xml.querySelectorAll("BsWfs\\:ParameterValue")];

  if (!times.length || !values.length) return [];

  return [
    {
      utctime: times.at(-1).textContent,
      pressurehpa: Number(values.at(-1).textContent)
    }
  ];
}
