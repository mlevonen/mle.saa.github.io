// ==========================
// Traficomin merivaroitukset (avoin WFS, CC BY 4.0) – mobiilin lista.
//
// Samat tasot kuin desktopin navWarningsControl.js:ssä:
// navigational_warnings_p (pisteet), _l (viivat) ja _a (alueet).
// Mobiilissa ei ole karttaa, joten tässä tarvitaan vain ominaisuuksien
// tekstitiedot (ei geometriaa).
// ==========================

const WFS_BASE =
  "https://julkinen.traficom.fi/inspirepalvelu/avoin/wfs" +
  "?service=WFS&version=2.0.0&request=GetFeature" +
  "&outputFormat=application/json&srsName=EPSG:4326&typeNames=";

const LAYERS = [
  "navigational_warnings_p",
  "navigational_warnings_l",
  "navigational_warnings_a"
];

// Varoitustekstit tulevat kokonaan isoilla kirjaimilla: pienet kirjaimet
// + isot alkukirjaimet lauseiden/rivien alkuun, koordinaattien
// ilmansuunnat (61-16.12N 021-21.23E) ja N2000 pidetään isoina.
export function normalizeText(text) {
  if (!text) return "";
  let t = String(text).trim().toLowerCase();
  t = t.replace(/(\d)([nsew])\b/g, (m, d, c) => d + c.toUpperCase());
  t = t.replace(/\bn2000\b/g, "N2000");
  t = t.replace(/(^|[.!?]\s+|\n\s*)(\S)/g, (m, pre, ch) => pre + ch.toUpperCase());
  return t;
}

function pick(props, base) {
  return props[base + "_FI"] || props[base + "_EN"] || props[base + "_SV"] || "";
}

// Sisävesivaroituksilla aluekenttä voi olla pitkä pilkuilla erotettu
// luettelo vesistöistä (esim. "Saimaan kanava, Kokemäenjoen vesistö, ...")
// – sellaisenaan se olisi kömpelö ryhmäotsikko, joten tiivistetään.
function areaLabel(name) {
  if (!name) return "Muut";
  return name.split(",").length >= 3 ? "Sisävesialueet" : name.trim();
}

// Palauttaa listan {id, area, place, type, detail, text, time}
export async function fetchNavWarnings() {

  const results = await Promise.all(
    LAYERS.map(async name => {
      try {
        const res = await fetch(WFS_BASE + name);
        if (!res.ok) return [];
        const json = await res.json();
        return json.features || [];
      } catch (err) {
        console.warn("Merivaroitusten haku epäonnistui (" + name + "):", err);
        return [];
      }
    })
  );

  return results.flat().map(f => {
    const p = f.properties || {};
    return {
      id: f.id,
      area: areaLabel(pick(p, "GENERALAREALOCATIONNAME")),
      place: normalizeText(pick(p, "LOCALITYLOCATIONNAME")),
      type: pick(p, "NAVWARNTYPEGENERAL"),
      detail: pick(p, "WARNINGINFORMATIONNAVWARNTYPEDETAILS"),
      text: normalizeText(pick(p, "WARNINGINFORMATION")),
      time: p.PUBLICATIONTIME || null
    };
  });

}
