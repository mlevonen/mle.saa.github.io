const sunCache = {};

export async function fetchSunTimes(lat, lon) {
  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    console.warn("Invalid lat/lon for sun API:", lat, lon);
    return null;
  }

  const key = `${latNum.toFixed(3)},${lonNum.toFixed(3)}`;

  if (sunCache[key]) {
    return sunCache[key];
  }

  const url =
    "https://api.sunrise-sunset.org/json" +
    `?lat=${latNum}` +
    `&lng=${lonNum}` +
    "&formatted=0" +
    "&tzid=Europe/Helsinki";

  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== "OK") return null;

  const result = {
    sunrise: json.results.sunrise,
    sunset: json.results.sunset
  };

  sunCache[key] = result;
  return result;
}

