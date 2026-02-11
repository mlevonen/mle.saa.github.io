const sunCache = {};

export async function fetchSunTimes(lat, lon) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;

  // 🔹 CACHE HIT
  if (sunCache[key]) {
    return sunCache[key];
  }

  const url =
    "https://api.sunrise-sunset.org/json" +
    `?lat=${lat}` +
    `&lng=${lon}` +
    "&formatted=0" +
    "&tzid=Europe/Helsinki";

  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== "OK") return null;

  const result = {
    sunrise: json.results.sunrise,
    sunset: json.results.sunset
  };

  // 🔹 Tallenna cacheen
  sunCache[key] = result;

  return result;
}
