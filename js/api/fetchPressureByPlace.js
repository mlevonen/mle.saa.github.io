export async function fetchPressureByFmisid(fmisid) {

  const now = new Date();
  const startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
  const endTime = now.toISOString();

  const url = `
    https://opendata.fmi.fi/wfs?service=WFS
    &version=2.0.0
    &request=getFeature
    &storedquery_id=fmi::observations::weather::simple
    &fmisid=${fmisid}
    &parameters=pressure
    &starttime=${startTime}
    &endtime=${endTime}
  `.replace(/\s+/g, '');

  const response = await fetch(url);
  const text = await response.text();

  return text;
  

  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  const times = [...xml.getElementsByTagName("*")]
  .filter(el => el.localName === "time");

  const values = [...xml.getElementsByTagName("*")]
  .filter(el => el.localName === "value");


  if (!times.length || !values.length) {
    console.warn("No pressure data found for place:", place);
    return [];
  }

  return times.map((t, i) => ({
    utctime: t.textContent,
    pressurehpa: Number(values[i]?.textContent)
  })).filter(p => Number.isFinite(p.pressurehpa));
}
