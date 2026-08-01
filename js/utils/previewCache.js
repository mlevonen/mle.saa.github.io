// ==========================
// Pieni yleiskäyttöinen localStorage-välimuisti markerien
// esikatseluarvoille (tuuli, lämpötila jne). Näin kartan
// avatessa viimeksi tunnetut lukemat voidaan piirtää heti,
// ennen kuin tuore data ehtii palvelimelta.
// ==========================

const DEFAULT_TTL = 5 * 60 * 1000;

export function loadPreviewCache(key, ttl = DEFAULT_TTL) {

  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {

    const data = JSON.parse(raw);

    if (Date.now() - data.time > ttl) {
      return null;
    }

    return data.values;

  } catch {
    return null;
  }

}

export function savePreviewCache(key, values) {

  try {
    localStorage.setItem(
      key,
      JSON.stringify({ time: Date.now(), values })
    );
  } catch {
    // localStorage voi olla täynnä tms. – ei kriittistä, ohitetaan.
  }

}
