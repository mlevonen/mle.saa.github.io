// ==========================
// Merialueluokittelu
//
// Jakaa coastal- ja wavebuoy-asemat merialueisiin lat/lon-
// koordinaattien perusteella, jotta niitä voi ryhmitellä esim.
// mobiililistassa. Kahdeksan selvästi sisämaassa (Saimaa/Päijänne-
// vesistö) olevaa asemaa on listattu erikseen tunnisteella, koska
// niiden pituusaste osuisi muuten samalle vyöhykkeelle kuin osa
// Suomenlahden rannikkoasemista (esim. Lappeenranta vs. Kotka) –
// pelkkä koordinaattiheuristiikka sekoittaisi ne.
// ==========================

const INLAND_LAKE_STATION_IDS = new Set([
  "asikkala-pulkkilanharju-weather",
  "luhanka-judinsalo-weather",
  "tampere-siilinkari-weather",
  "lappeenranta-hiekkapakka-weather",
  "rantasalmi-rukkasluoto-weather",
  "liperi-tuiskavanluoto-weather",
  "kuopio-ritoniemi-weather",
  "inari-seitalaassa-weather",
  "lieksa-lampela-weather",
  "kajaani-lentoasema-weather",
  "sodankylä-lokka-weather"
]);

// Näyttöjärjestys etelästä pohjoiseen, sisämaa viimeisenä.
export const SEA_AREA_ORDER = [
  "Suomenlahti",
  "Saaristomeri ja Ahvenanmaa",
  "Selkämeri",
  "Merenkurkku",
  "Perämeri",
  "Sisämaa"
];

export function getSeaArea(station) {

  if (INLAND_LAKE_STATION_IDS.has(station.id)) {
    return "Sisämaa";
  }

  const { lat, lon } = station;

  if (lat >= 63.8) return "Perämeri";
  if (lat >= 62.3 && lon <= 22.6) return "Merenkurkku";
  if (lat >= 60.65 && lon <= 22.2) return "Selkämeri";
  if (lon <= 23.0) return "Saaristomeri ja Ahvenanmaa";

  return "Suomenlahti";

}

// Merialueen SISÄINEN järjestys (esim. mobiililistassa) – pyrkii
// mukailemaan rannikon suuntaa aakkosjärjestyksen sijaan, jotta lista
// etenee maantieteellisesti johdonmukaisesti. Suomenlahti ja
// Saaristomeri ja Ahvenanmaa kulkevat pääosin länsi-itä-suunnassa
// (rannikko/saaristo levittäytyy sivuttain), joten ne järjestetään
// pituusasteen mukaan lännestä itään. Muut alueet (Selkämeri,
// Merenkurkku, Perämeri) kulkevat länsirannikkoa pohjois-etelä-
// suunnassa, joten ne järjestetään leveysasteen mukaan pohjoisesta
// etelään. Sisämaan järvillä ei ole vastaavaa rannikkoa, joten
// käytetään samaa pohjois-etelä-järjestystä yksinkertaisuuden vuoksi.
const WEST_TO_EAST_AREAS = new Set(["Suomenlahti", "Saaristomeri ja Ahvenanmaa"]);

export function sortStationsWithinArea(area, stationList) {
  const sorted = stationList.slice();
  if (WEST_TO_EAST_AREAS.has(area)) {
    sorted.sort((a, b) => a.lon - b.lon);
  } else {
    sorted.sort((a, b) => b.lat - a.lat);
  }
  return sorted;
}

// Ryhmittelee asemalistan merialueittain SEA_AREA_ORDER-järjestyksessä.
// Palauttaa taulukon { area, stations } -objekteja (vain ei-tyhjät ryhmät).
export function groupBySeaArea(stationList) {

  const groups = {};

  for (const station of stationList) {
    const area = getSeaArea(station);
    if (!groups[area]) groups[area] = [];
    groups[area].push(station);
  }

  return SEA_AREA_ORDER
    .filter(area => groups[area]?.length)
    .map(area => ({ area, stations: groups[area] }));

}
