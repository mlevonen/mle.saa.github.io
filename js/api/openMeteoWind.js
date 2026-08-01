// ==========================
// Open-Meteo tuulihila
// Hakee pienen hilan (GRID_SIZE x GRID_SIZE) tuulidataa
// havaintopisteen ympäriltä yhdellä API-kutsulla, popupin
// "tuulen virtaus" -visualisointia varten. Tukee myös
// tulevaa ennustetuntia (offsetHours), jotta samasta datasta
// voidaan näyttää nyt-tilanne tai esim. +6h/+12h ennuste.
// ==========================

const GRID_SIZE = 6;          // 6x6 hila
const GRID_SPAN_DEG = 0.3;    // koko hilan leveys asteina (~sopiva lähialueelle)
const FORECAST_DAYS = 2;      // riittää +24h/+36h ennusteille

function findClosestTimeIndex(times, targetDate) {

  if (!Array.isArray(times) || !times.length) return null;

  let bestIdx = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < times.length; i++) {
    // Open-Meteo palauttaa "YYYY-MM-DDTHH:mm" UTC:na kun timezone=UTC
    const t = new Date(times[i] + "Z");
    const diff = Math.abs(t.getTime() - targetDate.getTime());

    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  return bestIdx;
}

// offsetHours: 0 = lähin nykyhetkeä oleva tunti, 6/12/24 jne. = ennuste
export async function fetchWindGrid(lat, lon, offsetHours = 0) {

  const half = GRID_SPAN_DEG / 2;
  const step = GRID_SPAN_DEG / (GRID_SIZE - 1);

  const lats = [];
  const lons = [];

  // row 0 = pohjoisin, col 0 = läntisin
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      lats.push((lat + half - row * step).toFixed(4));
      lons.push((lon - half + col * step).toFixed(4));
    }
  }

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lats.join(",")}` +
    `&longitude=${lons.join(",")}` +
    `&hourly=wind_speed_10m,wind_direction_10m` +
    `&wind_speed_unit=ms` +
    `&forecast_days=${FORECAST_DAYS}` +
    `&timezone=UTC`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Open-Meteo tuulihilan haku epäonnistui");
  }

  const data = await res.json();
  const list = Array.isArray(data) ? data : [data];

  const targetTime = new Date(Date.now() + offsetHours * 3600_000);

  const grid = [];
  let i = 0;

  for (let row = 0; row < GRID_SIZE; row++) {
    const rowArr = [];

    for (let col = 0; col < GRID_SIZE; col++) {
      const point = list[i++];

      const times = point?.hourly?.time ?? [];
      const speeds = point?.hourly?.wind_speed_10m ?? [];
      const dirs = point?.hourly?.wind_direction_10m ?? [];

      const idx = findClosestTimeIndex(times, targetTime);

      const speed = idx != null ? (speeds[idx] ?? 0) : 0;
      const dir = idx != null ? (dirs[idx] ?? 0) : 0;

      // Meteorologinen suunta = mistä tuuli tulee.
      // Muunnetaan vektoriksi joka osoittaa minne tuuli menee.
      const rad = (dir * Math.PI) / 180;
      const u = -speed * Math.sin(rad);
      const v = -speed * Math.cos(rad);

      rowArr.push({ u, v, speed });
    }

    grid.push(rowArr);
  }

  return {
    grid,
    size: GRID_SIZE,
    offsetHours,
    bounds: {
      north: lat + half,
      south: lat - half,
      west: lon - half,
      east: lon + half
    }
  };
}
