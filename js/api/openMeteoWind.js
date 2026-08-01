// ==========================
// Open-Meteo tuulihila
// Hakee pienen hilan (GRID_SIZE x GRID_SIZE) tuulidataa
// havaintopisteen ympäriltä yhdellä API-kutsulla, popupin
// "tuulen virtaus" -visualisointia varten.
// ==========================

const GRID_SIZE = 6;          // 6x6 hila
const GRID_SPAN_DEG = 0.3;    // koko hilan leveys asteina (~sopiva lähialueelle)

export async function fetchWindGrid(lat, lon) {

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
    `&current=wind_speed_10m,wind_direction_10m` +
    `&wind_speed_unit=ms`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Open-Meteo tuulihilan haku epäonnistui");
  }

  const data = await res.json();
  const list = Array.isArray(data) ? data : [data];

  const grid = [];
  let i = 0;

  for (let row = 0; row < GRID_SIZE; row++) {
    const rowArr = [];

    for (let col = 0; col < GRID_SIZE; col++) {
      const point = list[i++];

      const speed = point?.current?.wind_speed_10m ?? 0;
      const dir = point?.current?.wind_direction_10m ?? 0;

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
    bounds: {
      north: lat + half,
      south: lat - half,
      west: lon - half,
      east: lon + half
    }
  };
}
