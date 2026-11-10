// Canvas drawing: map, units, effects, minimap, lock box, off-screen arrows.

import { WORLD } from './geo.js';
import { countryName, t, isRtl } from './i18n.js';
import { drawCityGround, drawBuildings, drawCityLabels } from './scenery.js';
import { initSprites, drawDecals, drawTrails, drawParticles, glowAt } from './fx.js';

const C = {
  ocean: '#0a2130', grid: 'rgba(120,170,200,0.08)', land: [42, 58, 44], border: 'rgba(170,200,160,0.35)',
  home: '#2f6aa3', enemy: '#9a3434', conquered: '#2f7a55',
  friend: '#7cc4ff', foe: '#ff5a4f', text: 'rgba(230,240,230,0.8)',
};

export const cam = { x: 0, y: 0, zoom: 30 };
const ZOOMS = [14, 20, 30, 44, 62, 85];
let zoomIdx = 3;

export function changeZoom(dir) {
  zoomIdx = Math.max(0, Math.min(ZOOMS.length - 1, zoomIdx + dir));
}

let canvas, g, W = 0, H = 0, dpr = 1;
let worldBmp = null, worldBmpKey = '';
const BMP_SCALE = 4;
const clouds = Array.from({ length: 140 }, () => ({
  x: -180 + Math.random() * 360, y: -80 + Math.random() * 160, r: 0.6 + Math.random() * 1.8, a: 0.04 + Math.random() * 0.07,
}));

export function setupCanvas(el) {
  canvas = el; g = el.getContext('2d');
  initSprites();
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  };
  addEventListener('resize', resize);
  resize();
}

function landColor(c, roles) {
  if (roles.home === c.code) return C.home;
  if (roles.enemy === c.code) return C.enemy;
  if (roles.conquered && roles.conquered.has(c.code)) return C.conquered;
  const v = (c.hue - 0.5) * 16;
  return `rgb(${C.land[0] + v | 0},${C.land[1] + v * 1.2 | 0},${C.land[2] + v * 0.6 | 0})`;
}

// Whole-world bitmap for the menu backdrop and the minimap.
function getWorldBitmap(world, roles) {
  const key = [roles.home, roles.enemy, [...(roles.conquered || [])].join()].join('|');
  if (worldBmp && worldBmpKey === key) return worldBmp;
  const cw = 360 * BMP_SCALE, ch = (WORLD.maxY - WORLD.minY) * BMP_SCALE;
  const bmp = worldBmp || document.createElement('canvas');
  bmp.width = cw; bmp.height = ch;
  const b = bmp.getContext('2d');
  b.fillStyle = C.ocean; b.fillRect(0, 0, cw, ch);
  b.setTransform(BMP_SCALE, 0, 0, BMP_SCALE, 180 * BMP_SCALE, -WORLD.minY * BMP_SCALE);
  b.lineWidth = 0.6 / BMP_SCALE; b.strokeStyle = C.border;
  for (const c of world.countries) {
    b.fillStyle = landColor(c, roles);
    for (const r of c.rings) { b.fill(r.path); b.stroke(r.path); }
  }
  worldBmp = bmp; worldBmpKey = key;
  return bmp;
}

// Slow-panning world map behind the menus.
export function drawMenuBackdrop(world, roles, time) {
  const bmp = getWorldBitmap(world, roles);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scale = Math.max(W / bmp.width, H / bmp.height) * 1.15;
  const sw = bmp.width * scale, sh = bmp.height * scale;
  const ox = -((time * 12) % (sw - W > 0 ? sw - W : 1));
  g.drawImage(bmp, ox, (H - sh) / 2, sw, sh);
  g.fillStyle = 'rgba(4,12,20,0.35)';
  g.fillRect(0, 0, W, H);
}

export function draw(s, time) {
  const p = s.player;
  const targetZoom = ZOOMS[zoomIdx] * Math.min(1.3, Math.max(0.7, Math.min(W, H) / 520));
  cam.zoom += (targetZoom - cam.zoom) * 0.08;
  // Look ahead in the direction of flight.
  const ahead = 2.2 * (p.alive ? p.spd / 0.6 : 0);
  const tx = p.x + Math.cos(p.h) * ahead, ty = p.y + Math.sin(p.h) * ahead;
  cam.x += (tx - cam.x) * 0.08; cam.y += (ty - cam.y) * 0.08;
  if (!cam.ready) { cam.x = tx; cam.y = ty; cam.ready = true; }

  const z = cam.zoom;
  const shake = (s.shake || 0) / z;
  const camX = cam.x + (Math.random() - 0.5) * shake, camY = cam.y + (Math.random() - 0.5) * shake;
  const view = { minX: cam.x - W / 2 / z, maxX: cam.x + W / 2 / z, minY: cam.y - H / 2 / z, maxY: cam.y + H / 2 / z };
  const roles = { home: s.home.code, enemy: s.enemy.code, conquered: s.conquered };

  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = C.ocean; g.fillRect(0, 0, W, H);
  const toWorld = () => g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - camX * z), dpr * (H / 2 - camY * z));
  toWorld();

  // Graticule for a sense of speed over open sea.
  g.lineWidth = 1 / z; g.strokeStyle = C.grid; g.beginPath();
  for (let x = Math.floor(view.minX); x <= view.maxX; x++) { g.moveTo(x, view.minY); g.lineTo(x, view.maxY); }
  for (let y = Math.floor(view.minY); y <= view.maxY; y++) { g.moveTo(view.minX, y); g.lineTo(view.maxX, y); }
  g.stroke();

  // Countries.
  g.lineWidth = 1.2 / z; g.strokeStyle = C.border;
  const visible = [];
  for (const c of s.world.countries) {
    if (c.maxX < view.minX || c.minX > view.maxX || c.maxY < view.minY || c.minY > view.maxY) continue;
    visible.push(c);
    g.fillStyle = landColor(c, roles);
    for (const r of c.rings) {
      if (r.maxX < view.minX || r.minX > view.maxX || r.maxY < view.minY || r.minY > view.maxY) continue;
      g.fill(r.path); g.stroke(r.path);
    }
  }
  // Front-line glow on the enemy border.
  g.save();
  g.strokeStyle = 'rgba(255,90,70,0.55)'; g.lineWidth = 3 / z; g.setLineDash([6 / z, 5 / z]);
  for (const r of s.enemy.rings) if (!(r.maxX < view.minX || r.minX > view.maxX || r.maxY < view.minY || r.minY > view.maxY)) g.stroke(r.path);
  g.restore();

  // Cities, scorch marks, then every building in fake 3D.
  const cities = s.cities ? drawCityGround(g, s.cities, view, z) : [];
  drawDecals(g, s);
  drawBase(s.base, z, time, s.repairing);
  for (const u of s.ground) if (!u.alive) drawWreck(u);
  const items = [];
  for (const c of cities) for (const b of c.buildings) {
    if (b.x < view.minX - 0.5 || b.x > view.maxX + 0.5 || b.y < view.minY - 0.5 || b.y > view.maxY + 0.5) continue;
    items.push(b);
  }
  const addProps = list => { for (const pr of list || []) if (Math.abs(pr.x - cam.x) < W / z && Math.abs(pr.y - cam.y) < H / z) items.push(pr); };
  addProps(s.baseProps);
  for (const u of s.ground) addProps(u.props);
  drawBuildings(g, items, { x: camX, y: camY }, z, false);

  // SAM range rings near the player.
  for (const u of s.ground) {
    if (!u.alive || u.kind !== 'sam') continue;
    const range = u.side === 'enemy' ? samRangeView(s, u) : 4.5;
    if (Math.abs(u.x - cam.x) > range + W / z || Math.abs(u.y - cam.y) > range + H / z) continue;
    g.beginPath(); g.arc(u.x, u.y, range, 0, 6.283);
    g.fillStyle = u.side === 'enemy' ? 'rgba(255,70,60,0.05)' : 'rgba(80,160,255,0.04)';
    g.strokeStyle = u.side === 'enemy' ? 'rgba(255,90,70,0.35)' : 'rgba(110,180,255,0.25)';
    g.lineWidth = 1.5 / z; g.setLineDash([8 / z, 8 / z]);
    g.fill(); g.stroke(); g.setLineDash([]);
  }
  for (const u of s.ground) if (u.alive) drawGround(u, z, time);

  // Contrails, then shadows, then aircraft.
  drawTrails(g, s, z);
  const air = s.air.filter(a => a.alive);
  for (const a of air) drawJet(a, z, true);
  if (p.alive) drawJet(p, z, true);
  for (const f of s.falling) drawJet({ ...f, thr: 0 }, z, true, 1 - f.t / f.life);
  for (const f of s.falling) drawJet({ ...f, thr: 0, hitT: 0 }, z, false, 1 - f.t / f.life * 0.5);
  for (const a of air) drawJet(a, z, false);
  if (p.alive) drawJet(p, z, false);

  for (const m of s.missiles) {
    g.save(); g.translate(m.x, m.y); g.rotate(m.h);
    g.fillStyle = '#e8e8e8'; g.fillRect(-0.12, -0.022, 0.2, 0.044);
    g.fillStyle = m.side === 'enemy' ? '#c0392b' : '#4a6a8a'; g.fillRect(0.06, -0.022, 0.03, 0.044);
    g.restore();
    glowAt(g, m.x - Math.cos(m.h) * 0.14, m.y - Math.sin(m.h) * 0.14, 0.14 + Math.random() * 0.06, 'fire');
  }
  for (const f of s.flares) {
    const k = f.t / 2.2;
    glowAt(g, f.x, f.y, 0.35 * (1 - k * 0.5) * (0.85 + Math.random() * 0.3), 'glow', 1 - k);
  }

  // Glowing tracers.
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (const b of s.bullets) {
    g.strokeStyle = b.side === 'friend' ? 'rgba(255,220,120,0.95)' : 'rgba(255,120,90,0.95)';
    g.lineWidth = 2.4 / z;
    g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * 0.035, b.y - b.vy * 0.035); g.stroke();
    g.strokeStyle = b.side === 'friend' ? 'rgba(255,200,80,0.25)' : 'rgba(255,90,60,0.25)';
    g.lineWidth = 6 / z; g.stroke();
  }
  g.globalCompositeOperation = 'source-over';

  drawParticles(g, s, z);

  // Clouds drift above everything.
  for (const c of clouds) {
    const cx = c.x + time * 0.05;
    const x = ((cx + 180) % 360 + 360) % 360 - 180;
    if (x < view.minX - 3 || x > view.maxX + 3 || c.y < view.minY - 3 || c.y > view.maxY + 3) continue;
    g.fillStyle = `rgba(235,240,245,${c.a})`;
    g.beginPath(); g.arc(x, c.y, c.r, 0, 6.283); g.arc(x + c.r * 0.8, c.y + 0.2, c.r * 0.7, 0, 6.283); g.fill();
  }

  // Screen-space overlays.
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawLabels(visible, view, z);
  drawCityLabels(g, cities, { x: camX, y: camY }, z, W, H);
  const toScreen = (x, y) => [W / 2 + (x - cam.x) * z, H / 2 + (y - cam.y) * z];
  if (p.alive && p.lock) drawLockBox(p, toScreen, time);
  drawArrows(s, toScreen);
  drawMinimap(s, roles);
  if (p.alive && p.hitT > 0) { g.fillStyle = `rgba(255,40,30,${p.hitT})`; g.fillRect(0, 0, W, H); }
  if (s.warn.missile && Math.sin(time * 18) > 0) {
    g.strokeStyle = 'rgba(255,60,40,0.7)'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
  }
}

function samRangeView(s, u) {
  const radarUp = s.ground.some(r => r.alive && r.kind === 'radar' && r.side === u.side && Math.hypot(r.x - u.x, r.y - u.y) < 10);
  return 4.5 * (radarUp ? 1.3 : 1);
}

function drawJet(a, z, shadow, scale = 1) {
  const L = 0.62 * scale; // length in degrees
  g.save();
  g.translate(a.x + (shadow ? 0.25 : 0), a.y + (shadow ? 0.35 : 0));
  g.rotate(a.h);
  g.scale(L, L);
  g.beginPath();
  // Original delta-wing silhouette, nose pointing +x.
  g.moveTo(0.55, 0);
  g.lineTo(0.22, -0.07); g.lineTo(0.02, -0.08); g.lineTo(-0.18, -0.46); g.lineTo(-0.3, -0.46);
  g.lineTo(-0.24, -0.1); g.lineTo(-0.4, -0.1); g.lineTo(-0.5, -0.24); g.lineTo(-0.56, -0.24);
  g.lineTo(-0.5, 0);
  g.lineTo(-0.56, 0.24); g.lineTo(-0.5, 0.24); g.lineTo(-0.4, 0.1); g.lineTo(-0.24, 0.1);
  g.lineTo(-0.3, 0.46); g.lineTo(-0.18, 0.46); g.lineTo(0.02, 0.08); g.lineTo(0.22, 0.07);
  g.closePath();
  if (shadow) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); g.restore(); return; }
  const friend = a.side === 'friend';
  g.fillStyle = a.hitT > 0 ? '#ffffff' : friend ? '#c9d8e6' : '#b9a39e';
  g.fill();
  g.lineWidth = 1.2 / (z * L); g.strokeStyle = friend ? '#1d3f63' : '#5a1f1a'; g.stroke();
  g.fillStyle = friend ? C.friend : C.foe;
  g.fillRect(-0.28, -0.03, 0.42, 0.06);
  g.fillStyle = '#203040';
  g.beginPath(); g.ellipse(0.25, 0, 0.09, 0.035, 0, 0, 6.283); g.fill();
  // Afterburner.
  const thr = a.thr ?? 0.6;
  g.fillStyle = `rgba(255,${150 + Math.random() * 80 | 0},60,0.9)`;
  g.beginPath(); g.moveTo(-0.5, -0.04); g.lineTo(-0.5 - 0.15 - thr * 0.25 * (0.8 + Math.random() * 0.4), 0); g.lineTo(-0.5, 0.04); g.fill();
  g.restore();
}

function drawGround(u, z, time) {
  const enemy = u.side === 'enemy';
  const col = enemy ? C.foe : C.friend;
  g.save(); g.translate(u.x, u.y);
  const k = 1 / z;
  if (u.kind === 'airbase') {
    g.rotate(0.5);
    g.fillStyle = '#3a3f44'; g.fillRect(-0.55, -0.08, 1.1, 0.16);
    g.strokeStyle = '#d8d8d8'; g.lineWidth = 1 * k; g.setLineDash([4 * k, 4 * k]);
    g.beginPath(); g.moveTo(-0.5, 0); g.lineTo(0.5, 0); g.stroke(); g.setLineDash([]);
    g.fillStyle = col; g.fillRect(-0.2, 0.12, 0.4, 0.14);
  } else if (u.kind === 'sam') {
    g.fillStyle = '#2b3530'; g.beginPath(); g.arc(0, 0, 0.2, 0, 6.283); g.fill();
    g.strokeStyle = col; g.lineWidth = 2 * k; g.stroke();
    g.rotate(-0.8);
    g.fillStyle = col;
    for (const o of [-0.07, 0.07]) g.fillRect(-0.04, o - 0.025, 0.24, 0.05);
  } else if (u.kind === 'radar') {
    g.fillStyle = '#2b3530'; g.beginPath(); g.arc(0, 0, 0.16, 0, 6.283); g.fill();
    g.rotate(u.rot);
    g.strokeStyle = col; g.lineWidth = 3 * k;
    g.beginPath(); g.arc(0, 0, 0.18, -0.9, 0.9); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0.18, 0); g.stroke();
  }
  g.restore();
  // Health bar once damaged.
  if (u.hp < u.max) {
    const w = 0.6;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(u.x - w / 2, u.y - u.r - 0.2, w, 0.07);
    g.fillStyle = col; g.fillRect(u.x - w / 2, u.y - u.r - 0.2, w * Math.max(0, u.hp / u.max), 0.07);
  }
  if (u.hitT > 0) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(u.x, u.y, u.r, 0, 6.283); g.fill(); }
}

function drawWreck(u) {
  g.fillStyle = 'rgba(20,20,20,0.7)';
  g.beginPath(); g.arc(u.x, u.y, u.r * 0.8, 0, 6.283); g.fill();
}

function drawBase(b, z, time, active) {
  g.save(); g.translate(b.x, b.y);
  g.strokeStyle = active ? 'rgba(120,255,160,0.9)' : 'rgba(120,200,255,0.6)';
  g.lineWidth = 2 / z; g.setLineDash([5 / z, 5 / z]); g.lineDashOffset = -time * 4 / z;
  g.beginPath(); g.arc(0, 0, 0.9, 0, 6.283); g.stroke(); g.setLineDash([]);
  g.rotate(-0.4);
  g.fillStyle = '#3a3f44'; g.fillRect(-0.6, -0.09, 1.2, 0.18);
  g.fillStyle = C.friend; g.fillRect(-0.15, 0.14, 0.3, 0.14);
  g.restore();
}

function drawLabels(list, view, z) {
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.direction = isRtl() ? 'rtl' : 'ltr';
  for (const c of list) {
    const size = Math.sqrt(c.area) * z * 0.18;
    if (size < 9) continue;
    const fs = Math.min(26, size);
    const x = W / 2 + (c.label.x - cam.x) * z, y = H / 2 + (c.label.y - cam.y) * z;
    if (x < -100 || x > W + 100 || y < -20 || y > H + 20) continue;
    g.font = `600 ${fs | 0}px system-ui, sans-serif`;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText(countryName(c.code), x + 1, y + 1);
    g.fillStyle = C.text; g.fillText(countryName(c.code), x, y);
  }
}

function drawLockBox(p, toScreen, time) {
  const [x, y] = toScreen(p.lock.x, p.lock.y);
  const r = p.locked ? 22 : 30 - Math.min(1, p.lockT / 0.7) * 8;
  g.strokeStyle = p.locked ? '#ff4040' : 'rgba(255,220,120,0.9)';
  g.lineWidth = 2;
  const c = 8;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    g.beginPath();
    g.moveTo(x + sx * r, y + sy * (r - c)); g.lineTo(x + sx * r, y + sy * r); g.lineTo(x + sx * (r - c), y + sy * r);
    g.stroke();
  }
  if (p.locked) {
    g.font = '700 12px system-ui, sans-serif'; g.fillStyle = '#ff5050'; g.textAlign = 'center';
    g.fillText(t('lock'), x, y - r - 9);
  }
}

// Arrows at the screen edge toward the nearest target, our base and incoming missiles.
function drawArrows(s, toScreen) {
  const p = s.player;
  if (!p.alive) return;
  const items = [];
  let nearest = null, nd = Infinity;
  for (const u of s.ground) if (u.alive && u.side === 'enemy') {
    const dd = Math.hypot(u.x - p.x, u.y - p.y);
    if (dd < nd) { nd = dd; nearest = u; }
  }
  if (nearest) items.push({ u: nearest, col: '#ff5a4f', label: Math.round(nd * 111) + ' km' });
  const bd = Math.hypot(s.base.x - p.x, s.base.y - p.y);
  if (bd > 1.5) items.push({ u: s.base, col: '#7cc4ff', label: t('base') + ' ' + Math.round(bd * 111) + ' km' });
  for (const m of s.missiles) if (m.target === p && m.side === 'enemy') items.push({ u: m, col: '#ffb030', label: '' });

  const pad = 34;
  g.font = '600 11px system-ui, sans-serif';
  for (const it of items) {
    const [x, y] = toScreen(it.u.x, it.u.y);
    if (x > pad && x < W - pad && y > pad + 40 && y < H - pad) continue;
    const a = Math.atan2(y - H / 2, x - W / 2);
    const k = Math.min((W / 2 - pad) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - pad - 20) / Math.abs(Math.sin(a) || 1e-6));
    const ax = W / 2 + Math.cos(a) * k, ay = H / 2 + Math.sin(a) * k + 10;
    g.save(); g.translate(ax, ay); g.rotate(a);
    g.fillStyle = it.col;
    g.beginPath(); g.moveTo(14, 0); g.lineTo(-6, -9); g.lineTo(-2, 0); g.lineTo(-6, 9); g.closePath(); g.fill();
    g.restore();
    if (it.label) {
      g.fillStyle = it.col; g.textAlign = 'center'; g.direction = isRtl() ? 'rtl' : 'ltr';
      g.fillText(it.label, ax - Math.cos(a) * 26, ay - Math.sin(a) * 18);
    }
  }
}

function drawMinimap(s, roles) {
  const bmp = getWorldBitmap(s.world, roles);
  const size = Math.round(Math.min(150, Math.max(96, W * 0.24)));
  const span = 30; // degrees across
  const x0 = isRtl() ? 10 : W - size - 10, y0 = 58;
  const p = s.player;
  const cx = p.alive ? p.x : cam.x, cy = p.alive ? p.y : cam.y;
  g.save();
  g.beginPath(); g.rect(x0, y0, size, size); g.clip();
  g.fillStyle = C.ocean; g.fillRect(x0, y0, size, size);
  const sx = (cx - span / 2 + 180) * BMP_SCALE, sy = (cy - span / 2 - WORLD.minY) * BMP_SCALE;
  g.drawImage(bmp, sx, sy, span * BMP_SCALE, span * BMP_SCALE, x0, y0, size, size);
  const m = (wx, wy) => [x0 + (wx - cx + span / 2) / span * size, y0 + (wy - cy + span / 2) / span * size];
  for (const u of s.ground) {
    if (!u.alive) continue;
    const [px, py] = m(u.x, u.y);
    g.fillStyle = u.side === 'enemy' ? '#ff5a4f' : '#7cc4ff';
    g.fillRect(px - 2, py - 2, 4, 4);
  }
  for (const f of s.air) { const [px, py] = m(f.x, f.y); g.fillStyle = '#ffb0a0'; g.beginPath(); g.arc(px, py, 2, 0, 6.283); g.fill(); }
  const [bx, by] = m(s.base.x, s.base.y);
  g.strokeStyle = '#7cc4ff'; g.lineWidth = 1.5; g.strokeRect(bx - 4, by - 4, 8, 8);
  if (p.alive) {
    const [px, py] = m(p.x, p.y);
    g.save(); g.translate(px, py); g.rotate(p.h);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -4); g.lineTo(-4, 4); g.fill();
    g.restore();
  }
  g.restore();
  g.strokeStyle = 'rgba(200,220,240,0.5)'; g.lineWidth = 1; g.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1);
}
