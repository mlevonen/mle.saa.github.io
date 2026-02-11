export async function fetchSunTimes(lat, lon) {
  const url =
    "https://api.sunrise-sunset.org/json" +
    `?lat=${lat}` +
    `&lng=${lon}` +
    "&formatted=0" +
    "&tzid=Europe/Helsinki";

  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== "OK") return null;

  return {
    sunrise: json.results.sunrise,
    sunset: json.results.sunset
  };
}
