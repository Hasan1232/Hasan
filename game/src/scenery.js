// Cities and buildings drawn in fake 3D: each roof is shifted away from the
// screen centre in proportion to its height, so towers lean like a camera
// looking straight down from a plane. Walls facing the centre are shaded by
// a fixed sun, and every building casts a shadow.

import { pointInCountry } from './geo.js';

const SUN = { x: -0.6, y: -0.8 };        // light comes from the north-west
const SHADOW = { x: 0.55, y: 0.75 };     // shadows fall south-east
const CELL = 0.36;                       // city block spacing, degrees

export async function loadCities(url, world) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('cities ' + res.status);
  const rows = (await res.json()).sort((a, b) => b[4] - a[4]);
  const kept = [];
  for (const [name, cc, lon, lat, pop, cap] of rows) {
    const x = lon, y = -lat;
    // Merge cities that would overlap (Cairo and Giza, for example).
    if (kept.some(k => Math.hypot(k.x - x, k.y - y) < k.R + 0.6)) continue;
    const R = Math.min(2, 0.8 + 0.38 * Math.log10(Math.max(1, pop / 1e5)));
    kept.push({ name, cc, x, y, pop, cap: !!cap, R, buildings: null, country: world.byCode.get(cc) || null });
  }
  return kept;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const PALETTE = [
  [176, 168, 152], [160, 156, 148], [190, 180, 160], [150, 140, 128], [168, 160, 170], [140, 150, 150],
];

// Lay the city out on a rotated street grid; taller towers downtown.
function generate(city) {
  const r = rng(hashStr(city.name + city.cc));
  const ang = r() * Math.PI / 2;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const n = Math.ceil(city.R / CELL) + 1;
  const big = Math.min(1, Math.log10(Math.max(1, city.pop / 1e5)) / 2);
  const list = [];
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const gx = i * CELL, gy = j * CELL;
      const dist = Math.hypot(gx, gy);
      if (dist > city.R) continue;
      const edge = dist / city.R;
      if (r() < edge * 0.55) continue;            // thinner towards the outskirts
      if ((i === 0 || j === 0) && r() < 0.7) continue; // main avenues
      const x = city.x + gx * ca - gy * sa, y = city.y + gx * sa + gy * ca;
      if (city.country && !pointInCountry(city.country, x, y)) continue; // not in the sea
      const centre = Math.pow(1 - edge, 2.2);
      const parts = r() < 0.35 ? 2 : 1;
      for (let p = 0; p < parts; p++) {
        const w = parts === 1 ? CELL * (0.5 + r() * 0.3) : CELL * (0.28 + r() * 0.12);
        const d = parts === 1 ? CELL * (0.45 + r() * 0.35) : CELL * (0.55 + r() * 0.2);
        const ox = parts === 1 ? 0 : (p ? 1 : -1) * CELL * 0.2;
        let h = 0.006 + r() * 0.012 + centre * (0.02 + big * 0.03) * (0.5 + r());
        let tower = false;
        if (centre > 0.35 && r() < 0.18 + big * 0.2) { h += 0.03 + r() * 0.04 * (0.5 + big); tower = true; }
        const col = PALETTE[(r() * PALETTE.length) | 0];
        list.push({
          x: x + ox * ca, y: y + ox * sa, w: tower ? w * 0.75 : w, d: tower ? d * 0.75 : d, h, rot: ang,
          col: tower ? [120 + r() * 30 | 0, 150 + r() * 30 | 0, 175 + r() * 25 | 0] : col, glass: tower, lit: r(),
        });
      }
    }
  }
  city.buildings = list;
  city.roads = { ang, n };
}

// Military props around a ground unit (hangars, tower, fuel tanks, bunkers).
export function makeProps(kind, x, y) {
  const r = rng(hashStr(kind + x.toFixed(2) + y.toFixed(2)));
  const rot = kind === 'airbase' ? 0.5 : r() * 3;
  const ca = Math.cos(rot), sa = Math.sin(rot);
  const at = (dx, dy) => ({ x: x + dx * ca - dy * sa, y: y + dx * sa + dy * ca });
  const props = [];
  const box = (dx, dy, w, d, h, col, extra = {}) => props.push({ ...at(dx, dy), w, d, h, rot, col, ...extra });
  if (kind === 'airbase') {
    for (let i = -1; i <= 1; i++) box(i * 0.32, 0.36, 0.24, 0.2, 0.012, [128, 132, 120], { hangar: true });
    box(0.5, -0.3, 0.08, 0.08, 0.045, [190, 190, 185], { tower: true });
    for (let i = 0; i < 3; i++) props.push({ ...at(-0.55 + i * 0.16, -0.32), r: 0.065, h: 0.014, tank: true, col: [200, 200, 195] });
  } else if (kind === 'sam') {
    box(-0.25, 0.22, 0.16, 0.1, 0.008, [92, 104, 84]);
    box(0.24, 0.24, 0.16, 0.1, 0.008, [92, 104, 84]);
    box(0, -0.3, 0.14, 0.14, 0.006, [110, 110, 104], { bunker: true });
  } else if (kind === 'radar') {
    box(-0.26, 0.1, 0.18, 0.14, 0.012, [150, 150, 140]);
    box(0.24, 0.18, 0.1, 0.1, 0.03, [170, 170, 160], { tower: true });
  }
  return props;
}

// ---------------------------------------------------------------- drawing

export function drawCityGround(g, cities, view, z) {
  const visible = [];
  for (const c of cities) {
    if (c.x + c.R < view.minX || c.x - c.R > view.maxX || c.y + c.R < view.minY || c.y - c.R > view.maxY) continue;
    if (!c.buildings) generate(c);
    visible.push(c);
    // Urban area tint and street grid.
    g.fillStyle = 'rgba(120,115,100,0.22)';
    g.beginPath(); g.arc(c.x, c.y, c.R * 1.05, 0, 6.283); g.fill();
    if (z > 18) {
      g.save();
      g.beginPath(); g.arc(c.x, c.y, c.R, 0, 6.283); g.clip();
      g.translate(c.x, c.y); g.rotate(c.roads.ang);
      g.strokeStyle = 'rgba(70,72,70,0.55)';
      const span = c.roads.n * CELL;
      for (let k = -c.roads.n; k <= c.roads.n; k++) {
        const o = (k + 0.5) * CELL;
        g.lineWidth = (k === 0 || k === -1 ? 3.2 : 1.4) / z;
        g.beginPath(); g.moveTo(-span, o); g.lineTo(span, o); g.moveTo(o, -span); g.lineTo(o, span); g.stroke();
      }
      g.restore();
    }
  }
  return visible;
}

// Draws every building in `items` (city buildings and military props) with
// shadows first, then walls and roofs ordered far-to-near from the camera.
export function drawBuildings(g, items, cam, z, night) {
  if (!items.length) return;
  const full = z > 16;
  for (const b of items) { b._d = (b.x - cam.x) ** 2 + (b.y - cam.y) ** 2; }
  items.sort((a, b) => b._d - a._d);

  // Shadows.
  g.fillStyle = 'rgba(0,0,0,0.28)';
  for (const b of items) {
    const h = b.dead ? 0.002 : b.h;
    const sx = SHADOW.x * h * 9, sy = SHADOW.y * h * 9;
    if (b.tank) {
      g.beginPath(); g.arc(b.x + sx, b.y + sy, b.r, 0, 6.283); g.fill();
      continue;
    }
    const c = corners(b);
    const pts = [];
    for (let i = 0; i < 8; i += 2) pts.push([c[i], c[i + 1]], [c[i] + sx, c[i + 1] + sy]);
    const hull = convexHull(pts);
    g.beginPath();
    g.moveTo(hull[0][0], hull[0][1]);
    for (let i = 1; i < hull.length; i++) g.lineTo(hull[i][0], hull[i][1]);
    g.closePath();
    g.fill();
  }

  for (const b of items) {
    if (b.dead) { drawRubble(g, b); continue; }
    const ox = (b.x - cam.x) * b.h, oy = (b.y - cam.y) * b.h;
    const [r, gg, bl] = b.col;
    if (b.tank) { drawTank(g, b, ox, oy, z); continue; }
    const c = corners(b);
    if (full) {
      // Walls that face the camera centre.
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const ax = c[i * 2], ay = c[i * 2 + 1], bx = c[j * 2], by = c[j * 2 + 1];
        const nx = by - ay, ny = -(bx - ax); // outward normal (clockwise ring)
        if (nx * ox + ny * oy >= 0) continue;
        const len = Math.hypot(nx, ny) || 1;
        const lit = 0.6 + 0.35 * ((nx * SUN.x + ny * SUN.y) / len);
        g.fillStyle = `rgb(${r * lit | 0},${gg * lit | 0},${bl * lit | 0})`;
        g.beginPath();
        g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(bx + ox, by + oy); g.lineTo(ax + ox, ay + oy);
        g.closePath(); g.fill();
        // Window rows on taller walls.
        if (b.h > 0.02 && z > 26) {
          g.strokeStyle = night && b.lit > 0.4 ? 'rgba(255,220,140,0.55)' : b.glass ? 'rgba(200,230,255,0.35)' : 'rgba(40,40,40,0.25)';
          g.lineWidth = 1 / z;
          const rows = Math.min(8, Math.floor(b.h / 0.008));
          g.beginPath();
          for (let k = 1; k <= rows; k++) {
            const f = k / (rows + 1);
            g.moveTo(ax + ox * f, ay + oy * f); g.lineTo(bx + ox * f, by + oy * f);
          }
          g.stroke();
        }
      }
    }
    // Roof.
    g.fillStyle = `rgb(${Math.min(255, r * 1.08) | 0},${Math.min(255, gg * 1.08) | 0},${Math.min(255, bl * 1.08) | 0})`;
    g.beginPath();
    g.moveTo(c[0] + ox, c[1] + oy);
    for (let i = 2; i < 8; i += 2) g.lineTo(c[i] + ox, c[i + 1] + oy);
    g.closePath();
    g.fill();
    if (full) {
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1 / z; g.stroke();
      if (b.hangar) {
        g.strokeStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        for (let k = 1; k < 4; k++) {
          const f = k / 4;
          g.moveTo(c[0] + ox + (c[2] - c[0]) * f, c[1] + oy + (c[3] - c[1]) * f);
          g.lineTo(c[6] + ox + (c[4] - c[6]) * f, c[7] + oy + (c[5] - c[7]) * f);
        }
        g.stroke();
      }
      if (b.glass) {
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.beginPath(); g.moveTo(c[0] + ox, c[1] + oy); g.lineTo(c[2] + ox, c[3] + oy); g.lineTo(c[4] + ox, c[5] + oy); g.closePath(); g.fill();
      }
    }
    if (night && b.h > 0.015 && b.lit > 0.6) {
      g.fillStyle = 'rgba(255,60,50,0.9)';
      g.fillRect(b.x + ox - 0.012, b.y + oy - 0.012, 0.024, 0.024);
    }
  }
}

function corners(b) {
  if (b._c && b._cx === b.x) return b._c;
  const ca = Math.cos(b.rot), sa = Math.sin(b.rot);
  const hw = b.w / 2, hd = b.d / 2;
  const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  b._c = pts.flatMap(([px, py]) => [b.x + px * ca - py * sa, b.y + px * sa + py * ca]);
  b._cx = b.x;
  return b._c;
}

function drawTank(g, b, ox, oy, z) {
  const [r, gg, bl] = b.col;
  const len = Math.hypot(ox, oy);
  if (len > 1e-6) {
    const px = -oy / len * b.r, py = ox / len * b.r;
    g.fillStyle = `rgb(${r * 0.7 | 0},${gg * 0.7 | 0},${bl * 0.7 | 0})`;
    g.beginPath();
    g.moveTo(b.x + px, b.y + py); g.lineTo(b.x + px + ox, b.y + py + oy);
    g.lineTo(b.x - px + ox, b.y - py + oy); g.lineTo(b.x - px, b.y - py);
    g.closePath(); g.fill();
  }
  g.fillStyle = `rgb(${r},${gg},${bl})`;
  g.beginPath(); g.arc(b.x + ox, b.y + oy, b.r, 0, 6.283); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1 / z; g.stroke();
}

function drawRubble(g, b) {
  const w = b.tank ? b.r * 2 : b.w, d = b.tank ? b.r * 2 : b.d;
  g.save();
  g.translate(b.x, b.y); g.rotate(b.rot || 0);
  g.fillStyle = '#2a2622';
  g.fillRect(-w / 2, -d / 2, w, d);
  g.fillStyle = '#3d3630';
  for (let i = 0; i < 4; i++) {
    const a = (i * 2.4 + b.x * 7) % 1, c = (i * 1.7 + b.y * 5) % 1;
    g.fillRect(-w / 2 + Math.abs(a) * w * 0.7, -d / 2 + Math.abs(c) * d * 0.7, w * 0.25, d * 0.25);
  }
  g.restore();
}

export function drawCityLabels(g, cities, cam, z, W, H) {
  if (z < 20) return;
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (const c of cities) {
    const x = W / 2 + (c.x - cam.x) * z, y = H / 2 + (c.y - cam.y + c.R * 0.75) * z;
    if (x < -80 || x > W + 80 || y < -20 || y > H + 20) continue;
    g.font = `${c.cap ? 700 : 500} ${c.cap ? 13 : 11}px system-ui, sans-serif`;
    const label = (c.cap ? '★ ' : '') + c.name;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(label, x + 1, y + 1);
    g.fillStyle = c.cap ? 'rgba(255,235,190,0.95)' : 'rgba(235,235,225,0.85)'; g.fillText(label, x, y);
  }
}

function convexHull(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
