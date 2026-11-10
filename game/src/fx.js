// Visual effects: layered explosions (flash, fireball, smoke, debris,
// shockwave), lasting fires and smoke columns, scorch marks, missile
// exhaust, sparks, contrails and camera shake. Particles are drawn from
// pre-rendered sprites so it stays fast on phones.

const MAX_PARTICLES = 1100;
const MAX_DECALS = 160;
const WIND = { x: 0.06, y: -0.03 };

const sprites = {};

function radial(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

// Soft, lumpy smoke built from several offset blobs.
function puff(size, rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.283, r = size * 0.14;
    const x = size / 2 + Math.cos(a) * r * (i % 2 ? 1 : 0.6), y = size / 2 + Math.sin(a) * r * (i % 2 ? 1 : 0.6);
    const gr = g.createRadialGradient(x, y, 0, x, y, size * 0.32);
    gr.addColorStop(0, `rgba(${rgb},0.55)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

export function initSprites() {
  if (sprites.glow) return;
  sprites.glow = radial(64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,240,200,0.6)'], [1, 'rgba(255,200,120,0)']]);
  sprites.fire = radial(64, [[0, 'rgba(255,250,220,1)'], [0.3, 'rgba(255,190,70,0.9)'], [0.65, 'rgba(230,80,20,0.5)'], [1, 'rgba(120,20,0,0)']]);
  sprites.ember = radial(16, [[0, 'rgba(255,240,180,1)'], [1, 'rgba(255,120,30,0)']]);
  sprites.smoke = puff(96, '200,200,205');
  sprites.dark = puff(96, '45,42,40');
  sprites.scorch = radial(64, [[0, 'rgba(15,12,10,0.85)'], [0.6, 'rgba(25,20,15,0.5)'], [1, 'rgba(30,25,20,0)']]);
  sprites.blue = radial(32, [[0, 'rgba(220,240,255,1)'], [0.4, 'rgba(120,190,255,0.6)'], [1, 'rgba(80,150,255,0)']]);
}

const rand = (a, b) => a + Math.random() * (b - a);

function emit(s, p) {
  if (s.particles.length >= MAX_PARTICLES) s.particles.shift();
  p.t = 0;
  s.particles.push(p);
}

export function initFx(s) {
  s.particles = [];
  s.debris = [];
  s.rings = [];
  s.decals = [];
  s.fires = [];
  s.shake = 0;
}

// size ~ 0.3 (missile pop) .. 1.5 (air base going up)
export function explode(s, x, y, size, ground = false) {
  // White-hot flash that lights the area.
  emit(s, { sp: 'glow', x, y, vx: 0, vy: 0, life: 0.18 + size * 0.1, s0: size * 2.2, s1: size * 3, a0: 1, a1: 0, add: true });
  // Fireball: several overlapping, expanding fire blobs.
  const nFire = Math.round(5 + size * 10);
  for (let i = 0; i < nFire; i++) {
    const a = rand(0, 6.283), v = rand(0.05, 0.5) * size;
    emit(s, { sp: 'fire', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.5, life: rand(0.4, 0.9) + size * 0.3, s0: size * rand(0.15, 0.35), s1: size * rand(0.45, 0.8), a0: 1, a1: 0, add: true });
  }
  // Smoke that lingers and drifts with the wind.
  const nSmoke = Math.round(4 + size * 9);
  for (let i = 0; i < nSmoke; i++) {
    const a = rand(0, 6.283), v = rand(0.02, 0.3) * size;
    emit(s, { sp: ground ? 'dark' : 'smoke', x: x + rand(-0.1, 0.1) * size, y: y + rand(-0.1, 0.1) * size, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.2, wind: 1, delay: rand(0.05, 0.3),
      life: rand(1.8, 3.5) + size * 1.5, s0: size * 0.25, s1: size * rand(0.9, 1.5), a0: 0.85, a1: 0 });
  }
  // Embers.
  const nEmber = Math.round(8 + size * 18);
  for (let i = 0; i < nEmber; i++) {
    const a = rand(0, 6.283), v = rand(0.3, 1.4) * size;
    emit(s, { sp: 'ember', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.8, life: rand(0.4, 1.2), s0: 0.05, s1: 0.02, a0: 1, a1: 0, add: true });
  }
  // Debris that arcs up and falls, trailing smoke.
  if (size >= 0.6) {
    const nDeb = Math.round(size * 8);
    for (let i = 0; i < nDeb; i++) {
      const a = rand(0, 6.283), v = rand(0.3, 1.1) * size;
      s.debris.push({ x, y, z: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(0.6, 1.6) * size, rot: rand(0, 6), vr: rand(-8, 8), size: rand(0.03, 0.08) * size, t: 0, trailT: 0 });
    }
  }
  s.rings.push({ x, y, t: 0, life: 0.5 + size * 0.25, r: size * 1.8 });
  if (ground) s.decals.push({ x, y, r: size * 0.9, rot: rand(0, 6) });
  if (s.decals.length > MAX_DECALS) s.decals.shift();
  // Shake the camera when it's close to the player.
  const p = s.player;
  if (p) {
    const dd = Math.hypot(p.x - x, p.y - y);
    s.shake = Math.max(s.shake, size * 10 * Math.max(0, 1 - dd / 6));
  }
}

// A lasting fire with a rising smoke column.
export function addFire(s, x, y, size, duration = 45) {
  s.fires.push({ x, y, size, t: 0, life: duration, fireT: 0, smokeT: 0 });
  if (s.fires.length > 60) s.fires.shift();
}

export function sparks(s, x, y, n = 5) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.283), v = rand(0.4, 1.2);
    emit(s, { sp: 'ember', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: rand(0.15, 0.35), s0: 0.04, s1: 0.015, a0: 1, a1: 0, add: true });
  }
}

export function exhaust(s, m) {
  emit(s, { sp: 'smoke', x: m.x - Math.cos(m.h) * 0.12, y: m.y - Math.sin(m.h) * 0.12, vx: rand(-0.03, 0.03), vy: rand(-0.03, 0.03), wind: 0.4, life: rand(1.2, 1.8), s0: 0.05, s1: rand(0.18, 0.28), a0: 0.6, a1: 0 });
}

// Black smoke (and fire when worse) from a damaged aircraft.
export function damageSmoke(s, a, hpFrac) {
  const fire = hpFrac < 0.3;
  emit(s, { sp: fire ? 'fire' : 'dark', x: a.x - Math.cos(a.h) * 0.25, y: a.y - Math.sin(a.h) * 0.25, vx: 0, vy: 0, wind: 0.6, add: fire,
    life: fire ? 0.35 : 1.4, s0: 0.06, s1: fire ? 0.12 : 0.3, a0: fire ? 0.9 : 0.55, a1: 0 });
  if (fire) emit(s, { sp: 'dark', x: a.x - Math.cos(a.h) * 0.3, y: a.y - Math.sin(a.h) * 0.3, vx: 0, vy: 0, wind: 0.6, life: 1.6, s0: 0.08, s1: 0.35, a0: 0.6, a1: 0 });
}

// Wingtip vapour trails, sampled while the jet turns hard or flies fast.
export function updateTrail(a, dt, active) {
  a.trail = a.trail || [];
  a.trailT = (a.trailT || 0) - dt;
  if (a.trailT <= 0) {
    a.trailT = 0.04;
    const span = 0.17, back = 0.12;
    const cx = a.x - Math.cos(a.h) * back, cy = a.y - Math.sin(a.h) * back;
    const nx = -Math.sin(a.h) * span, ny = Math.cos(a.h) * span;
    a.trail.push({ lx: cx + nx, ly: cy + ny, rx: cx - nx, ry: cy - ny, on: active });
    if (a.trail.length > 22) a.trail.shift();
  }
}

export function updateFx(s, dt) {
  for (const p of s.particles) {
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.t += dt;
    if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
    p.x += (p.vx + (p.wind ? WIND.x * p.wind : 0)) * dt;
    p.y += (p.vy + (p.wind ? WIND.y * p.wind : 0)) * dt;
  }
  s.particles = s.particles.filter(p => p.t < p.life);

  for (const d of s.debris) {
    d.t += dt;
    d.x += d.vx * dt; d.y += d.vy * dt;
    d.vz -= 3 * dt; d.z += d.vz * dt; d.rot += d.vr * dt;
    d.trailT -= dt;
    if (d.z > 0 && d.trailT <= 0) {
      d.trailT = 0.05;
      emit(s, { sp: 'dark', x: d.x, y: d.y - d.z * 0.5, vx: 0, vy: 0, wind: 0.5, life: 0.9, s0: 0.03, s1: 0.12, a0: 0.5, a1: 0 });
    }
    if (d.z < 0) { d.z = 0; d.vx *= 0.3; d.vy *= 0.3; d.vz = 0; d.vr = 0; }
  }
  s.debris = s.debris.filter(d => d.t < 6);

  for (const r of s.rings) r.t += dt;
  s.rings = s.rings.filter(r => r.t < r.life);

  for (const f of s.fires) {
    f.t += dt;
    const k = f.t < f.life * 0.7 ? 1 : Math.max(0, 1 - (f.t - f.life * 0.7) / (f.life * 0.3));
    if (k <= 0) continue;
    f.fireT -= dt; f.smokeT -= dt;
    if (f.fireT <= 0) {
      f.fireT = 0.07 / k;
      emit(s, { sp: 'fire', x: f.x + rand(-0.5, 0.5) * f.size, y: f.y + rand(-0.5, 0.5) * f.size, vx: rand(-0.02, 0.02), vy: rand(-0.06, -0.02), wind: 0.3,
        life: rand(0.4, 0.8), s0: f.size * 0.25 * k, s1: f.size * 0.5 * k, a0: 0.9, a1: 0, add: true });
    }
    if (f.smokeT <= 0) {
      f.smokeT = 0.16 / k;
      emit(s, { sp: 'dark', x: f.x + rand(-0.3, 0.3) * f.size, y: f.y, vx: rand(-0.02, 0.02), vy: -0.05, wind: 1,
        life: rand(3, 5), s0: f.size * 0.3, s1: f.size * rand(1.2, 2), a0: 0.6 * k, a1: 0 });
    }
  }
  s.fires = s.fires.filter(f => f.t < f.life);

  s.shake = Math.max(0, s.shake - dt * 18);
}

// Ground layer: scorch marks.
export function drawDecals(g, s) {
  for (const d of s.decals) g.drawImage(sprites.scorch, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
}

export function drawTrails(g, s, z) {
  const draw = a => {
    const tr = a.trail;
    if (!tr || tr.length < 2) return;
    g.lineWidth = 1.6 / z;
    for (const side of ['l', 'r']) {
      for (let i = 1; i < tr.length; i++) {
        if (!tr[i].on || !tr[i - 1].on) continue;
        g.strokeStyle = `rgba(235,245,255,${(i / tr.length) * 0.45})`;
        g.beginPath();
        g.moveTo(tr[i - 1][side + 'x'], tr[i - 1][side + 'y']);
        g.lineTo(tr[i][side + 'x'], tr[i][side + 'y']);
        g.stroke();
      }
    }
  };
  if (s.player.alive) draw(s.player);
  for (const a of s.air) draw(a);
}

// Air layer: smoke, fire, debris, shockwaves.
export function drawParticles(g, s, z) {
  // Smoke first (normal blending), then additive light on top.
  for (const p of s.particles) {
    if (p.add || p.delay > 0) continue;
    drawP(g, p);
  }
  for (const d of s.debris) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
    g.save();
    g.translate(d.x, d.y - d.z * 0.5);
    g.rotate(d.rot);
    g.fillStyle = d.z > 0 ? '#3a332c' : '#221d18';
    g.fillRect(-d.size / 2, -d.size / 3, d.size, d.size * 0.66);
    g.restore();
  }
  g.globalCompositeOperation = 'lighter';
  for (const p of s.particles) {
    if (!p.add || p.delay > 0) continue;
    drawP(g, p);
  }
  for (const r of s.rings) {
    const k = r.t / r.life;
    g.strokeStyle = `rgba(255,235,200,${0.5 * (1 - k)})`;
    g.lineWidth = (3 * (1 - k) + 0.5) / z;
    g.beginPath(); g.arc(r.x, r.y, r.r * (0.2 + 0.8 * Math.sqrt(k)), 0, 6.283); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

function drawP(g, p) {
  const k = p.t / p.life;
  const e = 1 - (1 - k) * (1 - k);
  const size = p.s0 + (p.s1 - p.s0) * e;
  const a = p.a0 + (p.a1 - p.a0) * k;
  if (a <= 0.01) return;
  g.globalAlpha = a;
  g.drawImage(sprites[p.sp], p.x - size, p.y - size, size * 2, size * 2);
  g.globalAlpha = 1;
}

export function glowAt(g, x, y, r, sprite = 'glow', alpha = 1) {
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = alpha;
  g.drawImage(sprites[sprite], x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}
