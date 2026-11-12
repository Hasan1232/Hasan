// كود مشترك بين الخادم والمتصفح: الجبهات، توليد الخرائط، الأسلحة، التصادم، وإصابة الأشعة.

export const WORLD = 60; // نصف طول الخريطة بالمتر
export const PLAYER = { r: 0.35, h: 1.8, hc: 1.3, eye: 1.62, eyeC: 1.1 };
export const TEAM_NAMES = ['المعارضة', 'النظام'];
export const SCORE_LIMIT = 300;

export const WEAPONS = [
  { name: 'بندقية هجومية AR-7', short: 'AR-7', dmg: 26, head: 2.0, rpm: 600, mag: 30, reload: 2.2, range: 120, spread: 0.014, adsSpread: 0.003, auto: true, recoil: 0.011, zoom: 1.35 },
  { name: 'قناصة SR-90', short: 'SR-90', dmg: 85, head: 2.5, rpm: 45, mag: 5, reload: 3.0, range: 250, spread: 0.06, adsSpread: 0.0004, auto: false, recoil: 0.06, zoom: 4 },
  { name: 'مسدس P-9', short: 'P-9', dmg: 22, head: 1.8, rpm: 380, mag: 12, reload: 1.4, range: 60, spread: 0.016, adsSpread: 0.006, auto: false, recoil: 0.02, zoom: 1.2 },
];

// ---------- الجبهات ----------
// الخرائط مولَّدة بطابع كل مدينة (لون الحجر، كثافة الدمار، معلم المركز) وليست مخططات شوارع حقيقية.
export const FRONTS = [
  { id: 'aleppo', name: 'حلب', lon: 37.16, lat: 36.20, seed: 11, tone: '#b9ad94', damage: 0.45, landmark: 'citadel', lm: 'القلعة', desc: 'أحياء حجرية متراصّة حول القلعة' },
  { id: 'idlib', name: 'إدلب', lon: 36.63, lat: 35.93, seed: 23, tone: '#c4b8a0', damage: 0.3, landmark: 'plaza', lm: 'الدوّار', desc: 'شوارع ضيقة تلتقي عند دوّار المدينة' },
  { id: 'hama', name: 'حماة', lon: 36.75, lat: 35.13, seed: 37, tone: '#c9c0ae', damage: 0.25, landmark: 'plaza', lm: 'الساحة', desc: 'أبنية منخفضة حول الساحة الرئيسية' },
  { id: 'homs', name: 'حمص', lon: 36.72, lat: 34.73, seed: 41, tone: '#8f8c86', damage: 0.5, landmark: 'tower', lm: 'برج الساعة', desc: 'حجر بازلتي داكن وساحة برج الساعة' },
  { id: 'damascus', name: 'دمشق', lon: 36.29, lat: 33.51, seed: 53, tone: '#d0c6b2', damage: 0.2, landmark: 'tower', lm: 'النصب', desc: 'أبنية عالية وشوارع عريضة حول النصب' },
  { id: 'daraa', name: 'درعا', lon: 36.10, lat: 32.62, seed: 67, tone: '#7f7b76', damage: 0.4, landmark: 'plaza', lm: 'الساحة', desc: 'بيوت بازلتية وأحياء مهدّمة' },
  { id: 'deir', name: 'دير الزور', lon: 40.14, lat: 35.33, seed: 71, tone: '#c7b58f', damage: 0.5, landmark: 'tower', lm: 'برج الجسر', desc: 'مدينة على الفرات بلون الطين' },
  { id: 'raqqa', name: 'الرقة', lon: 39.01, lat: 35.95, seed: 83, tone: '#bfae8c', damage: 0.45, landmark: 'plaza', lm: 'الدوّار', desc: 'أحياء مفتوحة ودوّار واسع' },
  { id: 'latakia', name: 'اللاذقية', lon: 35.78, lat: 35.52, seed: 97, tone: '#d6d2c8', damage: 0.15, landmark: 'tower', lm: 'برج المرفأ', desc: 'أبنية ساحلية فاتحة قرب المرفأ' },
  { id: 'tartus', name: 'طرطوس', lon: 35.89, lat: 34.89, seed: 101, tone: '#cfcabb', damage: 0.15, landmark: 'citadel', lm: 'القلعة البحرية', desc: 'مدينة قديمة حول قلعة ساحلية' },
  { id: 'hasakah', name: 'الحسكة', lon: 40.75, lat: 36.50, seed: 113, tone: '#c2b79d', damage: 0.3, landmark: 'plaza', lm: 'الساحة', desc: 'شوارع متعامدة وأبنية منخفضة' },
  { id: 'sweida', name: 'السويداء', lon: 36.57, lat: 32.71, seed: 127, tone: '#6f6c69', damage: 0.2, landmark: 'citadel', lm: 'القلعة', desc: 'حجر بازلتي أسود وقلعة قديمة' },
];
export const frontById = id => FRONTS.find(f => f.id === id);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// يولّد خريطة الجبهة: شبكة أحياء 20م بينها شوارع 6م، متناظرة حول المركز لتكون عادلة للطرفين
export function makeMap(front) {
  const rnd = rng(front.seed), boxes = [];
  const add = (x, z, w, d, h, type, y0 = 0, c = 0) =>
    boxes.push({ x0: x - w / 2, x1: x + w / 2, y0, y1: y0 + h, z0: z - d / 2, z1: z + d / 2, type, c });
  const sym = (x, z, w, d, h, type, y0, c) => { add(x, z, w, d, h, type, y0, c); add(-x, -z, w, d, h, type, y0, c); };
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const odd = () => pick([-3, -1, 1, 3]);

  add(0, -WORLD - 0.5, WORLD * 2 + 2, 1, 5, 'border');
  add(0, WORLD + 0.5, WORLD * 2 + 2, 1, 5, 'border');
  add(-WORLD - 0.5, 0, 1, WORLD * 2 + 2, 5, 'border');
  add(WORLD + 0.5, 0, 1, WORLD * 2 + 2, 5, 'border');

  // معلم المركز
  if (front.landmark === 'citadel') {
    add(0, 0, 10, 10, 8, 'stone');
    sym(-5.5, -5.5, 3, 3, 11, 'stone'); sym(5.5, -5.5, 3, 3, 11, 'stone');
  } else if (front.landmark === 'tower') {
    add(0, 0, 6, 6, 0.9, 'stone'); add(0, 0, 2.6, 2.6, 15, 'stone', 0.9); add(0, 0, 3.4, 3.4, 0.6, 'stone', 15.9);
  } else {
    add(0, 0, 8, 8, 0.8, 'stone'); add(0, 0, 1.6, 1.6, 4.5, 'stone', 0.8);
  }

  // سيارة محترقة أو ساتر أو صناديق في نقطة ما
  const prop = (x, z) => {
    const r = rnd();
    if (r < 0.4) rnd() < 0.5 ? sym(x, z, 4.2, 1.9, 1.4, 'car') : sym(x, z, 1.9, 4.2, 1.4, 'car');
    else if (r < 0.75) rnd() < 0.5 ? sym(x, z, 5, 0.7, 1.0, 'cover') : sym(x, z, 0.7, 5, 1.0, 'cover');
    else { sym(x, z, 1.5, 1.5, 1.5, 'crate'); if (rnd() < 0.5) sym(x + 1.6, z, 1.5, 1.5, 1.5, 'crate'); }
  };
  // جدار فيه فتحة باب بعرض 2م (مركزها عند g) أو بلا فتحة
  const wall = (horizontal, fixed, from, to, g, h) => {
    const seg = (a, b) => {
      if (b - a < 0.2) return;
      horizontal ? sym((a + b) / 2, fixed, b - a, 0.5, h, 'ruin') : sym(fixed, (a + b) / 2, 0.5, b - a, h, 'ruin');
    };
    if (g === null) seg(from, to); else { seg(from, g - 1); seg(g + 1, to); }
  };

  for (const row of [-50, -30, -10]) for (const col of [-50, -30, -10, 10, 30, 50]) {
    if (row === -50) { // صف الانطلاق: مفتوح مع سواتر وجدران حماية
      if (rnd() < 0.7) sym(col + odd(), -47, 6, 0.7, 1.0, 'cover');
      if (rnd() < 0.55) sym(col, -43.5, 10, 0.5, 3.2, 'ruin');
      continue;
    }
    if (row === -10 && Math.abs(col) === 10) { // ساحة المعلم
      for (let i = 0; i < 2; i++) {
        const x = col + (rnd() - 0.5) * 12, z = -6 - rnd() * 10;
        if (Math.hypot(x, z) > 10.5) prop(x, z);
      }
      continue;
    }
    const r = rnd(), c = Math.floor(rnd() * 3);
    if (r < front.damage * 0.75) { // بناء مهدّم: جدران بلا سقف يمكن دخولها
      const h = 3 + rnd() * 1.6, gaps = [0, 1, 2, 3].map(() => (rnd() < 0.75 ? 1 : 0));
      gaps[Math.floor(rnd() * 4)] = 1; gaps[Math.floor(rnd() * 4)] = 1;
      wall(true, row - 6, col - 6, col + 6, gaps[0] ? col + odd() : null, h);
      wall(true, row + 6, col - 6, col + 6, gaps[1] ? col + odd() : null, h * (0.5 + rnd() * 0.5));
      wall(false, col - 6, row - 6, row + 6, gaps[2] ? row + odd() : null, h);
      wall(false, col + 6, row - 6, row + 6, gaps[3] ? row + odd() : null, h * (0.5 + rnd() * 0.5));
      for (let i = 0; i < 2; i++) sym(col + (rnd() - 0.5) * 8, row + (rnd() - 0.5) * 8, 1.1, 1.1, 0.9 + rnd() * 0.3, 'rubble');
    } else if (r < front.damage * 0.75 + 0.14) { // فسحة
      for (let i = 0; i < 3; i++) prop(col + (rnd() - 0.5) * 9, row + (rnd() - 0.5) * 9);
    } else { // بناء سكني بسقف مستوٍ
      const w = 9 + Math.floor(rnd() * 6), d = 9 + Math.floor(rnd() * 6), floors = 2 + Math.floor(rnd() * (front.id === 'damascus' ? 5 : 3));
      const x = col + ((14 - w) / 2) * (rnd() * 2 - 1), z = row + ((14 - d) / 2) * (rnd() * 2 - 1), h = floors * 3;
      sym(x, z, w, d, h, 'building', 0, c);
      sym(x, z, w + 0.3, d + 0.3, 0.35, 'stone', h, 0);                         // حافة السطح
      if (rnd() < 0.5) sym(x + w * 0.15, z - d * 0.15, w * 0.4, d * 0.4, 2.6, 'building', h + 0.35, c); // غرفة السطح
      if (rnd() < front.damage) sym(x + (rnd() < 0.5 ? 1 : -1) * (w / 2 + 0.7), z + (rnd() - 0.5) * d * 0.6, 1.1, 1.1, 1.0, 'rubble');
    }
  }
  // عوائق عند تقاطعات الشوارع
  for (const z of [-40, -20, 0]) for (const x of [-40, -20, 0, 20, 40]) {
    if ((z === 0 && x >= 0) || Math.hypot(x, z) < 12) continue;
    if (rnd() < 0.55) prop(x + pick([-1.6, 1.6]), z + pick([-1.6, 1.6]));
  }

  const spawns = [[], []];
  for (let x = -20; x <= 20; x += 5) {
    spawns[0].push({ x, y: 0, z: -55, yaw: Math.PI });
    spawns[1].push({ x: -x, y: 0, z: 55, yaw: 0 });
  }
  const zones = [
    { n: 'أ', name: 'السوق', x: 40, z: -20, r: 7 },
    { n: 'ب', name: front.lm, x: 0, z: 0, r: front.landmark === 'citadel' ? 12 : 9.5 },
    { n: 'ج', name: 'المحطة', x: -40, z: 20, r: 7 },
  ];
  return { front, boxes, spawns, zones };
}

// ---------- التصادم ----------
const EPS = 0.001;
export function collides(boxes, x, y, z, h, r = PLAYER.r) {
  for (const b of boxes) {
    if (x + r > b.x0 && x - r < b.x1 && y + h > b.y0 && y < b.y1 && z + r > b.z0 && z - r < b.z1) return b;
  }
  return null;
}

// يحرّك اللاعب (p موضع القدمين) مع حل التصادم لكل محور على حدة
export function move(boxes, p, dx, dy, dz, h) {
  const r = PLAYER.r;
  let ground = false, head = false, b;
  p.x += dx;
  if ((b = collides(boxes, p.x, p.y, p.z, h))) p.x = dx > 0 ? b.x0 - r - EPS : b.x1 + r + EPS;
  p.z += dz;
  if ((b = collides(boxes, p.x, p.y, p.z, h))) p.z = dz > 0 ? b.z0 - r - EPS : b.z1 + r + EPS;
  p.y += dy;
  if ((b = collides(boxes, p.x, p.y, p.z, h))) {
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
export function rayBoxes(boxes, o, d, max) {
  let best = max;
  if (d.y < -1e-9) { const t = -o.y / d.y; if (t >= 0 && t < best) best = t; }
  for (const b of boxes) { const t = rayBox(o, d, b); if (t < best) best = t; }
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
