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
  

  const points = [...xml.getElementsByTagName("*")]
  .filter(el => el.localName === "MeasurementTVP");

  return points.map(p => {
  const time = [...p.children].find(c => c.localName === "time");
  const value = [...p.children].find(c => c.localName === "value");

  return {
    utctime: time?.textContent,
    pressurehpa: Number(value?.textContent)
  };
  }).filter(p => Number.isFinite(p.pressurehpa));

}
