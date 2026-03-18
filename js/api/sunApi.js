const sunCache = {};

export async function fetchSunTimes(lat, lon) {

  try {

    const url =
      `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`;

    const res = await fetch(url);

    if (!res.ok) {
      console.warn("Sun API failed:", res.status);
      return null;
    }

    const data = await res.json();

    return data?.results ?? null;

  } catch (err) {

    console.warn("Sun API error:", err);
    return null;

  }

}

