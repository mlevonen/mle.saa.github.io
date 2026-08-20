// ==========================
// Suosikkiasemat (mobiiliversio)
//
// Tallennetaan pelkkä lista asema-id:itä selaimen localStorageen.
// Ei backendia, ei kirjautumista – suosikit ovat laite-/selain-
// kohtaisia, kuten muutkin tämän staattisen sivuston asetukset.
// ==========================

const STORAGE_KEY = "merisaa_favorites";

function readFavoriteIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // localStorage ei käytettävissä (esim. tiukka yksityinen selaus) –
    // suosikit eivät tällöin tallennu istuntojen välillä, mutta sivu
    // toimii silti normaalisti.
    return [];
  }
}

function writeFavoriteIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ks. yllä – hiljainen epäonnistuminen on tarkoituksellista.
  }
}

export function getFavoriteIds() {
  return readFavoriteIds();
}

export function isFavorite(stationId) {
  return readFavoriteIds().includes(stationId);
}

// Kääntää suosikkitilan ja palauttaa UUDEN tilan (true = nyt suosikki).
export function toggleFavorite(stationId) {
  const ids = readFavoriteIds();
  const idx = ids.indexOf(stationId);

  if (idx === -1) {
    ids.push(stationId);
  } else {
    ids.splice(idx, 1);
  }

  writeFavoriteIds(ids);
  return idx === -1;
}
