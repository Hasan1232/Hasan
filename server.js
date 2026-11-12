// خادم اللعبة: يقدّم الملفات ويدير غرفة العمليات والجبهات (معركة مستقلة لكل مدينة).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { WORLD, WEAPONS, PLAYER, FRONTS, SCORE_LIMIT, frontById, makeMap, move, rayBoxes } from './public/shared.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const TEAM_SIZE = 4;          // يكمل الخادم كل طرف ببوتات حتى هذا العدد
const MAX_HUMANS = 16;        // لكل جبهة
const MATCH_MS = 12 * 60 * 1000;
const RESPAWN_MS = 4000;
const TICK_MS = 50;
const CAPTURE_S = 6;          // ثوانٍ للسيطرة على موقع محايد

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

const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
const r2 = v => Math.round(v * 100) / 100;
const num = v => typeof v === 'number' && Number.isFinite(v);
const vec = v => Array.isArray(v) && v.length === 3 && v.every(num);
const BOT_NAMES = ['صقر', 'ذئب', 'نمر', 'عقاب', 'فهد', 'شبح', 'رعد', 'برق', 'ليث', 'سهم', 'نسر', 'جبل'];
let nextId = 1;

// ---------- الجبهة ----------
const CELL = 2, N = (WORLD * 2) / CELL;
const cc = i => -WORLD + (i + 0.5) * CELL;
const cellOf = (x, z) => {
  const i = Math.max(0, Math.min(N - 1, Math.floor((x + WORLD) / CELL)));
  const j = Math.max(0, Math.min(N - 1, Math.floor((z + WORLD) / CELL)));
  return j * N + i;
};

class Room {
  constructor(front) {
    this.front = front;
    this.map = makeMap(front);
    this.players = new Map();
    this.rosterDirty = false;
    this.resetMatch(Date.now());
    this.buildNav();
  }

  resetMatch(now) {
    this.scores = [0, 0];
    this.endsAt = now + MATCH_MS;
    this.over = false;
    this.zones = this.map.zones.map(() => ({ owner: -1, prog: 0 })); // prog: ‎-1 للمعارضة، ‎+1 للنظام
    this.scoreAt = now + 2000;
  }

  // شبكة ملاحة للبوتات
  buildNav() {
    const boxes = this.map.boxes;
    const blocked = (x, z, m) => {
      for (const b of boxes) if (b.y0 < 1.7 && b.y1 > 0.3 && x + m > b.x0 && x - m < b.x1 && z + m > b.z0 && z - m < b.z1) return true;
      return false;
    };
    this.walk = new Uint8Array(N * N); this.hOK = new Uint8Array(N * N); this.vOK = new Uint8Array(N * N);
    this.walkable = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = j * N + i;
      this.walk[c] = blocked(cc(i), cc(j), 0.7) ? 0 : 1;
      this.hOK[c] = blocked(cc(i) + CELL / 2, cc(j), 0.5) ? 0 : 1;
      this.vOK[c] = blocked(cc(i), cc(j) + CELL / 2, 0.5) ? 0 : 1;
      if (this.walk[c]) this.walkable.push(c);
    }
  }
  bfs(s, g) {
    const { walk, hOK, vOK } = this;
    const prev = new Int32Array(N * N).fill(-1), q = [s];
    prev[s] = s;
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      if (c === g) break;
      const i = c % N, j = (c / N) | 0, nb = [];
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

  broadcast(m) {
    const s = JSON.stringify(m);
    for (const p of this.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s);
  }
  count(team, bot) { let n = 0; for (const p of this.players.values()) if (p.team === team && p.bot === bot) n++; return n; }
  humans() { return this.count(0, false) + this.count(1, false); }
  rosterList() { return [...this.players.values()].map(p => ({ id: p.id, name: p.name, team: p.team, k: p.k, d: p.d, bot: p.bot })); }
  status() { return { id: this.front.id, h: [this.count(0, false), this.count(1, false)], s: this.scores, z: this.zones.map(z => z.owner) }; }

  spawn(p, now) {
    const list = this.map.spawns[p.team];
    const s = list[Math.floor(Math.random() * list.length)];
    Object.assign(p, { x: s.x, y: 0, z: s.z, yaw: s.yaw, pitch: 0, hp: 100, alive: true, crouch: false, protectUntil: now + 2000 });
    if (p.bot) Object.assign(p, { path: [], target: null, ammo: 30, reloadUntil: 0, holdUntil: 0 });
    if (p.ws) send(p.ws, { t: 'spawn', x: p.x, y: p.y, z: p.z, yaw: p.yaw });
  }
  addPlayer(name, team, bot, ws) {
    const p = { id: nextId++, name, team, bot, ws, k: 0, d: 0, w: 0, lastHitAt: 0, respawnAt: 0 };
    this.players.set(p.id, p);
    this.spawn(p, Date.now());
    this.rosterDirty = true;
    return p;
  }
  balanceBots() {
    for (const team of [0, 1]) {
      const want = this.humans() ? Math.max(0, TEAM_SIZE - this.count(team, false)) : 0;
      let have = this.count(team, true);
      while (have < want) { this.addPlayer(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], team, true, null); have++; }
      while (have > want) {
        const b = [...this.players.values()].find(p => p.team === team && p.bot);
        this.players.delete(b.id); have--; this.rosterDirty = true;
      }
    }
  }
  join(ws, name, wantTeam) {
    if (this.humans() >= MAX_HUMANS) return null;
    // احترم اختيار الطرف ما لم يختلّ التوازن بأكثر من لاعبَين
    let team = wantTeam;
    if (this.count(team, false) - this.count(1 - team, false) >= 2) team = 1 - team;
    if (!this.humans()) this.resetMatch(Date.now());
    const me = this.addPlayer(name, team, false, ws);
    this.balanceBots();
    send(ws, { t: 'init', id: me.id, team, front: this.front.id, roster: this.rosterList() });
    send(ws, { t: 'spawn', x: me.x, y: me.y, z: me.z, yaw: me.yaw });
    return me;
  }
  leave(me) {
    this.players.delete(me.id);
    this.rosterDirty = true;
    this.balanceBots();
  }

  damage(victim, attacker, amount, w, head, now) {
    if (this.over || !victim.alive || now < victim.protectUntil || victim.team === attacker.team) return;
    victim.hp -= amount;
    if (victim.ws) send(victim.ws, { t: 'dmg', x: attacker.x, z: attacker.z });
    if (victim.hp > 0) return;
    victim.hp = 0; victim.alive = false; victim.d++; victim.respawnAt = now + RESPAWN_MS;
    attacker.k++; this.scores[attacker.team]++;
    this.broadcast({ t: 'kill', k: attacker.id, v: victim.id, w, h: head ? 1 : 0 });
    this.rosterDirty = true;
  }
  endMatch() {
    if (this.over) return;
    this.over = true;
    const [a, b] = this.scores;
    this.broadcast({ t: 'end', w: a === b ? -1 : a > b ? 0 : 1 });
    setTimeout(() => {
      const t = Date.now();
      this.resetMatch(t);
      for (const p of this.players.values()) { p.k = 0; p.d = 0; this.spawn(p, t); }
      this.rosterDirty = true;
      this.broadcast({ t: 'reset' });
    }, 8000);
  }

  onMessage(me, m, now) {
    if (m.t === 'st' && me.alive) {
      if (![m.x, m.y, m.z, m.yaw, m.pitch].every(num)) return;
      me.x = Math.max(-WORLD, Math.min(WORLD, m.x));
      me.z = Math.max(-WORLD, Math.min(WORLD, m.z));
      me.y = Math.max(0, Math.min(30, m.y));
      me.yaw = m.yaw; me.pitch = m.pitch;
      me.crouch = !!m.c;
      if (m.w === 0 || m.w === 1 || m.w === 2) me.w = m.w;
    } else if (m.t === 'shot' && me.alive) {
      if (vec(m.o) && vec(m.e)) this.broadcast({ t: 'shot', id: me.id, o: m.o, e: m.e, w: me.w });
    } else if (m.t === 'hit' && me.alive) {
      const v = this.players.get(m.id), wp = WEAPONS[me.w];
      if (!v || !v.alive) return;
      if (now - me.lastHitAt < (60000 / wp.rpm) * 0.6) return; // أسرع من معدل إطلاق السلاح
      const o = { x: me.x, y: me.y + PLAYER.eye, z: me.z };
      const d = { x: v.x - o.x, y: v.y + 1 - o.y, z: v.z - o.z };
      const dist = Math.hypot(d.x, d.y, d.z) || 1;
      if (dist > wp.range * 1.1) return;
      d.x /= dist; d.y /= dist; d.z /= dist;
      if (rayBoxes(this.map.boxes, o, d, dist) < dist - 2) return; // يوجد جدار بينهما
      me.lastHitAt = now;
      this.damage(v, me, wp.dmg * (m.h ? wp.head : 1), me.w, !!m.h, now);
    }
  }

  // ---------- المواقع ----------
  tickZones(dt, now) {
    this.map.zones.forEach((def, i) => {
      const z = this.zones[i], n = [0, 0];
      for (const p of this.players.values()) {
        if (p.alive && p.y < 3 && Math.hypot(p.x - def.x, p.z - def.z) <= def.r) n[p.team]++;
      }
      if (!!n[0] === !!n[1]) return; // لا أحد أو متنازع عليه
      const team = n[0] ? 0 : 1, dir = team ? 1 : -1;
      if (z.owner === team && Math.abs(z.prog) >= 1) return;
      z.prog = Math.max(-1, Math.min(1, z.prog + dir * (dt / CAPTURE_S) * Math.sqrt(Math.min(3, n[team]))));
      if (z.owner !== -1 && z.owner !== team && z.prog * dir >= 0) z.owner = -1; // خسرها مالكها السابق
      if (z.owner !== team && Math.abs(z.prog) >= 1) {
        z.owner = team;
        this.broadcast({ t: 'cap', z: i, team });
      }
    });
    if (now >= this.scoreAt) {
      this.scoreAt = now + 2000;
      for (const z of this.zones) if (z.owner !== -1) this.scores[z.owner]++;
    }
  }

  // ---------- البوتات ----------
  visibleEnemy(b) {
    let best = null, bd = 70;
    const o = { x: b.x, y: b.y + PLAYER.eye, z: b.z };
    for (const e of this.players.values()) {
      if (e.team === b.team || !e.alive) continue;
      const d = { x: e.x - o.x, y: e.y + 1 - o.y, z: e.z - o.z };
      const dist = Math.hypot(d.x, d.y, d.z);
      if (dist >= bd || dist < 0.01) continue;
      d.x /= dist; d.y /= dist; d.z /= dist;
      if (rayBoxes(this.map.boxes, o, d, dist) >= dist) { best = e; bd = dist; }
    }
    return best;
  }
  botGoal(b) {
    const { walk, walkable } = this;
    const r = Math.random();
    if (r < 0.7) { // توجّه إلى موقع ليس بيد طرفك
      const open = this.map.zones.filter((_, i) => this.zones[i].owner !== b.team);
      const list = open.length ? open : this.map.zones;
      const z = list[Math.floor(Math.random() * list.length)];
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * 6.28, d = Math.random() * (z.r - 1);
        const c = cellOf(z.x + Math.cos(a) * d, z.z + Math.sin(a) * d);
        if (walk[c]) return c;
      }
    } else if (r < 0.85) {
      const enemies = [...this.players.values()].filter(e => e.team !== b.team && e.alive);
      if (enemies.length) {
        const e = enemies[Math.floor(Math.random() * enemies.length)];
        if (walk[cellOf(e.x, e.z)]) return cellOf(e.x, e.z);
      }
    }
    return walkable[Math.floor(Math.random() * walkable.length)];
  }
  botTick(b, dt, now) {
    const boxes = this.map.boxes;
    if (now >= (b.nextScan || 0)) {
      b.nextScan = now + 200;
      const t = this.visibleEnemy(b);
      if (t && !b.target) b.reactAt = now + 350 + Math.random() * 350;
      b.target = t;
    }
    const t = b.target;
    if (t && t.alive) {
      const dx = t.x - b.x, dz = t.z - b.z, dist = Math.hypot(dx, dz) || 1;
      b.yaw = Math.atan2(-dx, -dz);
      b.pitch = Math.atan2(t.y - b.y, dist);
      if (now >= (b.strafeAt || 0)) { b.strafeAt = now + 600 + Math.random() * 900; b.strafe = Math.random() < 0.5 ? -1 : 1; }
      move(boxes, b, (-dz / dist) * b.strafe * 2 * dt, 0, (dx / dist) * b.strafe * 2 * dt, PLAYER.h);
      if (now >= b.reactAt && now >= (b.nextFire || 0) && now >= b.reloadUntil) {
        b.nextFire = now + 150;
        if (--b.ammo <= 0) { b.ammo = 30; b.reloadUntil = now + 2200; }
        const hit = Math.random() < Math.max(0.06, Math.min(0.38, 0.38 - dist / 200));
        const o = [b.x, b.y + PLAYER.eye - 0.1, b.z];
        const miss = hit ? 0 : 1.5;
        const e = [t.x + (Math.random() - 0.5) * miss * 2, t.y + 1.1 + (Math.random() - 0.5) * miss, t.z + (Math.random() - 0.5) * miss * 2];
        this.broadcast({ t: 'shot', id: b.id, o, e, w: 0 });
        if (hit) this.damage(t, b, WEAPONS[0].dmg, 0, false, now);
      }
      b.path = [];
      return;
    }
    if (now < b.holdUntil) return; // يثبت في الموقع
    if (now >= (b.stuckAt || 0)) {
      if (b.sx !== undefined && Math.hypot(b.x - b.sx, b.z - b.sz) < 0.5) b.path = [];
      b.sx = b.x; b.sz = b.z; b.stuckAt = now + 1500;
    }
    if (!b.path.length) {
      // وصل: إن كان داخل موقع لم يُحسم بعد فليثبت فيه قليلاً
      const zi = this.map.zones.findIndex(z => Math.hypot(b.x - z.x, b.z - z.z) <= z.r);
      if (zi >= 0 && !(this.zones[zi].owner === b.team && Math.abs(this.zones[zi].prog) >= 1) && Math.random() < 0.8) {
        b.holdUntil = now + 2500 + Math.random() * 3000; b.stuckAt = b.holdUntil + 1500; b.sx = undefined;
        return;
      }
      b.path = this.bfs(cellOf(b.x, b.z), this.botGoal(b));
      if (!b.path.length) return;
    }
    const c = b.path[0], tx = cc(c % N), tz = cc((c / N) | 0);
    const dx = tx - b.x, dz = tz - b.z, dist = Math.hypot(dx, dz);
    if (dist < 0.4) { b.path.shift(); return; }
    b.yaw = Math.atan2(-dx, -dz); b.pitch = 0;
    const step = Math.min(dist, 4.5 * dt);
    move(boxes, b, (dx / dist) * step, 0, (dz / dist) * step, PLAYER.h);
  }

  tick(now) {
    if (!this.humans()) return; // الجبهة هادئة: لا أحد فيها
    const dt = TICK_MS / 1000;
    if (!this.over) {
      for (const p of this.players.values()) {
        if (!p.alive) { if (now >= p.respawnAt) this.spawn(p, now); }
        else if (p.bot) this.botTick(p, dt, now);
      }
      this.tickZones(dt, now);
      if (now >= this.endsAt || Math.max(...this.scores) >= SCORE_LIMIT) this.endMatch();
    }
    if (this.rosterDirty) { this.rosterDirty = false; this.broadcast({ t: 'roster', list: this.rosterList() }); }
    this.broadcast({
      t: 'snap',
      p: [...this.players.values()].map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch), Math.ceil(p.hp), (p.alive ? 1 : 0) | (p.crouch ? 2 : 0), p.w]),
      s: this.scores,
      z: this.zones.map(z => [z.owner, r2(z.prog)]),
      tl: Math.max(0, Math.round((this.endsAt - now) / 1000)),
    });
  }
}

// ---------- الاتصال وغرفة العمليات ----------
const rooms = new Map(); // تُنشأ الجبهة عند أول دخول إليها
const lobby = new Set();
const lobbyState = () => ({
  t: 'lobby',
  fronts: FRONTS.map(f => rooms.get(f.id)?.status() ?? { id: f.id, h: [0, 0], s: [0, 0], z: [-1, -1, -1] }),
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });
wss.on('connection', ws => {
  let me = null, room = null;
  lobby.add(ws);
  send(ws, lobbyState());
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'join' && !me) {
      const front = frontById(m.front);
      if (!front) return;
      if (!rooms.has(front.id)) rooms.set(front.id, new Room(front));
      const name = (typeof m.name === 'string' ? m.name.trim().slice(0, 16) : '') || 'مقاتل';
      me = rooms.get(front.id).join(ws, name, m.team === 1 ? 1 : 0);
      if (!me) { send(ws, { t: 'full' }); return; }
      room = rooms.get(front.id);
      lobby.delete(ws);
    } else if (me) room.onMessage(me, m, Date.now());
  });
  ws.on('close', () => {
    lobby.delete(ws);
    if (me) room.leave(me);
  });
  ws.on('error', () => {});
});

setInterval(() => { const now = Date.now(); for (const r of rooms.values()) r.tick(now); }, TICK_MS);
setInterval(() => {
  if (!lobby.size) return;
  const s = JSON.stringify(lobbyState());
  for (const ws of lobby) if (ws.readyState === 1) ws.send(s);
}, 2000);

server.listen(PORT, () => console.log(`الخادم يعمل: http://localhost:${PORT}`));
