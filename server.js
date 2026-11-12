// خادم اللعبة: يقدّم الملفات ويدير المباراة (الفرق، الضرر، النتيجة، البوتات).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { BOXES, WORLD, WEAPONS, PLAYER, SPAWNS, move, rayBoxes } from './public/shared.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const TEAM_SIZE = 4;          // يكمل الخادم كل فريق ببوتات حتى هذا العدد
const MAX_HUMANS = 16;
const KILL_LIMIT = 40;
const MATCH_MS = 10 * 60 * 1000;
const RESPAWN_MS = 4000;
const TICK_MS = 50;

// ---------- الملفات الثابتة ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.glb': 'model/gltf-binary' };
const MOUNTS = [['/three/', 'node_modules/three/build'], ['/addons/', 'node_modules/three/examples/jsm']];
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const mount = MOUNTS.find(m => url.startsWith(m[0]));
  const base = path.join(ROOT, mount ? mount[1] : 'public');
  const file = path.join(base, mount ? url.slice(mount[0].length) : url);
  if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- حالة المباراة ----------
const players = new Map();
let nextId = 1;
let rosterDirty = false;
const match = { scores: [0, 0], endsAt: Date.now() + MATCH_MS, over: false };

const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
function broadcast(m) {
  const s = JSON.stringify(m);
  for (const p of players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s);
}
const rosterList = () => [...players.values()].map(p => ({ id: p.id, name: p.name, team: p.team, k: p.k, d: p.d, bot: p.bot }));
const count = (team, bot) => [...players.values()].filter(p => p.team === team && p.bot === bot).length;

function spawn(p, now) {
  const list = SPAWNS[p.team];
  const s = list[Math.floor(Math.random() * list.length)];
  Object.assign(p, { x: s.x, y: 0, z: s.z, yaw: s.yaw, pitch: 0, hp: 100, alive: true, crouch: false, protectUntil: now + 2000 });
  if (p.bot) Object.assign(p, { path: [], target: null, ammo: 30, reloadUntil: 0 });
  if (p.ws) send(p.ws, { t: 'spawn', x: p.x, y: p.y, z: p.z, yaw: p.yaw });
}

function makePlayer(name, team, bot, ws) {
  const p = { id: nextId++, name, team, bot, ws, k: 0, d: 0, w: 0, lastHitAt: 0, respawnAt: 0 };
  players.set(p.id, p);
  spawn(p, Date.now());
  rosterDirty = true;
  return p;
}

const BOT_NAMES = ['صقر', 'ذئب', 'نمر', 'عقاب', 'فهد', 'شبح', 'رعد', 'برق', 'ليث', 'سهم', 'نسر', 'جبل'];
function balanceBots() {
  for (const team of [0, 1]) {
    const want = Math.max(0, TEAM_SIZE - count(team, false));
    let have = count(team, true);
    while (have < want) { makePlayer(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], team, true, null); have++; }
    while (have > want) {
      const b = [...players.values()].find(p => p.team === team && p.bot);
      players.delete(b.id); have--; rosterDirty = true;
    }
  }
}

function damage(victim, attacker, amount, w, head, now) {
  if (match.over || !victim.alive || now < victim.protectUntil || victim.team === attacker.team) return;
  victim.hp -= amount;
  if (victim.ws) send(victim.ws, { t: 'dmg', x: attacker.x, z: attacker.z });
  if (victim.hp > 0) return;
  victim.hp = 0; victim.alive = false; victim.d++; victim.respawnAt = now + RESPAWN_MS;
  attacker.k++; match.scores[attacker.team]++;
  broadcast({ t: 'kill', k: attacker.id, v: victim.id, w, h: head ? 1 : 0 });
  rosterDirty = true;
  if (match.scores[attacker.team] >= KILL_LIMIT) endMatch(now);
}

function endMatch(now) {
  if (match.over) return;
  match.over = true;
  const [a, b] = match.scores;
  broadcast({ t: 'end', w: a === b ? -1 : a > b ? 0 : 1 });
  setTimeout(() => {
    const t = Date.now();
    match.scores = [0, 0]; match.endsAt = t + MATCH_MS; match.over = false;
    for (const p of players.values()) { p.k = 0; p.d = 0; spawn(p, t); }
    rosterDirty = true;
    broadcast({ t: 'reset' });
  }, 8000);
}

// ---------- الاتصال ----------
const wss = new WebSocketServer({ server, maxPayload: 4096 });
const num = v => typeof v === 'number' && Number.isFinite(v);
const vec = v => Array.isArray(v) && v.length === 3 && v.every(num);

wss.on('connection', ws => {
  let me = null;
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const now = Date.now();

    if (m.t === 'join' && !me) {
      if (count(0, false) + count(1, false) >= MAX_HUMANS) { send(ws, { t: 'full' }); ws.close(); return; }
      const name = (typeof m.name === 'string' ? m.name.trim().slice(0, 16) : '') || 'جندي';
      const team = count(0, false) <= count(1, false) ? 0 : 1;
      me = makePlayer(name, team, false, ws);
      balanceBots();
      send(ws, { t: 'init', id: me.id, team, roster: rosterList(), limit: KILL_LIMIT });
      send(ws, { t: 'spawn', x: me.x, y: me.y, z: me.z, yaw: me.yaw });
      return;
    }
    if (!me) return;

    if (m.t === 'st' && me.alive) {
      if (![m.x, m.y, m.z, m.yaw, m.pitch].every(num)) return;
      const lim = WORLD;
      me.x = Math.max(-lim, Math.min(lim, m.x));
      me.z = Math.max(-lim, Math.min(lim, m.z));
      me.y = Math.max(0, Math.min(20, m.y));
      me.yaw = m.yaw; me.pitch = m.pitch;
      me.crouch = !!m.c;
      if (m.w === 0 || m.w === 1 || m.w === 2) me.w = m.w;
    } else if (m.t === 'shot' && me.alive) {
      if (vec(m.o) && vec(m.e)) broadcast({ t: 'shot', id: me.id, o: m.o, e: m.e, w: me.w });
    } else if (m.t === 'hit' && me.alive) {
      const v = players.get(m.id), wp = WEAPONS[me.w];
      if (!v || !v.alive) return;
      if (now - me.lastHitAt < (60000 / wp.rpm) * 0.6) return; // أسرع من معدل إطلاق السلاح
      const o = { x: me.x, y: me.y + PLAYER.eye, z: me.z };
      const d = { x: v.x - o.x, y: v.y + 1 - o.y, z: v.z - o.z };
      const dist = Math.hypot(d.x, d.y, d.z) || 1;
      if (dist > wp.range * 1.1) return;
      d.x /= dist; d.y /= dist; d.z /= dist;
      if (rayBoxes(o, d, dist) < dist - 2) return; // يوجد جدار بينهما
      me.lastHitAt = now;
      damage(v, me, wp.dmg * (m.h ? wp.head : 1), me.w, !!m.h, now);
    }
  });
  ws.on('close', () => {
    if (!me) return;
    players.delete(me.id);
    rosterDirty = true;
    balanceBots();
  });
  ws.on('error', () => {});
});

// ---------- ملاحة البوتات ----------
const CELL = 2, N = (WORLD * 2) / CELL;
const cc = i => -WORLD + (i + 0.5) * CELL;
function blocked(x, z, m) {
  for (const b of BOXES) if (b.y0 < 1.7 && x + m > b.x0 && x - m < b.x1 && z + m > b.z0 && z - m < b.z1) return true;
  return false;
}
const walk = new Uint8Array(N * N), hOK = new Uint8Array(N * N), vOK = new Uint8Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const c = j * N + i;
  walk[c] = blocked(cc(i), cc(j), 0.7) ? 0 : 1;
  hOK[c] = blocked(cc(i) + CELL / 2, cc(j), 0.5) ? 0 : 1; // الممر إلى الخلية اليمنى
  vOK[c] = blocked(cc(i), cc(j) + CELL / 2, 0.5) ? 0 : 1; // الممر إلى الخلية السفلى
}
const walkable = []; walk.forEach((v, c) => { if (v) walkable.push(c); });
const cellOf = (x, z) => {
  const i = Math.max(0, Math.min(N - 1, Math.floor((x + WORLD) / CELL)));
  const j = Math.max(0, Math.min(N - 1, Math.floor((z + WORLD) / CELL)));
  return j * N + i;
};
function bfs(s, g) {
  const prev = new Int32Array(N * N).fill(-1), q = [s];
  prev[s] = s;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (c === g) break;
    const i = c % N, j = (c / N) | 0;
    const nb = [];
    if (i + 1 < N && hOK[c]) nb.push(c + 1);
    if (i > 0 && hOK[c - 1]) nb.push(c - 1);
    if (j + 1 < N && vOK[c]) nb.push(c + N);
    if (j > 0 && vOK[c - N]) nb.push(c - N);
    for (const n of nb) if (prev[n] === -1 && walk[n]) { prev[n] = c; q.push(n); }
  }
  if (prev[g] === -1) return [];
  const out = [];
  for (let c = g; c !== s; c = prev[c]) out.push(c);
  return out.reverse();
}

function visibleEnemy(b) {
  let best = null, bd = 80;
  const o = { x: b.x, y: b.y + PLAYER.eye, z: b.z };
  for (const e of players.values()) {
    if (e.team === b.team || !e.alive) continue;
    const d = { x: e.x - o.x, y: e.y + 1 - o.y, z: e.z - o.z };
    const dist = Math.hypot(d.x, d.y, d.z);
    if (dist >= bd || dist < 0.01) continue;
    d.x /= dist; d.y /= dist; d.z /= dist;
    if (rayBoxes(o, d, dist) >= dist) { best = e; bd = dist; }
  }
  return best;
}

function botTick(b, dt, now) {
  if (now >= (b.nextScan || 0)) {
    b.nextScan = now + 200;
    const t = visibleEnemy(b);
    if (t && !b.target) b.reactAt = now + 350 + Math.random() * 350;
    b.target = t;
  }
  const t = b.target;
  if (t && t.alive) {
    const dx = t.x - b.x, dz = t.z - b.z, dist = Math.hypot(dx, dz) || 1;
    b.yaw = Math.atan2(-dx, -dz);
    b.pitch = Math.atan2(t.y - b.y, dist);
    // تحرّك جانبي أثناء الاشتباك
    if (now >= (b.strafeAt || 0)) { b.strafeAt = now + 600 + Math.random() * 900; b.strafe = Math.random() < 0.5 ? -1 : 1; }
    move(b, (-dz / dist) * b.strafe * 2 * dt, 0, (dx / dist) * b.strafe * 2 * dt, PLAYER.h);
    if (now >= b.reactAt && now >= (b.nextFire || 0) && now >= b.reloadUntil) {
      b.nextFire = now + 150;
      if (--b.ammo <= 0) { b.ammo = 30; b.reloadUntil = now + 2200; }
      const hit = Math.random() < Math.max(0.06, Math.min(0.38, 0.38 - dist / 200));
      const o = [b.x, b.y + PLAYER.eye - 0.1, b.z];
      const miss = hit ? 0 : 1.5;
      const e = [t.x + (Math.random() - 0.5) * miss * 2, t.y + 1.1 + (Math.random() - 0.5) * miss, t.z + (Math.random() - 0.5) * miss * 2];
      broadcast({ t: 'shot', id: b.id, o, e, w: 0 });
      if (hit) damage(t, b, WEAPONS[0].dmg, 0, false, now);
    }
    b.path = [];
    return;
  }
  // دورية: اتبع المسار، وإن انتهى أو علق البوت اختر هدفاً جديداً
  if (now >= (b.stuckAt || 0)) {
    if (b.sx !== undefined && Math.hypot(b.x - b.sx, b.z - b.sz) < 0.5) b.path = [];
    b.sx = b.x; b.sz = b.z; b.stuckAt = now + 1500;
  }
  if (!b.path.length) {
    const enemies = [...players.values()].filter(e => e.team !== b.team && e.alive);
    let goal = walkable[Math.floor(Math.random() * walkable.length)];
    if (enemies.length && Math.random() < 0.6) {
      const e = enemies[Math.floor(Math.random() * enemies.length)];
      if (walk[cellOf(e.x, e.z)]) goal = cellOf(e.x, e.z);
    }
    b.path = bfs(cellOf(b.x, b.z), goal);
    if (!b.path.length) return;
  }
  const c = b.path[0], tx = cc(c % N), tz = cc((c / N) | 0);
  const dx = tx - b.x, dz = tz - b.z, dist = Math.hypot(dx, dz);
  if (dist < 0.4) { b.path.shift(); return; }
  b.yaw = Math.atan2(-dx, -dz); b.pitch = 0;
  const step = Math.min(dist, 4.5 * dt);
  move(b, (dx / dist) * step, 0, (dz / dist) * step, PLAYER.h);
}

// ---------- الحلقة الرئيسية ----------
const r2 = v => Math.round(v * 100) / 100;
setInterval(() => {
  const now = Date.now();
  if (![...players.values()].some(p => !p.bot)) { // لا لاعبين: المباراة متوقفة وتبدأ من جديد عند أول دخول
    match.endsAt = now + MATCH_MS;
    if (match.scores[0] || match.scores[1]) { match.scores = [0, 0]; for (const p of players.values()) { p.k = 0; p.d = 0; } }
    return;
  }
  if (!match.over) {
    for (const p of players.values()) {
      if (!p.alive) { if (now >= p.respawnAt) spawn(p, now); }
      else if (p.bot) botTick(p, TICK_MS / 1000, now);
    }
    if (now >= match.endsAt) endMatch(now);
  }
  if (rosterDirty) { rosterDirty = false; broadcast({ t: 'roster', list: rosterList() }); }
  broadcast({
    t: 'snap',
    p: [...players.values()].map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch), Math.ceil(p.hp), (p.alive ? 1 : 0) | (p.crouch ? 2 : 0), p.w]),
    s: match.scores,
    tl: Math.max(0, Math.round((match.endsAt - now) / 1000)),
  });
}, TICK_MS);

server.listen(PORT, () => console.log(`الخادم يعمل: http://localhost:${PORT}`));
