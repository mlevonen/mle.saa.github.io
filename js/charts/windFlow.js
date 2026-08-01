// ==========================
// Animoitu tuulivirtaus (Windy-tyylinen hiukkasanimaatio)
// Piirtää canvasille liikkuvia hiukkasia jotka seuraavat
// bilineaarisesti interpoloitua tuulihilaa.
// ==========================

const PARTICLE_COUNT = 220;
const MAX_AGE = 90;          // framea ennen hiukkasen uudelleensijoitusta
const SPEED_SCALE = 0.16;    // px per (m/s) per frame -kerroin
const BG_COLOR = "#0b1b2b";
const TRAIL_ALPHA = "rgba(11,27,43,0.12)";

function sampleWind(grid, size, w, h, px, py) {

  const gx = (px / w) * (size - 1);
  const gy = (py / h) * (size - 1);

  const x0 = Math.max(0, Math.min(size - 1, Math.floor(gx)));
  const x1 = Math.min(size - 1, x0 + 1);
  const y0 = Math.max(0, Math.min(size - 1, Math.floor(gy)));
  const y1 = Math.min(size - 1, y0 + 1);

  const fx = gx - x0;
  const fy = gy - y0;

  const c00 = grid[y0][x0];
  const c10 = grid[y0][x1];
  const c01 = grid[y1][x0];
  const c11 = grid[y1][x1];

  const u =
    c00.u * (1 - fx) * (1 - fy) +
    c10.u * fx * (1 - fy) +
    c01.u * (1 - fx) * fy +
    c11.u * fx * fy;

  const v =
    c00.v * (1 - fx) * (1 - fy) +
    c10.v * fx * (1 - fy) +
    c01.v * (1 - fx) * fy +
    c11.v * fx * fy;

  return { u, v };
}

// Palauttaa stop()-funktion, jolla animaatio pysäytetään
// (esim. kun popup suljetaan).
export function renderWindFlow(canvas, gridData) {

  const { grid, size } = gridData;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  let maxSpeed = 0.5;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.speed > maxSpeed) maxSpeed = cell.speed;
    }
  }

  function randomParticle() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      age: Math.random() * MAX_AGE
    };
  }

  const particles = Array.from({ length: PARTICLE_COUNT }, randomParticle);

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  let rafId = null;
  let stopped = false;

  function step() {
    if (stopped) return;

    ctx.fillStyle = TRAIL_ALPHA;
    ctx.fillRect(0, 0, w, h);

    for (const p of particles) {

      const { u, v } = sampleWind(grid, size, w, h, p.x, p.y);

      const nx = p.x + u * SPEED_SCALE;
      const ny = p.y - v * SPEED_SCALE; // canvas y kasvaa alaspäin

      const speed = Math.hypot(u, v);
      const alpha = Math.min(0.9, 0.25 + (speed / maxSpeed) * 0.65);

      ctx.strokeStyle = `rgba(120,200,255,${alpha})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      p.x = nx;
      p.y = ny;
      p.age++;

      if (p.age > MAX_AGE || p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
        Object.assign(p, randomParticle());
      }
    }

    rafId = requestAnimationFrame(step);
  }

  rafId = requestAnimationFrame(step);

  return function stop() {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
}
