export async function fetchPressureByFmisid(fmisid) { const now = new Date(); const startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(); const endTime = now.toISOString(); const url = `
    https://opendata.fmi.fi/wfs?service=WFS
    &version=2.0.0
    &request=getFeature
    &storedquery_id=fmi::observations::weather::simple
    &fmisid=${fmisid}
    &parameters=pressure
    &starttime=${startTime}
    &endtime=${endTime}
  `.replace(/\s+/g, ''); const response = await fetch(url); const xmlText = await response.text(); const parser = new DOMParser(); const xml = parser.parseFromString(xmlText, "application/xml");   const elements = [...xml.getElementsByTagName("*")] .filter(el => el.localName === "BsWfsElement"); if (!elements.length) { console.warn("No BsWfsElement elements found"); return []; } const result = elements .map(el => { const paramName = [...el.children] .find(c => c.localName === "ParameterName")?.textContent; if (paramName !== "pressure") return null; const time = [...el.children] .find(c => c.localName === "Time")?.textContent; const value = [...el.children] .find(c => c.localName === "ParameterValue")?.textContent; return { utctime: time, pressurehpa: Number(value) }; }) .filter(p => p && Number.isFinite(p.pressurehpa)); return result; }
