// World geometry. World units are degrees: x = longitude, y = -latitude
// (so north is up on screen). Every country keeps its rings as flat arrays,
// a cached Path2D and a bounding box for fast culling.

export const WORLD = { minX: -180, maxX: 180, minY: -84, maxY: 84 };

export async function loadWorld(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('map ' + res.status);
  const raw = await res.json();
  const countries = raw.map(({ c, p }) => buildCountry(c, p));
  const byCode = new Map(countries.map(k => [k.code, k]));
  return { countries, byCode };
}

function buildCountry(code, rawRings) {
  const rings = rawRings.map(src => {
    const flat = new Float32Array(src.length);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const path = new Path2D();
    for (let i = 0; i < src.length; i += 2) {
      const x = src[i], y = -src[i + 1];
      flat[i] = x; flat[i + 1] = y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    path.closePath();
    return { flat, path, minX, minY, maxX, maxY, area: Math.abs(signedArea(flat)) };
  });
  rings.sort((a, b) => b.area - a.area);
  const box = rings.reduce((b, r) => ({
    minX: Math.min(b.minX, r.minX), minY: Math.min(b.minY, r.minY),
    maxX: Math.max(b.maxX, r.maxX), maxY: Math.max(b.maxY, r.maxY),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const area = rings.reduce((s, r) => s + r.area, 0);
  const label = labelPoint(rings[0]);
  return { code, rings, ...box, area, label, hue: hash(code) };
}

function signedArea(f) {
  let a = 0;
  for (let i = 0, n = f.length, j = n - 2; i < n; j = i, i += 2) a += f[j] * f[i + 1] - f[i] * f[j + 1];
  return a / 2;
}

// Centre of the widest horizontal span through the ring's centroid latitude:
// always inside the shape, even for crescents and coastlines.
function labelPoint(ring) {
  const f = ring.flat;
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, n = f.length, j = n - 2; i < n; j = i, i += 2) {
    const k = f[j] * f[i + 1] - f[i] * f[j + 1];
    a += k; cx += (f[j] + f[i]) * k; cy += (f[j + 1] + f[i + 1]) * k;
  }
  if (Math.abs(a) < 1e-9) return { x: (ring.minX + ring.maxX) / 2, y: (ring.minY + ring.maxY) / 2 };
  cx /= 3 * a; cy /= 3 * a;
  if (pointInRing(f, cx, cy)) return { x: cx, y: cy };
  const xs = [];
  for (let i = 0, n = f.length, j = n - 2; i < n; j = i, i += 2) {
    const y1 = f[j + 1], y2 = f[i + 1];
    if ((y1 > cy) !== (y2 > cy)) xs.push(f[j] + (cy - y1) / (y2 - y1) * (f[i] - f[j]));
  }
  xs.sort((p, q) => p - q);
  let best = null, w = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > w) { w = xs[i + 1] - xs[i]; best = (xs[i] + xs[i + 1]) / 2; }
  return { x: best ?? (ring.minX + ring.maxX) / 2, y: cy };
}

export function pointInRing(f, x, y) {
  let inside = false;
  for (let i = 0, n = f.length, j = n - 2; i < n; j = i, i += 2) {
    const xi = f[i], yi = f[i + 1], xj = f[j], yj = f[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInCountry(c, x, y) {
  if (x < c.minX || x > c.maxX || y < c.minY || y > c.maxY) return false;
  for (const r of c.rings) {
    if (x < r.minX || x > r.maxX || y < r.minY || y > r.maxY) continue;
    if (pointInRing(r.flat, x, y)) return true;
  }
  return false;
}

export function countryAt(world, x, y) {
  for (const c of world.countries) if (pointInCountry(c, x, y)) return c;
  return null;
}

// A random point on land inside the country, preferring big rings.
export function randomPointIn(c, rnd = Math.random) {
  const rings = c.rings.filter(r => r.area >= c.rings[0].area * 0.05 && r.maxX > WORLD.minX && r.minX < WORLD.maxX);
  const total = rings.reduce((s, r) => s + r.area, 0);
  for (let attempt = 0; attempt < 60; attempt++) {
    let pick = rnd() * total, ring = rings[0];
    for (const r of rings) { pick -= r.area; if (pick <= 0) { ring = r; break; } }
    const x = ring.minX + rnd() * (ring.maxX - ring.minX);
    const y = ring.minY + rnd() * (ring.maxY - ring.minY);
    if (x < WORLD.minX + 0.5 || x > WORLD.maxX - 0.5 || y < WORLD.minY || y > WORLD.maxY) continue;
    if (pointInRing(ring.flat, x, y)) return { x, y };
  }
  return { x: c.label.x + (rnd() - 0.5) * 0.3, y: c.label.y + (rnd() - 0.5) * 0.3 };
}

// Point inside `c` closest to (tx, ty), from a cloud of samples.
export function closestPointIn(c, tx, ty, samples = 80) {
  let best = c.label, bd = dist2(c.label.x, c.label.y, tx, ty);
  for (let i = 0; i < samples; i++) {
    const p = randomPointIn(c);
    const d = dist2(p.x, p.y, tx, ty);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

function hash(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}
