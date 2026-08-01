// ==========================
// Auringonnousu / -lasku (Open-Meteo)
// Käytetään samaa Open-Meteo-rajapintaa kuin tuuliennusteanimaatiossa
// (aiemmin api.sunrise-sunset.org) – yksi ulkoinen riippuvuus vähemmän.
// ==========================

const sunCache = {};

export async function fetchSunTimes(lat, lon) {

  const cacheKey = `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
  if (sunCache[cacheKey]) return sunCache[cacheKey];

  try {

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=sunrise,sunset` +
      `&timezone=UTC` +
      `&forecast_days=1`;

    const res = await fetch(url);

    if (!res.ok) {
      console.warn("Open-Meteo sun API failed:", res.status);
      return null;
    }

    const data = await res.json();

    const sunrise = data?.daily?.sunrise?.[0];
    const sunset = data?.daily?.sunset?.[0];

    if (!sunrise || !sunset) return null;

    // Open-Meteo palauttaa ajat ilman aikavyöhykepäätettä, vaikka
    // timezone=UTC on pyydetty ("2026-08-01T05:23") – lisätään "Z"
    // jotta new Date(...) tulkitsee ajan oikein UTC-hetkenä
    // (sama temppu kuin openMeteoWind.js:ssä).
    const result = {
      sunrise: sunrise + "Z",
      sunset: sunset + "Z"
    };

    sunCache[cacheKey] = result;
    return result;

  } catch (err) {

    console.warn("Open-Meteo sun API error:", err);
    return null;

  }

}
