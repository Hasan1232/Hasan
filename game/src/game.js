// Simulation: the player's jet, enemy fighters, air defenses, missiles,
// guns, flares and the war's win/lose rules. Units are degrees and seconds.

import { randomPointIn, closestPointIn, countryAt, dist2, WORLD } from './geo.js';
import { sfx } from './audio.js';
import { initFx, updateFx, explode, addFire, sparks, exhaust, damageSmoke, updateTrail } from './fx.js';
import { makeProps } from './scenery.js';

export const SPEED_SCALE = { slow: 0.75, medium: 1, fast: 1.3 };

const P = { min: 0.32, max: 0.95, turn: 1.9, r: 0.28, hp: 100, msl: 6, flr: 8 };
const GUN = { spd: 3.2, life: 0.55, cd: 0.08, dmg: 6, spread: 0.035 };
const MSL = { spd: 1.9, turn: 3.2, life: 6, dmg: 60, range: 6, cone: 0.45, lockTime: 0.7 };
const SAM = { range: 4.5, cd: 7, spd: 1.35, turn: 2.2, life: 7, dmg: 28, hp: 60 };
const EF = { spd: 0.62, turn: 1.5, hp: 30, gunDmg: 3, gunCd: 0.16, mslDmg: 30, mslCd: 8, mslRange: 4.5, sight: 14 };
const GROUND = {
  sam: { hp: SAM.hp, r: 0.3, score: 150 },
  radar: { hp: 40, r: 0.3, score: 120 },
  airbase: { hp: 150, r: 0.5, score: 250 },
};

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const d = (a, b) => Math.sqrt(dist2(a.x, a.y, b.x, b.y));

export function createWar(world, homeCode, enemyCode, carry = {}) {
  const home = world.byCode.get(homeCode);
  const enemy = world.byCode.get(enemyCode);
  const front = closestPointIn(enemy, home.label.x, home.label.y, 160);

  // Home base: inside our country, about 7 degrees back from the front line.
  let base = null, bestErr = Infinity;
  for (let i = 0; i < 220; i++) {
    const p = randomPointIn(home);
    const err = Math.abs(d(p, front) - 7);
    if (err < bestErr) { bestErr = err; base = p; }
  }

  const s = {
    world, home, enemy, front,
    conquered: new Set(carry.conquered || []),
    score: carry.score || 0,
    lives: 3,
    time: 0,
    phase: 'play', endT: 0,
    base: { x: base.x, y: base.y },
    player: null,
    air: [], ground: [], bullets: [], missiles: [], flares: [], falling: [], timers: [],
    msgs: [],
    warn: { missile: false, radar: false },
    over: null, overT: 0,
    repairing: false,
    spawnT: 0,
  };

  initFx(s);
  s.baseProps = makeProps('airbase', base.x, base.y);
  placeEnemyAssets(s);
  for (let i = 0; i < 2; i++) {
    const p = scatterNear(home, s.base, 3.5, 1.2);
    s.ground.push(makeGround('sam', 'friend', p));
  }
  s.totalTargets = s.ground.filter(g => g.side === 'enemy').length;
  spawnPlayer(s);
  for (const g of s.ground) if (g.kind === 'airbase' && g.side === 'enemy') spawnFighter(s, g);
  return s;
}

function placeEnemyAssets(s) {
  const { enemy, front, base } = s;
  const size = Math.sqrt(enemy.area);
  const nSam = clamp(Math.round(2 + size * 0.5), 3, 7);
  const nBase = enemy.area > 400 ? 3 : enemy.area > 30 ? 2 : 1;
  const nRadar = enemy.area > 10 ? 2 : 1;

  // Candidate points near the front, away from our base.
  let pts = [];
  for (let i = 0; i < 400; i++) pts.push(randomPointIn(enemy));
  pts = pts.filter(p => d(p, front) < 22);
  const far = pts.filter(p => d(p, base) > 5);
  if (far.length >= nSam + nBase + nRadar) pts = far;
  pts.sort(() => Math.random() - 0.5);

  const chosen = [];
  const take = minGap => {
    for (const p of pts) {
      if (chosen.every(c => d(c, p) >= minGap)) { chosen.push(p); return p; }
    }
    return null;
  };
  const pick = () => take(1.4) || take(0.6) || take(0) || randomPointIn(enemy);
  // Air bases sit deeper; SAMs cover the front.
  pts.sort((a, b) => d(b, front) - d(a, front));
  for (let i = 0; i < nBase; i++) s.ground.push(makeGround('airbase', 'enemy', pick()));
  pts.sort(() => Math.random() - 0.5);
  for (let i = 0; i < nRadar; i++) s.ground.push(makeGround('radar', 'enemy', pick()));
  pts.sort((a, b) => d(a, front) - d(b, front) + (Math.random() - 0.5) * 6);
  for (let i = 0; i < nSam; i++) s.ground.push(makeGround('sam', 'enemy', pick()));
}

function scatterNear(c, center, radius, minGap) {
  for (let i = 0; i < 80; i++) {
    const p = randomPointIn(c);
    const dd = d(p, center);
    if (dd < radius && dd > minGap) return p;
  }
  return { x: center.x + (Math.random() - 0.5) * 2, y: center.y + (Math.random() - 0.5) * 2 };
}

function makeGround(kind, side, p) {
  const k = GROUND[kind];
  return { kind, side, x: p.x, y: p.y, hp: k.hp, max: k.hp, r: k.r, cd: 2 + Math.random() * 3, spawnCd: 18, alive: true, rot: Math.random() * 6, props: makeProps(kind, p.x, p.y) };
}

function spawnPlayer(s) {
  const h = Math.atan2(s.front.y - s.base.y, s.front.x - s.base.x);
  s.player = {
    side: 'friend', x: s.base.x, y: s.base.y, h, spd: 0.5, thr: 0.5,
    hp: P.hp, msl: P.msl, flr: P.flr, r: P.r,
    gunCd: 0, mslCd: 0, flrCd: 0, lock: null, lockT: 0, locked: false,
    alive: true, hitT: 0, invuln: 2,
  };
}

function spawnFighter(s, ab) {
  s.air.push({
    side: 'enemy', kind: 'fighter', x: ab.x, y: ab.y, h: Math.random() * 6.28,
    spd: EF.spd, hp: EF.hp, r: 0.26, gunCd: 1, mslCd: 4 + Math.random() * 4, msl: 2,
    home: ab, alive: true, orbit: Math.random() * 6.28, hitT: 0,
  });
}

// ---------------------------------------------------------------- update

export function update(s, dt, inp) {
  s.time += dt;
  const p = s.player;
  s.warn.missile = false; s.warn.radar = false;

  if (p.alive) updatePlayer(s, p, dt, inp);
  else if (s.phase === 'play') {
    s.respawnT -= dt;
    if (s.respawnT <= 0) spawnPlayer(s);
  }

  for (const f of s.air) if (f.alive) updateFighter(s, f, dt);
  for (const g of s.ground) if (g.alive) updateGround(s, g, dt);
  updateBullets(s, dt);
  updateMissiles(s, dt);
  for (const fl of s.flares) { fl.t += dt; fl.x += fl.vx * dt; fl.y += fl.vy * dt; fl.vx *= 0.97; fl.vy *= 0.97; }
  s.flares = s.flares.filter(f => f.t < 2.2);
  updateFalling(s, dt);
  for (const tm of s.timers) { tm.t -= dt; if (tm.t <= 0) tm.fn(); }
  s.timers = s.timers.filter(tm => tm.t > 0);
  updateFx(s, dt);
  s.air = s.air.filter(f => f.alive);

  // Reinforcements from surviving enemy air bases.
  const bases = s.ground.filter(g => g.alive && g.side === 'enemy' && g.kind === 'airbase');
  const cap = 1 + bases.length * 1.5;
  for (const b of bases) {
    b.spawnCd -= dt;
    if (b.spawnCd <= 0 && s.air.length < cap) { spawnFighter(s, b); b.spawnCd = 22; }
  }

  s.overT -= dt;
  if (s.overT <= 0 && p.alive) { s.over = countryAt(s.world, p.x, p.y); s.overT = 0.4; }

  s.remaining = s.ground.filter(g => g.alive && g.side === 'enemy').length;
  if (s.phase === 'play' && s.remaining === 0) {
    s.phase = 'winning'; s.endT = 1.6; s.score += 1000;
  }
  if (s.phase === 'winning' || s.phase === 'losing') {
    s.endT -= dt;
    if (s.endT <= 0) {
      s.phase = s.phase === 'winning' ? 'won' : 'lost';
      if (s.phase === 'won') s.conquered.add(s.enemy.code);
    }
  }
  s.msgs = s.msgs.filter(m => s.time - m.t < 2.5);
}

function updatePlayer(s, p, dt, inp) {
  p.invuln = Math.max(0, p.invuln - dt);
  p.hitT = Math.max(0, p.hitT - dt);
  if (inp.stick) {
    const diff = wrap(inp.stick.angle - p.h);
    p.h = wrap(p.h + clamp(diff, -P.turn * dt, P.turn * dt));
    const want = 0.2 + 0.8 * inp.stick.mag;
    p.thr += clamp(want - p.thr, -1.2 * dt, 1.2 * dt);
  } else {
    p.h = wrap(p.h + inp.turn * P.turn * (1.1 - 0.25 * p.thr) * dt);
    p.thr = clamp(p.thr + inp.throttle * 0.7 * dt, 0, 1);
  }
  const turning = Math.abs(wrap(p.h - (p.lastH ?? p.h))) / Math.max(dt, 1e-3);
  p.lastH = p.h;
  updateTrail(p, dt, turning > 1.2 || p.thr > 0.9);
  p.smokeT = (p.smokeT || 0) - dt;
  if (p.hp < 50 && p.smokeT <= 0) { p.smokeT = 0.07; damageSmoke(s, p, p.hp / P.hp); }
  const target = P.min + (P.max - P.min) * p.thr;
  p.spd += (target - p.spd) * Math.min(1, dt * 1.5);
  p.x += Math.cos(p.h) * p.spd * dt;
  p.y += Math.sin(p.h) * p.spd * dt;
  if (p.x < WORLD.minX || p.x > WORLD.maxX || p.y < WORLD.minY || p.y > WORLD.maxY) {
    p.x = clamp(p.x, WORLD.minX, WORLD.maxX); p.y = clamp(p.y, WORLD.minY, WORLD.maxY);
    p.h = wrap(p.h + Math.PI * dt * 2);
  }

  // Guns.
  p.gunCd -= dt;
  if (inp.fire && p.gunCd <= 0) {
    p.gunCd = GUN.cd;
    const a = p.h + (Math.random() - 0.5) * GUN.spread * 2;
    const nx = p.x + Math.cos(p.h) * 0.3, ny = p.y + Math.sin(p.h) * 0.3;
    s.bullets.push({ side: 'friend', x: nx, y: ny, vx: Math.cos(a) * (GUN.spd + p.spd), vy: Math.sin(a) * (GUN.spd + p.spd), t: 0, dmg: GUN.dmg });
    sfx.gun();
  }

  // Missile lock: hold the nose on a target.
  let best = null, bestScore = Infinity;
  const consider = t => {
    const dd = d(p, t);
    if (dd > MSL.range) return;
    const ang = Math.abs(wrap(Math.atan2(t.y - p.y, t.x - p.x) - p.h));
    if (ang > MSL.cone) return;
    const sc = ang * 2 + dd / MSL.range + (t.kind === 'fighter' ? -0.3 : 0);
    if (sc < bestScore) { bestScore = sc; best = t; }
  };
  for (const f of s.air) consider(f);
  for (const g of s.ground) if (g.alive && g.side === 'enemy') consider(g);
  if (best && best === p.lock) p.lockT += dt; else { p.lock = best; p.lockT = 0; }
  const wasLocked = p.locked;
  p.locked = !!p.lock && p.lockT >= MSL.lockTime;
  if (p.locked && !wasLocked) sfx.lock();

  p.mslCd -= dt;
  if (inp.missile && p.msl > 0 && p.mslCd <= 0) {
    p.msl--; p.mslCd = 0.5;
    launchMissile(s, p, p.locked ? p.lock : null, MSL.spd, MSL.turn, MSL.life, MSL.dmg);
  }

  p.flrCd -= dt;
  if (inp.flare && p.flr > 0 && p.flrCd <= 0) {
    p.flr--; p.flrCd = 0.6;
    dropFlares(s, p);
  }

  // Repair and rearm over our own base.
  s.repairing = d(p, s.base) < 0.9;
  if (s.repairing) {
    p.hp = Math.min(P.hp, p.hp + 18 * dt);
    p.rearm = p.msl < P.msl || p.flr < P.flr ? (p.rearm || 0) + dt : 0;
    if (p.rearm > 1.2) { p.rearm = 0; if (p.msl < P.msl) p.msl++; if (p.flr < P.flr) p.flr++; }
  }

  // Warnings.
  for (const m of s.missiles) if (m.target === p && m.side === 'enemy') s.warn.missile = true;
  for (const g of s.ground) if (g.alive && g.side === 'enemy' && g.kind === 'sam' && d(g, p) < samRange(s, g)) s.warn.radar = true;
}

function dropFlares(s, src) {
  sfx.flare();
  for (let i = 0; i < 3; i++) {
    const a = src.h + Math.PI + (i - 1) * 0.6;
    s.flares.push({ x: src.x, y: src.y, vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.5, t: 0 });
  }
  // Each missile chasing us may bite on the flares.
  for (const m of s.missiles) {
    if (m.target !== src) continue;
    const chance = m.fromSam ? 0.7 : 0.6;
    if (d(m, src) < 3.5 && Math.random() < chance) m.target = s.flares[s.flares.length - 1 - (Math.random() * 3 | 0)];
  }
}

function launchMissile(s, from, target, spd, turn, life, dmg, fromSam = false) {
  s.missiles.push({
    side: from.side, x: from.x, y: from.y, h: from.h ?? Math.atan2(target.y - from.y, target.x - from.x),
    spd: spd * 0.6, maxSpd: spd + (from.spd || 0), turn, life, t: 0, target, dmg, fromSam, smokeT: 0,
  });
  sfx.missile();
}

function samRange(s, g) {
  const radarUp = s.ground.some(r => r.alive && r.kind === 'radar' && r.side === g.side && d(r, g) < 10);
  return SAM.range * (radarUp ? 1.3 : 1);
}

function updateFighter(s, f, dt) {
  const p = s.player;
  f.hitT = Math.max(0, f.hitT - dt);
  let tx, ty, chasing = false;
  if (p.alive && (d(f, p) < EF.sight || d(p, f.home) < 6)) {
    chasing = true;
    const lead = Math.min(1.2, d(f, p) / 2);
    tx = p.x + Math.cos(p.h) * p.spd * lead;
    ty = p.y + Math.sin(p.h) * p.spd * lead;
  } else {
    f.orbit += dt * 0.25;
    tx = f.home.x + Math.cos(f.orbit) * 2.5;
    ty = f.home.y + Math.sin(f.orbit) * 2.5;
  }
  // Keep fighters from stacking on top of each other.
  for (const o of s.air) if (o !== f && d(o, f) < 0.6) { tx += (f.x - o.x) * 2; ty += (f.y - o.y) * 2; }
  const want = Math.atan2(ty - f.y, tx - f.x);
  const diff = wrap(want - f.h);
  f.h = wrap(f.h + clamp(diff, -EF.turn * dt, EF.turn * dt));
  const spd = EF.spd * (chasing ? 1.1 : 0.8);
  f.x += Math.cos(f.h) * spd * dt;
  f.y += Math.sin(f.h) * spd * dt;
  f.spd = spd;
  updateTrail(f, dt, Math.abs(diff) > 0.4);
  f.smokeT = (f.smokeT || 0) - dt;
  if (f.hp < EF.hp * 0.5 && f.smokeT <= 0) { f.smokeT = 0.08; damageSmoke(s, f, f.hp / EF.hp); }

  if (!chasing) return;
  const dist = d(f, p);
  const aim = Math.abs(wrap(Math.atan2(p.y - f.y, p.x - f.x) - f.h));
  f.gunCd -= dt;
  if (dist < 1.6 && aim < 0.15 && f.gunCd <= 0) {
    f.gunCd = EF.gunCd;
    const a = f.h + (Math.random() - 0.5) * 0.12;
    s.bullets.push({ side: 'enemy', x: f.x, y: f.y, vx: Math.cos(a) * GUN.spd, vy: Math.sin(a) * GUN.spd, t: 0, dmg: EF.gunDmg });
  }
  f.mslCd -= dt;
  if (f.msl > 0 && dist < EF.mslRange && dist > 1 && aim < 0.35 && f.mslCd <= 0) {
    f.msl--; f.mslCd = EF.mslCd;
    launchMissile(s, f, p, MSL.spd * 0.85, MSL.turn * 0.8, 5, EF.mslDmg);
  }
}

function updateGround(s, g, dt) {
  g.rot += dt * (g.kind === 'radar' ? 1.5 : 0);
  g.hitT = Math.max(0, (g.hitT || 0) - dt);
  if (g.kind !== 'sam') return;
  g.cd -= dt;
  if (g.cd > 0) return;
  let target = null;
  if (g.side === 'enemy') {
    const p = s.player;
    if (p.alive && p.invuln <= 0 && d(g, p) < samRange(s, g)) target = p;
  } else {
    let bd = SAM.range;
    for (const f of s.air) { const dd = d(f, g); if (dd < bd) { bd = dd; target = f; } }
  }
  if (!target) return;
  g.cd = SAM.cd * (g.side === 'friend' ? 0.8 : 1);
  launchMissile(s, g, target, SAM.spd, SAM.turn, SAM.life, SAM.dmg, true);
}

function updateBullets(s, dt) {
  for (const b of s.bullets) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.side === 'friend') {
      for (const f of s.air) if (d(f, b) < f.r) { sparks(s, b.x, b.y, 4); damage(s, f, b.dmg); b.t = 99; break; }
      if (b.t < 99) for (const g of s.ground) if (g.alive && g.side === 'enemy' && d(g, b) < g.r) { sparks(s, b.x, b.y, 3); damage(s, g, b.dmg); b.t = 99; break; }
    } else if (s.player.alive && d(s.player, b) < s.player.r) {
      sparks(s, b.x, b.y, 3); damage(s, s.player, b.dmg); b.t = 99;
    }
  }
  s.bullets = s.bullets.filter(b => b.t < GUN.life);
}

function updateMissiles(s, dt) {
  for (const m of s.missiles) {
    m.t += dt;
    m.spd = Math.min(m.maxSpd, m.spd + dt * 2);
    const tg = m.target;
    const tgAlive = tg && (tg.alive !== false) && (tg.t === undefined || tg.t < 2.2);
    if (tgAlive) {
      const lead = d(m, tg) / Math.max(0.5, m.spd) * 0.5;
      const tx = tg.x + Math.cos(tg.h || 0) * (tg.spd || 0) * lead;
      const ty = tg.y + Math.sin(tg.h || 0) * (tg.spd || 0) * lead;
      const diff = wrap(Math.atan2(ty - m.y, tx - m.x) - m.h);
      m.h = wrap(m.h + clamp(diff, -m.turn * dt, m.turn * dt));
    }
    m.x += Math.cos(m.h) * m.spd * dt;
    m.y += Math.sin(m.h) * m.spd * dt;
    m.smokeT -= dt;
    if (m.smokeT <= 0) { m.smokeT = 0.03; exhaust(s, m); }

    if (tgAlive && tg.r && d(m, tg) < tg.r + 0.1) { hitByMissile(s, m, tg); continue; }
    if (tgAlive && tg.t !== undefined && d(m, tg) < 0.2) { m.t = 99; boom(s, m.x, m.y, 0.4); continue; }
    if (!tgAlive) {
      // Unguided: hit anything hostile in the way.
      const foes = m.side === 'friend'
        ? [...s.air, ...s.ground.filter(g => g.alive && g.side === 'enemy')]
        : (s.player.alive ? [s.player] : []);
      for (const f of foes) if (d(m, f) < f.r + 0.08) { hitByMissile(s, m, f); break; }
    }
    if (m.t >= m.life && m.t < 99) { boom(s, m.x, m.y, 0.35); m.t = 99; }
  }
  s.missiles = s.missiles.filter(m => m.t < m.life);
}

function hitByMissile(s, m, tg) {
  m.t = 99;
  boom(s, m.x, m.y, 0.5);
  damage(s, tg, m.dmg);
}

function damage(s, u, amount) {
  if (u === s.player) {
    if (u.invuln > 0 || !u.alive) return;
    u.hp -= amount; u.hitT = 0.25; sfx.hit();
    if (u.hp <= 0) {
      u.alive = false; u.hp = 0;
      boom(s, u.x, u.y, 0.9, true);
      startFall(s, u);
      s.lives--;
      if (s.lives <= 0) { s.phase = 'losing'; s.endT = 2; }
      else { s.respawnT = 2.5; s.msgs.push({ key: 'lost', t: s.time, bad: true }); }
    }
    return;
  }
  u.hp -= amount; u.hitT = 0.15;
  if (u.hp <= 0 && u.alive) {
    u.alive = false;
    if (u.kind === 'fighter') { boom(s, u.x, u.y, 0.7, true); startFall(s, u); }
    else destroyGround(s, u);
    s.score += u.kind === 'fighter' ? 100 : GROUND[u.kind].score;
    if (u.side === 'enemy') s.msgs.push({ key: 'destroyed', item: u.kind, t: s.time });
  }
}

function boom(s, x, y, size, loud = false, ground = false) {
  explode(s, x, y, size, ground);
  sfx.boom(loud);
}

// A ground target goes up in stages: the main blast, then its buildings
// and fuel tanks one after another, leaving fires burning.
function destroyGround(s, u) {
  const big = u.kind === 'airbase';
  boom(s, u.x, u.y, big ? 1.5 : 1, true, true);
  addFire(s, u.x, u.y, big ? 0.5 : 0.35, 60);
  (u.props || []).forEach((pr, i) => {
    s.timers.push({ t: 0.25 + i * 0.22 + Math.random() * 0.2, fn: () => {
      pr.dead = true;
      boom(s, pr.x, pr.y, pr.tank ? 1.1 : 0.6, pr.tank, true);
      if (pr.tank || Math.random() < 0.6) addFire(s, pr.x, pr.y, pr.tank ? 0.4 : 0.22, 50);
    } });
  });
}

// Shot-down aircraft spin and fall, trailing fire, then hit the ground.
function startFall(s, a) {
  s.falling.push({ x: a.x, y: a.y, h: a.h, spd: (a.spd || 0.5) * 0.7, side: a.side, t: 0, life: 1.4, spin: (Math.random() < 0.5 ? -1 : 1) * 5, smokeT: 0 });
}

function updateFalling(s, dt) {
  for (const f of s.falling) {
    f.t += dt;
    f.h += f.spin * dt;
    f.x += Math.cos(f.h) * f.spd * dt * 0.5;
    f.y += Math.sin(f.h) * f.spd * dt * 0.5;
    f.smokeT -= dt;
    if (f.smokeT <= 0) { f.smokeT = 0.04; damageSmoke(s, f, 0); }
    if (f.t >= f.life) boom(s, f.x, f.y, 0.8, false, true);
  }
  s.falling = s.falling.filter(f => f.t < f.life);
}

// Nearest countries to `code` (by label distance), for the enemy picker.
export function nearbyCountries(world, code, n = 8, exclude = new Set()) {
  const c = world.byCode.get(code);
  return world.countries
    .filter(k => k.code !== code && k.code !== 'AQ' && !exclude.has(k.code) && k.area > 0.05)
    .map(k => ({ k, dd: Math.sqrt(dist2(k.label.x, k.label.y, c.label.x, c.label.y)) }))
    .sort((a, b) => a.dd - b.dd)
    .slice(0, n)
    .map(o => o.k);
}
