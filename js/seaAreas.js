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
  "inari-seitalaassa-weather"
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
