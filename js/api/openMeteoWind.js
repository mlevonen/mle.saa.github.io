// ==========================
// Open-Meteo tuulihila
// Hakee pienen hilan (GRID_SIZE x GRID_SIZE) tuulidataa
// havaintopisteen ympäriltä yhdellä API-kutsulla, popupin
// "tuulen virtaus" -visualisointia varten.
//
// fetchWindGridSeries hakee koko tuntikohtaisen ennustesarjan
// (FORECAST_DAYS päivää) kerralla, jotta napit ja liukusäädin
// voivat vaihtaa näytettävää tuntia ilman uusia verkkokutsuja.
// ==========================

const GRID_SIZE = 6;          // 6x6 hila
const GRID_SPAN_DEG = 0.3;    // koko hilan leveys asteina (~sopiva lähialueelle)
const FORECAST_DAYS = 2;      // 48h dataa riittää +24h/+36h/+48h -tarkasteluun

function buildVector(speed, dir) {
  // Meteorologinen suunta = mistä tuuli tulee.
  // Muunnetaan vektoriksi joka osoittaa minne tuuli menee.
  const rad = (dir * Math.PI) / 180;
  return {
    u: -speed * Math.sin(rad),
    v: -speed * Math.cos(rad),
    speed
  };
}

export async function fetchWindGridSeries(lat, lon) {

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

  // Oletetaan että kaikilla hilan pisteillä on sama aikasarja
  // (sama forecast_days/timezone kaikille kutsuille).
  const referenceTimes = list[0]?.hourly?.time ?? [];

  // Etsi tuntisarjasta lähinnä nykyhetkeä oleva indeksi -> offset 0
  const now = Date.now();
  let startIdx = 0;
  let bestDiff = Infinity;

  referenceTimes.forEach((t, idx) => {
    const diff = Math.abs(new Date(t + "Z").getTime() - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      startIdx = idx;
    }
  });

  const maxOffset = Math.max(0, referenceTimes.length - startIdx - 1);

  const series = [];
  const hours = [];

  for (let offset = 0; offset <= maxOffset; offset++) {
    const idx = startIdx + offset;

    const grid = [];
    let i = 0;

    for (let row = 0; row < GRID_SIZE; row++) {
      const rowArr = [];

      for (let col = 0; col < GRID_SIZE; col++) {
        const point = list[i++];
        const speed = point?.hourly?.wind_speed_10m?.[idx] ?? 0;
        const dir = point?.hourly?.wind_direction_10m?.[idx] ?? 0;

        rowArr.push(buildVector(speed, dir));
      }

      grid.push(rowArr);
    }

    series.push(grid);
    hours.push(new Date(referenceTimes[idx] + "Z"));
  }

  return {
    size: GRID_SIZE,
    bounds: {
      north: lat + half,
      south: lat - half,
      west: lon - half,
      east: lon + half
    },
    series,
    hours
  };
}
