import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { BOXES, WORLD, WEAPONS, PLAYER, move, collides, rayBoxes, rayPlayer } from './shared.js';

const $ = id => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;
const canvas = $('c');
const TEAM_NAMES = ['المعارضة', 'النظام'];

// ================= المشهد =================
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const HAZE = 0xc3cfd2;
scene.fog = new THREE.Fog(HAZE, 50, 260);
const BASE_FOV = 75;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 700);
camera.rotation.order = 'YXZ';
scene.add(camera);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function tex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function speck(g, s, n, a, max = 4) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`;
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * max, 1 + Math.random() * max);
  }
}

// السماء
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(500, 24, 12),
  new THREE.MeshBasicMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false,
    map: tex(256, (g, s) => {
      const gr = g.createLinearGradient(0, 0, 0, s);
      gr.addColorStop(0, '#3f6fa8'); gr.addColorStop(0.38, '#8fb1cf'); gr.addColorStop(0.5, '#c3cfd2'); gr.addColorStop(1, '#c3cfd2');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }),
  })
));

// الإضاءة
scene.add(new THREE.HemisphereLight(0xc4d8ee, 0x8a8068, 1.9));
const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
sun.position.set(45, 70, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -78, right: 78, top: 78, bottom: -78, near: 1, far: 220 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.06;
scene.add(sun);

// الأرض
const groundTex = tex(512, (g, s) => {
  g.fillStyle = '#756f58'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 40},${40 + Math.random() * 30},${20 + Math.random() * 20},0.12)`;
    g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 20 + Math.random() * 60, 0, 7); g.fill();
  }
  speck(g, s, 9000, 0.22, 3);
});
groundTex.repeat.set(18, 18);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2 + 2, WORLD * 2 + 2), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// مواد الخريطة
const TILE = { concrete: 4, building: 4, container: 2.6, crate: 1.5, cover: 2, border: 5 };
const MAT = {
  concrete: new THREE.MeshStandardMaterial({ roughness: 0.95, map: tex(256, (g, s) => {
    g.fillStyle = '#8d8f8a'; g.fillRect(0, 0, s, s); speck(g, s, 2500, 0.14);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3; g.strokeRect(0, 0, s, s);
  }) }),
  building: new THREE.MeshStandardMaterial({ roughness: 0.9, map: tex(256, (g, s) => {
    g.fillStyle = '#a59b86'; g.fillRect(0, 0, s, s); speck(g, s, 2500, 0.12);
    g.fillStyle = '#5d5648'; g.fillRect(84, 60, 88, 104);
    g.fillStyle = '#1c2830'; g.fillRect(90, 66, 76, 92);
    g.fillStyle = '#5d5648'; g.fillRect(126, 66, 4, 92);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, s - 6, s, 6);
  }) }),
  container: tex(256, (g, s) => {
    g.fillStyle = '#d9d9d6'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x, 0, 5, s); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 5, 0, 3, s); }
    speck(g, s, 1200, 0.15);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, s, 8); g.fillRect(0, s - 8, s, 8);
  }),
  crate: new THREE.MeshStandardMaterial({ roughness: 0.85, map: tex(128, (g, s) => {
    g.fillStyle = '#8c6b3f'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 21) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, s, 2); }
    speck(g, s, 500, 0.15);
    g.strokeStyle = '#5a4324'; g.lineWidth = 14; g.strokeRect(0, 0, s, s);
    g.lineWidth = 10; g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.stroke();
  }) }),
  cover: new THREE.MeshStandardMaterial({ roughness: 1, map: tex(128, (g, s) => {
    g.fillStyle = '#6f6549'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) {
      g.fillStyle = r % 2 ? '#8b7f5d' : '#857956';
      g.beginPath(); g.roundRect(c * 64 + (r % 2 ? 32 : 0) + 2, r * 32 + 2, 60, 28, 10); g.fill();
    }
    speck(g, s, 600, 0.12);
  }) }),
  border: new THREE.MeshStandardMaterial({ roughness: 1, map: tex(128, (g, s) => {
    g.fillStyle = '#5f625c'; g.fillRect(0, 0, s, s); speck(g, s, 900, 0.15);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 3, s);
  }) }),
};
const CONTAINER_COLORS = [0x2f6f8f, 0x9b3d2e, 0x4c7a47, 0xb08a2e, 0x556070];
BOXES.forEach((b, i) => {
  const w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0;
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv, T = TILE[b.type];
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const k = f * 4 + v;
    uv.setXY(k, uv.getX(k) * dims[f][0] / T, uv.getY(k) * dims[f][1] / T);
  }
  const mat = b.type === 'container'
    ? new THREE.MeshStandardMaterial({ map: MAT.container, color: CONTAINER_COLORS[(i >> 1) % CONTAINER_COLORS.length], roughness: 0.6, metalness: 0.3 })
    : MAT[b.type];
  const m = new THREE.Mesh(geo, mat);
  m.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
});

// ================= الجنود =================
const TEAM_COLORS = [0x4f6b3e, 0x8a4a38];
const darkMat = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.7 });
const skinMat = new THREE.MeshStandardMaterial({ color: 0xc09674, roughness: 0.8 });
// مجسّم الجندي (GLB) مع حركاته؛ إن فشل تحميله تُستخدم المجسّمات الصندوقية
let soldierGltf = null;
const TEAM_TINT = [0x9dbb82, 0xd89280], teamMats = [];
new GLTFLoader().load('/models/soldier.glb', gltf => {
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    if (o.material.name === 'VanguardBodyMat' && !teamMats.length) {
      for (const c of TEAM_TINT) { const m = o.material.clone(); m.color.setHex(c); teamMats.push(m); }
    }
  });
  soldierGltf = gltf;
}, undefined, () => console.warn('تعذّر تحميل مجسّم الجندي'));

function nameTag(g, name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 34px Tahoma, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = '#000a'; x.strokeText(name, 128, 32);
  x.fillStyle = '#9cc4ff'; x.fillText(name, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.position.y = 2.15; sp.scale.set(1.8, 0.45, 1);
  g.add(sp);
}

function makeSoldier(team, name, friendly) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  if (friendly) nameTag(g, name);
  if (soldierGltf) {
    const model = cloneSkinned(soldierGltf.scene);
    model.traverse(o => { if (o.isMesh && o.material.name === 'VanguardBodyMat') o.material = teamMats[team]; });
    const hand = model.getObjectByName('mixamorigRightHand');
    if (hand) {
      const rifle = new THREE.Group();
      rifle.scale.setScalar(100); rifle.position.set(0, 8, 3); rifle.rotation.y = Math.PI;
      const bx = (w, h, d, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkMat); m.position.set(0, y, z); m.castShadow = true; rifle.add(m); };
      bx(0.05, 0.09, 0.55, 0, -0.15); bx(0.03, 0.03, 0.3, 0.01, -0.55); bx(0.04, 0.16, 0.06, -0.11, -0.2);
      hand.add(rifle);
    }
    g.add(model);
    const mixer = new THREE.AnimationMixer(model), actions = {};
    for (const n of ['Idle', 'Walk', 'Run']) {
      actions[n] = mixer.clipAction(soldierGltf.animations.find(a => a.name === n));
      actions[n].play(); actions[n].setEffectiveWeight(n === 'Idle' ? 1 : 0);
    }
    scene.add(g);
    return { g, model, mixer, actions };
  }
  const cloth = new THREE.MeshStandardMaterial({ color: TEAM_COLORS[team], roughness: 0.95 });
  const part = (parent, w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  };
  const legs = new THREE.Group(), upper = new THREE.Group();
  g.add(legs, upper);
  part(legs, 0.26, 0.82, 0.3, -0.17, 0.41, 0, cloth);
  part(legs, 0.26, 0.82, 0.3, 0.17, 0.41, 0, cloth);
  part(upper, 0.66, 0.64, 0.36, 0, 1.13, 0, cloth);
  part(upper, 0.7, 0.42, 0.42, 0, 1.16, 0, darkMat);           // سترة واقية
  part(upper, 0.28, 0.3, 0.28, 0, 1.6, 0, skinMat);            // الرأس
  part(upper, 0.36, 0.17, 0.38, 0, 1.73, 0, darkMat);          // خوذة
  part(upper, 0.16, 0.16, 0.6, 0.4, 1.28, -0.25, cloth);       // ذراع يمنى
  part(upper, 0.16, 0.16, 0.62, -0.3, 1.25, -0.32, cloth).rotation.y = -0.5;
  part(upper, 0.07, 0.12, 0.85, 0.22, 1.3, -0.55, darkMat);    // السلاح
  scene.add(g);
  return { g, legs, upper };
}

// ================= سلاح منظور اللاعب =================
const gunMat = new THREE.MeshStandardMaterial({ color: 0x4a4e4c, roughness: 0.55, metalness: 0.25 });
const stockMat = new THREE.MeshStandardMaterial({ color: 0x4b3b29, roughness: 0.8 });
const gunHolder = new THREE.Group();
camera.add(gunHolder);
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  map: tex(64, (g, s) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, '#ffd36b'); gr.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }),
}));
flash.visible = false;
const guns = WEAPONS.map((_, w) => {
  const g = new THREE.Group();
  const bx = (wd, h, d, x, y, z, m = gunMat) => { const me = new THREE.Mesh(new THREE.BoxGeometry(wd, h, d), m); me.position.set(x, y, z); g.add(me); };
  if (w === 0) {
    bx(0.05, 0.08, 0.5, 0, 0, -0.1); bx(0.026, 0.026, 0.3, 0, 0.012, -0.5); bx(0.04, 0.17, 0.065, 0, -0.11, -0.08);
    bx(0.04, 0.1, 0.05, 0, -0.08, 0.1); bx(0.045, 0.075, 0.14, 0, -0.012, 0.21, stockMat); bx(0.012, 0.03, 0.012, 0, 0.055, -0.3); bx(0.03, 0.03, 0.04, 0, 0.05, 0.1);
    g.userData.muzzle = -0.67;
  } else if (w === 1) {
    bx(0.05, 0.07, 0.62, 0, 0, -0.1); bx(0.024, 0.024, 0.6, 0, 0.012, -0.7); bx(0.05, 0.05, 0.28, 0, 0.075, -0.05);
    bx(0.04, 0.09, 0.05, 0, -0.07, 0.12); bx(0.045, 0.09, 0.3, 0, -0.02, 0.34, stockMat); bx(0.04, 0.08, 0.07, 0, -0.07, -0.1);
    g.userData.muzzle = -1.02;
  } else {
    bx(0.036, 0.05, 0.2, 0, 0, -0.05); bx(0.036, 0.11, 0.046, 0, -0.07, 0.02);
    g.userData.muzzle = -0.17;
  }
  g.visible = false;
  gunHolder.add(g);
  return g;
});
gunHolder.add(flash);

// ================= مؤثرات =================
const fx = [];
function tracer(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.65 }));
  scene.add(l); fx.push({ o: l, t: 0.07, max: 0.07 });
}
const sparkGeo = new THREE.SphereGeometry(0.07, 6, 4);
function spark(p) {
  const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xd9c9a0, transparent: true }));
  m.position.copy(p); scene.add(m); fx.push({ o: m, t: 0.18, max: 0.18, grow: true });
}

let ac, noiseBuf;
function initAudio() {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ac = null; }
}
function gunSound(vol, w) {
  if (!ac || vol <= 0.01) return;
  const t = ac.currentTime, dur = w === 1 ? 0.4 : 0.17;
  const src = ac.createBufferSource(); src.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = w === 1 ? 1500 : w === 2 ? 3400 : 2500;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(ac.destination); src.start(t); src.stop(t + dur);
  const o = ac.createOscillator(); o.frequency.setValueAtTime(w === 1 ? 110 : 170, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
  const g2 = ac.createGain(); g2.gain.setValueAtTime(vol * 0.8, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g2).connect(ac.destination); o.start(t); o.stop(t + 0.13);
}
function blip(freq, vol = 0.15, dur = 0.06) {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}

// ================= الحالة =================
const me = { id: 0, team: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, hp: 100, alive: false, grounded: true, crouch: false };
let playing = false, matchOver = false;
let ws = null, roster = new Map(), scores = [0, 0], timeLeft = 600;
const remotes = new Map();
let cur = 0, ammo = WEAPONS.map(w => w.mag), reloadEnd = 0, lastShot = 0, triggerUsed = false;
let firing = false, adsHeld = false, adsT = 0, kick = 0, gunKick = 0, eyeH = PLAYER.eye, bob = 0, deathAt = 0;
const keys = {};
const touch = { jx: 0, jy: 0, crouch: false, jump: false };

const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
const nameOf = id => roster.get(id)?.name ?? '؟';

// ================= الشبكة =================
function connect(name) {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => send({ t: 'join', name });
  ws.onmessage = e => onMsg(JSON.parse(e.data));
  ws.onclose = () => { if (playing) flashMsg('انقطع الاتصال بالخادم — أعد تحميل الصفحة', 1e9); playing = false; };
}

function setRoster(list) {
  roster = new Map(list.map(r => [r.id, r]));
  for (const [id, r] of remotes) if (!roster.has(id)) { scene.remove(r.g); remotes.delete(id); }
  renderBoards();
}

function onMsg(m) {
  if (m.t === 'init') {
    me.id = m.id; me.team = m.team; playing = true;
    setRoster(m.roster);
    $('menu').style.display = 'none'; $('hud').style.display = 'block';
    drawMapBase();
    flashMsg(`أنت مع قوات ${TEAM_NAMES[me.team]}`, 3000);
  } else if (m.t === 'full') {
    alert('الخادم ممتلئ، حاول لاحقاً');
  } else if (m.t === 'roster') {
    setRoster(m.list);
  } else if (m.t === 'spawn') {
    Object.assign(me, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: 0, vx: 0, vy: 0, vz: 0, hp: 100, alive: true, crouch: false });
    ammo = WEAPONS.map(w => w.mag); reloadEnd = 0; kick = 0;
    $('death').style.display = 'none';
    updateHud();
  } else if (m.t === 'snap') {
    scores = m.s; timeLeft = m.tl;
    for (const [id, x, y, z, yaw, pitch, hp, fl, w] of m.p) {
      const alive = !!(fl & 1);
      if (id === me.id) { me.hp = hp; if (!alive) me.alive = false; continue; }
      let r = remotes.get(id);
      if (!r) {
        const info = roster.get(id);
        if (!info) continue;
        r = { id, team: info.team, ...makeSoldier(info.team, info.name, info.team === me.team), lastShot: 0 };
        r.g.position.set(x, y, z); r.g.rotation.y = yaw;
        remotes.set(id, r);
      }
      if (alive && !r.alive) { r.g.position.set(x, y, z); r.g.rotation.x = 0; } // عاد للحياة: انقله فوراً
      Object.assign(r, { tx: x, ty: y, tz: z, tyaw: yaw, alive, crouch: !!(fl & 2), w });
    }
  } else if (m.t === 'shot') {
    if (m.id === me.id) return;
    const a = new THREE.Vector3(...m.o), b = new THREE.Vector3(...m.e);
    tracer(a, b);
    gunSound(Math.max(0, 0.45 * (1 - a.distanceTo(camera.position) / 140)), m.w);
    const r = remotes.get(m.id); if (r) r.lastShot = performance.now();
  } else if (m.t === 'dmg') {
    const rel = Math.atan2(-(m.x - me.x), -(m.z - me.z)) - me.yaw;
    $('dmgdir').style.transform = `rotate(${-rel}rad)`;
    pulse($('dmgdir'), 1, 900); pulse($('vig'), 0.9, 600);
    blip(120, 0.25, 0.12);
  } else if (m.t === 'kill') {
    addFeed(m);
    if (m.v === me.id) {
      me.alive = false; deathAt = performance.now(); adsHeld = false;
      $('deathby').textContent = `قتلك ${nameOf(m.k)} بـ ${WEAPONS[m.w].short}`;
      $('death').style.display = 'flex';
    } else if (m.k === me.id) {
      flashMsg(m.h ? `قتلت ${nameOf(m.v)} — إصابة في الرأس!` : `قتلت ${nameOf(m.v)}`, 2200);
      blip(880, 0.2, 0.15);
    }
  } else if (m.t === 'end') {
    matchOver = true;
    $('endtitle').textContent = m.w < 0 ? 'تعادل' : m.w === me.team ? 'انتصار!' : 'هزيمة';
    $('endtitle').style.color = m.w === me.team ? '#9fd36a' : m.w < 0 ? '#e9ece6' : '#ff7a66';
    $('death').style.display = 'none'; $('end').style.display = 'flex';
    document.exitPointerLock?.();
  } else if (m.t === 'reset') {
    matchOver = false; $('end').style.display = 'none';
  }
}

// ================= واجهة اللاعب =================
function pulse(el, v, ms) {
  el.style.transition = 'none'; el.style.opacity = v;
  requestAnimationFrame(() => { el.style.transition = `opacity ${ms}ms`; el.style.opacity = 0; });
}
let msgTimer;
function flashMsg(text, ms) {
  const el = $('msg'); el.textContent = text; el.style.opacity = 1;
  clearTimeout(msgTimer);
  if (ms < 1e8) msgTimer = setTimeout(() => (el.style.opacity = 0), ms);
}
function addFeed(m) {
  const k = roster.get(m.k), v = roster.get(m.v);
  const row = document.createElement('div');
  const span = (cls, txt) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; row.append(s); };
  span('t' + (k?.team ?? 0), k?.name ?? '؟');
  span('wp', `${WEAPONS[m.w].short}${m.h ? ' ◎' : ''} ←`);
  span('t' + (v?.team ?? 0), v?.name ?? '؟');
  $('feed').append(row);
  if ($('feed').children.length > 5) $('feed').firstChild.remove();
  setTimeout(() => row.remove(), 6000);
}
function renderBoards() {
  for (const host of [$('boardcols'), $('endcols')]) {
    host.replaceChildren();
    for (const team of [0, 1]) {
      const t = document.createElement('table');
      const cap = t.createCaption(); cap.textContent = `قوات ${TEAM_NAMES[team]}`; cap.style.color = team ? '#ff7a66' : '#8fd06f';
      const head = t.insertRow();
      for (const h of ['المقاتل', 'قتل', 'موت']) { const th = document.createElement('th'); th.textContent = h; head.append(th); }
      [...roster.values()].filter(r => r.team === team).sort((a, b) => b.k - a.k).forEach(r => {
        const row = t.insertRow();
        if (r.id === me.id) row.className = 'me';
        row.insertCell().textContent = r.name + (r.bot ? ' (آلي)' : '');
        row.insertCell().textContent = r.k;
        row.insertCell().textContent = r.d;
      });
      host.append(t);
    }
  }
}
function updateHud() {
  const wp = WEAPONS[cur];
  $('hpnum').textContent = Math.max(0, me.hp);
  $('hpfill').style.width = Math.max(0, me.hp) + '%';
  $('hpfill').style.background = me.hp > 50 ? '#9fd36a' : me.hp > 25 ? '#e3b341' : '#e5533d';
  $('ammo').innerHTML = `${ammo[cur]} <small>/ ${wp.mag}</small>`;
  $('wname').textContent = reloadEnd ? 'جارٍ التلقيم…' : wp.name;
  $('slots').textContent = WEAPONS.map((w, i) => (i === cur ? `【${i + 1} ${w.short}】` : `${i + 1} ${w.short}`)).join('  ');
  $('sa').textContent = scores[0]; $('sb').textContent = scores[1];
  $('timer').textContent = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`;
  if (!me.alive && deathAt) $('respawn').textContent = `العودة خلال ${Math.max(0, Math.ceil(4 - (performance.now() - deathAt) / 1000))} ث`;
}

// الخريطة المصغّرة
const mapCtx = $('map').getContext('2d'), mapBase = document.createElement('canvas');
mapBase.width = mapBase.height = 140;
const MS = 140 / (WORLD * 2), mp = v => (v + WORLD) * MS;
function drawMapBase() {
  const g = mapBase.getContext('2d');
  g.clearRect(0, 0, 140, 140);
  g.fillStyle = '#9aa094aa';
  for (const b of BOXES) if (b.type !== 'border' && b.y0 === 0) g.fillRect(mp(b.x0), mp(b.z0), (b.x1 - b.x0) * MS, (b.z1 - b.z0) * MS);
}
function drawMap(now) {
  mapCtx.clearRect(0, 0, 140, 140);
  mapCtx.drawImage(mapBase, 0, 0);
  for (const r of remotes.values()) {
    if (!r.alive) continue;
    const friend = r.team === me.team;
    if (!friend && now - r.lastShot > 2000) continue; // العدو يظهر فقط عند إطلاقه النار
    mapCtx.fillStyle = friend ? '#6fa8ff' : '#ff5a47';
    mapCtx.beginPath(); mapCtx.arc(mp(r.g.position.x), mp(r.g.position.z), 3, 0, 7); mapCtx.fill();
  }
  mapCtx.save();
  mapCtx.translate(mp(me.x), mp(me.z)); mapCtx.rotate(-me.yaw);
  mapCtx.fillStyle = '#fff';
  mapCtx.beginPath(); mapCtx.moveTo(0, -6); mapCtx.lineTo(4, 4); mapCtx.lineTo(-4, 4); mapCtx.fill();
  mapCtx.restore();
}

// ================= القتال =================
function switchWeapon(i) {
  if (i === cur || !me.alive) return;
  cur = i; reloadEnd = 0; triggerUsed = true; lastShot = performance.now() - 60000 / WEAPONS[i].rpm + 350; // مهلة سحب السلاح
  updateHud();
}
function startReload() {
  if (reloadEnd || ammo[cur] >= WEAPONS[cur].mag || !me.alive) return;
  reloadEnd = performance.now() + WEAPONS[cur].reload * 1000;
  blip(300, 0.08, 0.05);
  updateHud();
}
const dir = new THREE.Vector3(), end = new THREE.Vector3(), muzzle = new THREE.Vector3();
function shoot(now) {
  const wp = WEAPONS[cur];
  if (reloadEnd || now - lastShot < 60000 / wp.rpm || (!wp.auto && triggerUsed)) return;
  triggerUsed = true;
  if (ammo[cur] <= 0) { startReload(); return; }
  lastShot = now; ammo[cur]--;
  const speed = Math.hypot(me.vx, me.vz);
  const sp = THREE.MathUtils.lerp(wp.spread, wp.adsSpread, adsT) * (1 + speed * 0.25) * (me.grounded ? 1 : 2.5) * (me.crouch ? 0.7 : 1);
  dir.set((Math.random() - 0.5) * 2 * sp, (Math.random() - 0.5) * 2 * sp, -1).normalize().applyQuaternion(camera.quaternion);
  const o = camera.position;
  let best = rayBoxes(o, dir, wp.range), victim = null, head = false;
  for (const r of remotes.values()) {
    if (!r.alive || r.team === me.team) continue;
    const h = rayPlayer(o, dir, r.g.position, r.crouch);
    if (h && h.t < best) { best = h.t; victim = r; head = h.head; }
  }
  end.copy(o).addScaledVector(dir, best);
  if (victim) {
    send({ t: 'hit', id: victim.id, h: head ? 1 : 0 });
    $('hitm').className = 'hud' + (head ? ' head' : ''); pulse($('hitm'), 1, 250);
    blip(head ? 1500 : 1000, 0.12, 0.05);
  } else if (best < wp.range) spark(end);
  muzzle.set(0.18 * (1 - adsT), -0.14, -0.9).applyMatrix4(camera.matrixWorld);
  tracer(muzzle.clone(), end.clone());
  send({ t: 'shot', o: muzzle.toArray().map(v => +v.toFixed(2)), e: end.toArray().map(v => +v.toFixed(2)) });
  gunSound(0.35, cur);
  kick += wp.recoil * (1 - adsT * 0.3); me.yaw += (Math.random() - 0.5) * wp.recoil * 0.7; gunKick = 1;
  flash.position.set(0, 0.012, guns[cur].userData.muzzle - 0.05);
  flash.rotation.z = Math.random() * 6.28; flash.visible = true;
  setTimeout(() => (flash.visible = false), 45);
  if (ammo[cur] === 0) setTimeout(startReload, 250);
  updateHud();
}

// ================= الإدخال =================
const locked = () => isTouch || document.pointerLockElement === canvas;
addEventListener('keydown', e => {
  if (!playing || e.target === $('name')) return;
  keys[e.code] = true;
  if (e.code === 'Tab') { e.preventDefault(); $('board').style.display = 'flex'; }
  if (e.code === 'KeyR') startReload();
  if (e.code === 'Digit1') switchWeapon(0);
  if (e.code === 'Digit2') switchWeapon(1);
  if (e.code === 'Digit3') switchWeapon(2);
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Tab') $('board').style.display = 'none';
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing = false; adsHeld = false; });
function look(dx, dy, sens) {
  const s = sens / THREE.MathUtils.lerp(1, WEAPONS[cur].zoom, adsT);
  me.yaw -= dx * s;
  me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch - dy * s));
}
if (!isTouch) {
  canvas.addEventListener('mousedown', e => {
    if (!playing || matchOver) return;
    if (!locked()) { canvas.requestPointerLock(); return; }
    if (e.button === 0) { firing = true; triggerUsed = false; }
    if (e.button === 2) adsHeld = true;
  });
  addEventListener('mouseup', e => { if (e.button === 0) firing = false; if (e.button === 2) adsHeld = false; });
  addEventListener('mousemove', e => { if (playing && locked() && me.alive) look(e.movementX, e.movementY, 0.0022); });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => { if (playing && locked()) switchWeapon((cur + (e.deltaY > 0 ? 1 : 2)) % 3); });
  document.addEventListener('pointerlockchange', () => {
    $('hint').style.display = playing && !locked() && !matchOver ? 'block' : 'none';
    if (!locked()) { firing = false; adsHeld = false; }
  });
} else {
  document.body.classList.add('touch');
  $('touch').style.display = 'block';
  const opt = { passive: false };
  const joy = $('joy'), knob = $('knob');
  const joyMove = e => {
    e.preventDefault();
    const t = e.targetTouches[0], r = joy.getBoundingClientRect();
    let x = (t.clientX - r.left - 65) / 50, y = (t.clientY - r.top - 65) / 50;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    touch.jx = x; touch.jy = y;
    knob.style.transform = `translate(${x * 45}px, ${y * 45}px)`;
  };
  const joyEnd = e => { e.preventDefault(); touch.jx = touch.jy = 0; knob.style.transform = ''; };
  joy.addEventListener('touchstart', joyMove, opt); joy.addEventListener('touchmove', joyMove, opt);
  joy.addEventListener('touchend', joyEnd, opt); joy.addEventListener('touchcancel', joyEnd, opt);

  // السحب على الشاشة (أو على زر الإطلاق) يدير الكاميرا
  const lookers = new Map();
  const lookStart = e => { e.preventDefault(); for (const t of e.changedTouches) lookers.set(t.identifier, [t.clientX, t.clientY]); };
  const lookMove = e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const p = lookers.get(t.identifier); if (!p) continue;
      if (me.alive) look(t.clientX - p[0], t.clientY - p[1], 0.005);
      p[0] = t.clientX; p[1] = t.clientY;
    }
  };
  const lookEnd = e => { for (const t of e.changedTouches) lookers.delete(t.identifier); };
  for (const el of [canvas, $('bFire')]) {
    el.addEventListener('touchstart', lookStart, opt); el.addEventListener('touchmove', lookMove, opt);
    el.addEventListener('touchend', lookEnd, opt); el.addEventListener('touchcancel', lookEnd, opt);
  }
  const hold = (id, down, up) => {
    const el = $(id);
    el.addEventListener('touchstart', e => { e.preventDefault(); down(el); }, opt);
    if (up) for (const ev of ['touchend', 'touchcancel']) el.addEventListener(ev, e => { e.preventDefault(); up(el); }, opt);
  };
  hold('bFire', () => { firing = true; triggerUsed = false; }, () => (firing = false));
  hold('bJump', () => (touch.jump = true), () => (touch.jump = false));
  hold('bAds', el => { adsHeld = !adsHeld; el.classList.toggle('on', adsHeld); });
  hold('bCrouch', el => { touch.crouch = !touch.crouch; el.classList.toggle('on', touch.crouch); });
  hold('bReload', startReload);
  hold('bSwap', () => switchWeapon((cur + 1) % 3));
  hold('bBoard', () => ($('board').style.display = 'flex'), () => ($('board').style.display = 'none'));
}

$('name').value = localStorage.getItem('name') || '';
$('play').addEventListener('click', () => {
  if (ws) return;
  const name = $('name').value.trim();
  try { localStorage.setItem('name', name); } catch {}
  initAudio();
  connect(name);
  if (!isTouch) canvas.requestPointerLock?.();
});
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') $('play').click(); });

// ================= الحلقة =================
function updatePlayer(dt, now) {
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - touch.jy;
  let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.jx;
  const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
  const wantCrouch = !!(keys.KeyC || keys.ControlLeft || touch.crouch);
  // لا تقف إن كان فوقك سقف
  me.crouch = wantCrouch || (me.crouch && !!collides(me.x, me.y, me.z, PLAYER.h));
  const sprint = (keys.ShiftLeft || keys.ShiftRight || (isTouch && len > 0.92)) && f > 0.5 && !adsHeld && !me.crouch;
  const speed = me.crouch ? 2.6 : sprint ? 7.6 : adsHeld ? 3.2 : 5;
  const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
  const wx = (-sin * f + cos * s) * speed, wz = (-cos * f - sin * s) * speed;
  const a = Math.min(1, (me.grounded ? 12 : 2.5) * dt);
  me.vx += (wx - me.vx) * a; me.vz += (wz - me.vz) * a;
  if (me.grounded && (keys.Space || touch.jump) && !me.crouch) { me.vy = 7; me.grounded = false; }
  me.vy -= 20 * dt;
  const res = move(me, me.vx * dt, me.vy * dt, me.vz * dt, me.crouch ? PLAYER.hc : PLAYER.h);
  me.grounded = res.ground;
  if (res.ground || res.head) me.vy = Math.min(0, res.ground ? 0 : me.vy);

  if (reloadEnd && now >= reloadEnd) { ammo[cur] = WEAPONS[cur].mag; reloadEnd = 0; updateHud(); }
  if (firing && locked()) shoot(now);
  if (sprint) bob += dt * 12; else bob += dt * Math.hypot(me.vx, me.vz) * 1.6;
}

let last = performance.now(), sendAcc = 0, hudAcc = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (playing) {
    if (me.alive && !matchOver) updatePlayer(dt, now);
    const ads = adsHeld && me.alive && !reloadEnd;
    adsT += ((ads ? 1 : 0) - adsT) * Math.min(1, 14 * dt);
    kick *= Math.exp(-9 * dt); gunKick *= Math.exp(-14 * dt);
    eyeH += ((me.crouch ? PLAYER.eyeC : PLAYER.eye) - eyeH) * Math.min(1, 12 * dt);

    camera.position.set(me.x, me.y + (me.alive ? eyeH : 0.4), me.z);
    camera.rotation.set(me.pitch + kick, me.yaw, me.alive ? 0 : 0.5);
    const fov = BASE_FOV / THREE.MathUtils.lerp(1, WEAPONS[cur].zoom, adsT);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

    // السلاح
    const scoped = cur === 1 && adsT > 0.85;
    $('scope').style.display = scoped ? 'block' : 'none';
    guns.forEach((g, i) => (g.visible = i === cur && me.alive && !scoped));
    const moving = Math.min(1, Math.hypot(me.vx, me.vz) / 5) * (1 - adsT * 0.85);
    const reloadDip = reloadEnd ? Math.sin(Math.min(1, (reloadEnd - now) / 400) * Math.PI / 2) * 0.12 : 0;
    gunHolder.position.set(
      THREE.MathUtils.lerp(0.17, 0, adsT) + Math.cos(bob) * 0.008 * moving,
      THREE.MathUtils.lerp(-0.17, cur === 1 ? -0.075 : -0.07, adsT) + Math.abs(Math.sin(bob)) * 0.01 * moving - reloadDip,
      THREE.MathUtils.lerp(-0.62, -0.42, adsT) + gunKick * 0.05
    );
    gunHolder.rotation.set(gunKick * 0.06 - reloadDip * 2, 0, 0);
    const gap = 6 + Math.hypot(me.vx, me.vz) * 2.2 + kick * 250 + (me.grounded ? 0 : 12);
    $('cross').style.setProperty('--g', gap + 'px');
    $('cross').style.opacity = adsT > 0.5 || !me.alive ? 0 : 1;

    // اللاعبون الآخرون
    const k = 1 - Math.exp(-14 * dt);
    for (const r of remotes.values()) {
      const p = r.g.position;
      const lag = Math.hypot(r.tx - p.x, r.tz - p.z);
      p.x += (r.tx - p.x) * k; p.y += (r.ty - p.y) * k; p.z += (r.tz - p.z) * k;
      let dy = r.tyaw - r.g.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      r.g.rotation.y += dy * k;
      r.g.rotation.x += ((r.alive ? 0 : -Math.PI / 2) - r.g.rotation.x) * Math.min(1, 8 * dt);
      const c = r.crouch && r.alive ? 1 : 0;
      if (r.mixer) {
        r.model.scale.y += ((c ? 0.72 : 1) - r.model.scale.y) * k;
        if (r.alive) {
          const anim = lag * 14 > 3.4 ? 'Run' : lag * 14 > 0.5 ? 'Walk' : 'Idle';
          for (const n in r.actions) {
            const a = r.actions[n];
            a.setEffectiveWeight(a.getEffectiveWeight() + ((n === anim ? 1 : 0) - a.getEffectiveWeight()) * Math.min(1, 10 * dt));
          }
          r.mixer.update(dt);
        }
      } else {
        r.upper.position.y += (-0.45 * c - r.upper.position.y) * k;
        r.legs.scale.y += ((c ? 0.45 : 1) - r.legs.scale.y) * k;
      }
    }

    sendAcc += dt;
    if (sendAcc >= 0.05 && me.alive) {
      sendAcc = 0;
      send({ t: 'st', x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), c: me.crouch ? 1 : 0, w: cur });
    }
    hudAcc += dt;
    if (hudAcc >= 0.1) { hudAcc = 0; updateHud(); drawMap(now); }
  } else {
    // كاميرا استعراضية خلف القائمة
    const t = now / 9000;
    camera.position.set(Math.cos(t) * 55, 22, Math.sin(t) * 55);
    camera.lookAt(0, 2, 0);
  }

  for (let i = fx.length - 1; i >= 0; i--) {
    const e = fx[i];
    e.t -= dt;
    if (e.t <= 0) {
      scene.remove(e.o); e.o.material.dispose(); if (e.o.isLine) e.o.geometry.dispose();
      fx.splice(i, 1);
    } else {
      e.o.material.opacity = e.t / e.max;
      if (e.grow) e.o.scale.setScalar(1 + (1 - e.t / e.max) * 2);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__game = { me, remotes, keys, get ammo() { return ammo; } }; // للفحص من أدوات المطوّر
