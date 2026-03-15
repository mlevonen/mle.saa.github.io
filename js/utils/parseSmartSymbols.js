export function parseSmartSymbols(xml) {

const posNode = xml.getElementsByTagName("gmlcov:positions")[0];
const symNode = xml.getElementsByTagName("gml:doubleOrNilReasonTupleList")[0];

if (!posNode || !symNode) {
  console.warn("smartsymbol XML parse failed");
  return [];
}

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
console.log("parsed symbols", result.slice(0,5));

