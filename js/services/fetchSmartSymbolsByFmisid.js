export async function fetchSmartSymbolsByFmisid(fmisid) {

  const url =
    `https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0` +
    `&request=getFeature` +
    `&storedquery_id=fmi::forecast::harmonie::surface::point::multipointcoverage` +
    `&fmisid=${fmisid}` +
    `&parameters=smartsymbol`;

  const res = await fetch(url);
  const text = await res.text();

  const xml = new DOMParser().parseFromString(text, "text/xml");

  const posNode = xml.querySelector("gmlcov\\:positions");
  const symNode = xml.querySelector("gml\\:doubleOrNilReasonTupleList");

  if (!posNode || !symNode) return [];

  const pos = posNode.textContent.trim().split(/\s+/);
  const sym = symNode.textContent.trim().split(/\s+/).map(Number);

  const result = [];

  for (let i = 0; i < sym.length; i++) {

    const unix = Number(pos[i * 3 + 2]);

    result.push({
      time: new Date(unix * 1000),
      symbol: sym[i]
    });

  }

  return result;
}