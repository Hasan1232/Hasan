// كود مشترك بين الخادم والمتصفح: الخريطة، الأسلحة، التصادم، وإصابة الأشعة.

export const WORLD = 60; // نصف طول الخريطة بالمتر
export const PLAYER = { r: 0.35, h: 1.8, hc: 1.3, eye: 1.62, eyeC: 1.1 };

export const WEAPONS = [
  { name: 'بندقية هجومية AR-7', short: 'AR-7', dmg: 26, head: 2.0, rpm: 600, mag: 30, reload: 2.2, range: 120, spread: 0.014, adsSpread: 0.003, auto: true, recoil: 0.011, zoom: 1.35 },
  { name: 'قناصة SR-90', short: 'SR-90', dmg: 85, head: 2.5, rpm: 45, mag: 5, reload: 3.0, range: 250, spread: 0.06, adsSpread: 0.0004, auto: false, recoil: 0.06, zoom: 4 },
  { name: 'مسدس P-9', short: 'P-9', dmg: 22, head: 1.8, rpm: 380, mag: 12, reload: 1.4, range: 60, spread: 0.016, adsSpread: 0.006, auto: false, recoil: 0.02, zoom: 1.2 },
];

// ---------- الخريطة ----------
export const BOXES = [];
function add(x, z, w, d, h, type = 'concrete', y0 = 0) {
  BOXES.push({ x0: x - w / 2, x1: x + w / 2, y0, y1: y0 + h, z0: z - d / 2, z1: z + d / 2, type });
}
// يضيف القطعة ونسختها المعكوسة حول المركز حتى تكون الخريطة عادلة للفريقين
function sym(x, z, w, d, h, type, y0) {
  add(x, z, w, d, h, type, y0);
  add(-x, -z, w, d, h, type, y0);
}

// السور الخارجي
add(0, -WORLD - 0.5, WORLD * 2 + 2, 1, 5, 'border');
add(0, WORLD + 0.5, WORLD * 2 + 2, 1, 5, 'border');
add(-WORLD - 0.5, 0, 1, WORLD * 2 + 2, 5, 'border');
add(WORLD + 0.5, 0, 1, WORLD * 2 + 2, 5, 'border');

// البرج المركزي والمجمّع حوله
add(0, 0, 6, 6, 7, 'building');
sym(-7, -10, 10, 0.6, 3.5, 'concrete');
sym(7.5, -10, 5, 0.6, 3.5, 'concrete');
sym(-12, -4, 0.6, 12, 3.5, 'concrete');

// مبانٍ
sym(-38, -30, 12, 10, 6, 'building');
sym(35, -38, 10, 14, 8, 'building');
sym(5, -32, 14, 8, 5, 'building');
sym(-48, 8, 8, 12, 6, 'building');

// حاويات شحن
sym(-25, -15, 12, 2.6, 2.6, 'container');
sym(-25, -12.3, 12, 2.6, 2.6, 'container');
sym(-27, -13.6, 6, 2.6, 2.6, 'container', 2.6);
sym(20, -22, 2.6, 12, 2.6, 'container');
sym(20, -20, 2.6, 6, 2.6, 'container', 2.6);
sym(30, 4, 12, 2.6, 2.6, 'container');

// صناديق
sym(-15, -25, 1.5, 1.5, 1.5, 'crate');
sym(-16.6, -25, 1.5, 1.5, 1.5, 'crate');
sym(-15.8, -25, 1.5, 1.5, 1.5, 'crate', 1.5);
sym(10, -17, 1.5, 1.5, 1.5, 'crate');
sym(28, -8, 1.5, 1.5, 1.5, 'crate');
sym(-30, -2, 1.5, 1.5, 1.5, 'crate');
sym(45, -15, 1.5, 1.5, 1.5, 'crate');
sym(46.6, -15, 1.5, 1.5, 1.5, 'crate');
sym(-45, -12, 1.5, 1.5, 1.5, 'crate');
sym(-5, -45, 1.5, 1.5, 1.5, 'crate');
sym(22, -45, 1.5, 1.5, 1.5, 'crate');
sym(-20, 2, 1.5, 1.5, 1.5, 'crate');

// سواتر منخفضة (يمكن القفز فوقها)
sym(-20, -38, 8, 0.6, 1.0, 'cover');
sym(15, -48, 0.6, 8, 1.0, 'cover');
sym(40, -5, 6, 0.6, 1.0, 'cover');
sym(-50, -25, 0.6, 8, 1.0, 'cover');
sym(18, -6, 0.6, 6, 1.0, 'cover');
sym(-8, -20, 6, 0.6, 1.0, 'cover');

// جدار يحمي منطقة الانطلاق
sym(0, -46, 16, 0.6, 3, 'concrete');

export const SPAWNS = [[], []];
for (let x = -20; x <= 20; x += 5) {
  SPAWNS[0].push({ x, y: 0, z: -55, yaw: Math.PI });
  SPAWNS[1].push({ x: -x, y: 0, z: 55, yaw: 0 });
}

// ---------- التصادم ----------
const EPS = 0.001;
export function collides(x, y, z, h, r = PLAYER.r) {
  for (const b of BOXES) {
    if (x + r > b.x0 && x - r < b.x1 && y + h > b.y0 && y < b.y1 && z + r > b.z0 && z - r < b.z1) return b;
  }
  return null;
}

// يحرّك اللاعب (p موضع القدمين) مع حل التصادم لكل محور على حدة
export function move(p, dx, dy, dz, h) {
  const r = PLAYER.r;
  let ground = false, head = false, b;
  p.x += dx;
  if ((b = collides(p.x, p.y, p.z, h))) p.x = dx > 0 ? b.x0 - r - EPS : b.x1 + r + EPS;
  p.z += dz;
  if ((b = collides(p.x, p.y, p.z, h))) p.z = dz > 0 ? b.z0 - r - EPS : b.z1 + r + EPS;
  p.y += dy;
  if ((b = collides(p.x, p.y, p.z, h))) {
    if (dy <= 0) { p.y = b.y1; ground = true; } else { p.y = b.y0 - h - EPS; head = true; }
  }
  if (p.y <= 0) { p.y = 0; ground = true; }
  const lim = WORLD - r;
  p.x = Math.max(-lim, Math.min(lim, p.x));
  p.z = Math.max(-lim, Math.min(lim, p.z));
  return { ground, head };
}

// ---------- الأشعة ----------
function rayBox(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (const [a, lo, hi] of [['x', b.x0, b.x1], ['y', b.y0, b.y1], ['z', b.z0, b.z1]]) {
    const dd = d[a], oo = o[a];
    if (Math.abs(dd) < 1e-9) {
      if (oo < lo || oo > hi) return Infinity;
    } else {
      let ta = (lo - oo) / dd, tb = (hi - oo) / dd;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return Infinity;
    }
  }
  return t0;
}

// أقرب مسافة يصطدم عندها الشعاع بالخريطة (أو max إن لم يصطدم)
export function rayBoxes(o, d, max) {
  let best = max;
  if (d.y < -1e-9) { const t = -o.y / d.y; if (t >= 0 && t < best) best = t; }
  for (const b of BOXES) { const t = rayBox(o, d, b); if (t < best) best = t; }
  return best;
}

// إصابة لاعب: يعيد {t, head} أو null
export function rayPlayer(o, d, p, crouch) {
  const top = p.y + (crouch ? 1.0 : 1.45);
  const tb = rayBox(o, d, { x0: p.x - 0.38, x1: p.x + 0.38, y0: p.y, y1: top, z0: p.z - 0.38, z1: p.z + 0.38 });
  const th = rayBox(o, d, { x0: p.x - 0.2, x1: p.x + 0.2, y0: top, y1: top + 0.33, z0: p.z - 0.2, z1: p.z + 0.2 });
  if (th < Infinity && th <= tb) return { t: th, head: true };
  if (tb < Infinity) return { t: tb, head: false };
  return null;
}
