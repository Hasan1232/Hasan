// Menus, HUD, saving and the main loop.

import { loadWorld } from './geo.js';
import { loadCities } from './scenery.js';
import { LANGS, detectLang, setLang, getLang, t, countryName, flag } from './i18n.js';
import { input, setupInput, consumeEdges, resetInput } from './input.js';
import { createWar, update, nearbyCountries, SPEED_SCALE } from './game.js';
import { setupCanvas, draw, drawMenuBackdrop, changeZoom, cam } from './render.js';
import { initAudio, setSound, sfx, engineHum } from './audio.js';

const SAVE_KEY = 'skyfront.v1';
const save = load();
function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

save.speed = save.speed && SPEED_SCALE[save.speed] ? save.speed : 'medium';
save.sound = save.sound !== false;
setLang(detectLang(save.lang));
setSound(save.sound);

const $ = id => document.getElementById(id);
const screenEl = $('screen');
let world = null;
let cities = [];
let war = null;
let mode = 'loading'; // loading | menu | play | paused | over
let pick = { home: null, enemy: null };
let audioReady = false;

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

setupCanvas($('game'));
setupInput(() => { if (!audioReady) { initAudio(); audioReady = true; } });
$('btn-pause').addEventListener('click', () => pauseGame());

// ---------------------------------------------------------------- screens

function h(html) { screenEl.innerHTML = html; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function on(id, fn) { const el = $(id); if (el) el.addEventListener('click', () => { sfx.ui(); fn(); }); }

function translateStatic() {
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  document.title = t('title');
}

function showMenu() {
  mode = 'menu';
  hideGameUi();
  const camp = save.campaign;
  const hasCamp = camp && camp.home && world.byCode.has(camp.home);
  h(`<div class="panel">
    <h1>✈ ${esc(t('title'))}</h1>
    <p class="sub">${esc(t('subtitle'))}</p>
    ${hasCamp ? `<button class="btn primary" id="m-continue">${flag(camp.home)} ${esc(t('continue'))} — ${esc(countryName(camp.home))}
      <div style="font-weight:400;font-size:13px;opacity:.8">${esc(t('conquered', { n: (camp.conquered || []).length }))} · ${esc(t('score'))} ${camp.score || 0}</div></button>` : ''}
    <button class="btn ${hasCamp ? '' : 'primary'}" id="m-new">${esc(t('play'))}</button>
    <div class="row">
      <button class="btn" id="m-settings">${esc(t('settings'))}</button>
      <button class="btn" id="m-controls">${esc(t('controls'))}</button>
    </div>
    ${langPicker()}
  </div>`);
  on('m-new', () => showPickHome());
  on('m-continue', () => { pick.home = camp.home; showPickEnemy(); });
  on('m-settings', () => showSettings(showMenu));
  on('m-controls', () => showControls(showMenu));
  bindLangPicker(showMenu);
}

function langPicker() {
  return `<div class="field-label">${esc(t('language'))}</div><div class="seg">${Object.entries(LANGS).map(([k, v]) =>
    `<button class="btn ${k === getLang() ? 'on' : ''}" data-lang="${k}">${esc(v.name)}</button>`).join('')}</div>`;
}
function bindLangPicker(redraw) {
  screenEl.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    setLang(b.dataset.lang); save.lang = b.dataset.lang; persist(); translateStatic(); sfx.ui(); redraw();
  }));
}

function showSettings(back) {
  h(`<div class="panel">
    <h2>${esc(t('settings'))}</h2>
    ${langPicker()}
    <div class="field-label">${esc(t('gameSpeed'))}</div>
    <div class="seg">${['slow', 'medium', 'fast'].map(k => `<button class="btn ${save.speed === k ? 'on' : ''}" data-speed="${k}">${esc(t(k))}</button>`).join('')}</div>
    <div class="field-label">${esc(t('sound'))}</div>
    <div class="seg">
      <button class="btn ${save.sound ? 'on' : ''}" data-sound="1">${esc(t('on'))}</button>
      <button class="btn ${save.sound ? '' : 'on'}" data-sound="0">${esc(t('off'))}</button>
    </div>
    <button class="btn primary" id="s-back">${esc(t('back'))}</button>
  </div>`);
  bindLangPicker(() => showSettings(back));
  screenEl.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { save.speed = b.dataset.speed; persist(); sfx.ui(); showSettings(back); }));
  screenEl.querySelectorAll('[data-sound]').forEach(b => b.addEventListener('click', () => { save.sound = b.dataset.sound === '1'; setSound(save.sound); persist(); sfx.ui(); showSettings(back); }));
  on('s-back', back);
}

function controlsHtml() {
  return `<div class="tips">
    <p>${esc(t(isTouch ? 'controlsMobile' : 'controlsDesktop'))}</p>
    <p>${esc(t(isTouch ? 'controlsDesktop' : 'controlsMobile'))}</p>
    <p>${esc(t('controlsTips'))}</p>
  </div>`;
}

function showControls(back) {
  h(`<div class="panel"><h2>${esc(t('controls'))}</h2>${controlsHtml()}<button class="btn primary" id="c-back">${esc(t('back'))}</button></div>`);
  on('c-back', back);
}

const collator = () => new Intl.Collator(getLang());
const selectable = () => world.countries.filter(c => c.code !== 'AQ' && c.area > 0.05);

function countryList(listEl, items, onPick, metaFn) {
  listEl.innerHTML = items.map(c => `<button data-code="${c.code}"><span class="flag">${flag(c.code)}</span><span>${esc(countryName(c.code))}</span>${metaFn ? `<span class="meta">${metaFn(c)}</span>` : ''}</button>`).join('');
  listEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { sfx.ui(); onPick(b.dataset.code); }));
}

function searchable(all, onPick, metaFn) {
  const coll = collator();
  const sorted = [...all].sort((a, b) => coll.compare(countryName(a.code), countryName(b.code)));
  const listEl = $('list');
  const norm = s => s.toLocaleLowerCase(getLang()).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const render = q => {
    const nq = norm(q.trim());
    countryList(listEl, nq ? sorted.filter(c => norm(countryName(c.code)).includes(nq) || c.code.toLowerCase() === nq) : sorted, onPick, metaFn);
  };
  $('search').addEventListener('input', e => render(e.target.value));
  render('');
}

function showPickHome() {
  h(`<div class="panel" style="height:min(640px,100%)">
    <h2>${esc(t('chooseCountry'))}</h2>
    <input type="search" id="search" placeholder="${esc(t('search'))}" autocomplete="off">
    <div class="list" id="list"></div>
    <div class="row"><button class="btn" id="p-back">${esc(t('back'))}</button><button class="btn" id="p-rand">🎲 ${esc(t('random'))}</button></div>
  </div>`);
  const all = selectable();
  const choose = code => { pick.home = code; save.campaign = { home: code, conquered: [], score: 0 }; persist(); showPickEnemy(); };
  searchable(all, choose);
  on('p-back', showMenu);
  on('p-rand', () => choose(all[Math.random() * all.length | 0].code));
}

function showPickEnemy() {
  const done = new Set(save.campaign?.conquered || []);
  const near = nearbyCountries(world, pick.home, 8, done);
  const homeC = world.byCode.get(pick.home);
  const km = c => Math.round(Math.hypot(c.label.x - homeC.label.x, c.label.y - homeC.label.y) * 111).toLocaleString(getLang()) + ' km';
  h(`<div class="panel" style="height:min(680px,100%)">
    <h2>${flag(pick.home)} ${esc(t('chooseEnemy'))}</h2>
    <input type="search" id="search" placeholder="${esc(t('search'))}" autocomplete="off">
    <div class="list">
      <div class="section-title">${esc(t('suggested'))}</div>
      <div id="near"></div>
      <div class="section-title">${esc(t('allCountries'))}</div>
      <div id="list"></div>
    </div>
    <div class="row"><button class="btn" id="p-back">${esc(t('back'))}</button><button class="btn" id="p-rand">🎲 ${esc(t('random'))}</button></div>
  </div>`);
  const choose = code => { pick.enemy = code; showBriefing(); };
  countryList($('near'), near, choose, km);
  const all = selectable().filter(c => c.code !== pick.home);
  searchable(all, choose, c => done.has(c.code) ? '<span class="done">✔</span>' : '');
  on('p-back', showMenu);
  on('p-rand', () => choose(near[Math.random() * near.length | 0].code));
}

function showBriefing() {
  war = createWar(world, pick.home, pick.enemy, save.campaign);
  war.cities = cities;
  cam.ready = false;
  h(`<div class="panel">
    <div class="versus">
      <div class="side"><span class="big-flag">${flag(pick.home)}</span>${esc(countryName(pick.home))}</div>
      <div class="vs">⚔</div>
      <div class="side"><span class="big-flag">${flag(pick.enemy)}</span>${esc(countryName(pick.enemy))}</div>
    </div>
    <div class="callout"><b>${esc(t('warDeclared', { a: countryName(pick.home), b: countryName(pick.enemy) }))}</b><br>${esc(t('objective', { n: war.totalTargets }))}</div>
    ${controlsHtml()}
    <div class="field-label">${esc(t('gameSpeed'))}</div>
    <div class="seg">${['slow', 'medium', 'fast'].map(k => `<button class="btn ${save.speed === k ? 'on' : ''}" data-speed="${k}">${esc(t(k))}</button>`).join('')}</div>
    <div class="row"><button class="btn" id="b-back">${esc(t('back'))}</button><button class="btn primary" id="b-go">✈ ${esc(t('start'))}</button></div>
  </div>`);
  screenEl.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
    save.speed = b.dataset.speed; persist(); sfx.ui();
    screenEl.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b));
  }));
  on('b-back', showPickEnemy);
  on('b-go', startPlay);
}

function startPlay() {
  if (!audioReady) { initAudio(); audioReady = true; }
  h('');
  resetInput();
  mode = 'play';
  $('hud').hidden = false;
  $('touch').hidden = !(isTouch || input.touchUsed);
  translateStatic();
}

function hideGameUi() {
  $('hud').hidden = true;
  $('touch').hidden = true;
  engineHum(0, false);
}

function pauseGame() {
  if (mode !== 'play') return;
  mode = 'paused';
  engineHum(0, false);
  $('touch').hidden = true;
  h(`<div class="panel">
    <h2>${esc(t('paused'))}</h2>
    <button class="btn primary" id="x-resume">${esc(t('resume'))}</button>
    <button class="btn" id="x-settings">${esc(t('settings'))}</button>
    <button class="btn" id="x-controls">${esc(t('controls'))}</button>
    <button class="btn danger" id="x-quit">${esc(t('quit'))}</button>
  </div>`);
  on('x-resume', startPlay);
  on('x-settings', () => showSettings(() => { mode = 'play'; pauseGame(); }));
  on('x-controls', () => showControls(() => { mode = 'play'; pauseGame(); }));
  on('x-quit', showMenu);
}

function showEnd(won) {
  mode = 'over';
  hideGameUi();
  if (won) {
    save.campaign = { home: war.home.code, conquered: [...war.conquered], score: war.score };
    persist();
  }
  const name = countryName(war.enemy.code);
  h(`<div class="panel">
    <h1>${won ? '🏆 ' + esc(t('victory')) : esc(t('defeat'))}</h1>
    <p class="sub">${esc(won ? t('victoryText', { b: name }) : t('defeatText'))}</p>
    <div class="stats-line">
      <div><b>${war.score.toLocaleString(getLang())}</b>${esc(t('score'))}</div>
      <div><b>${war.conquered.size}</b>${esc(t('conquered', { n: '' }).replace(/[:：]\s*$/, ''))}</div>
    </div>
    ${won ? `<button class="btn primary" id="e-next">${esc(t('nextWar'))}</button>` : `<button class="btn primary" id="e-retry">${esc(t('retry'))}</button>`}
    <button class="btn" id="e-menu">${esc(t('quit'))}</button>
  </div>`);
  on('e-next', () => { pick.home = war.home.code; showPickEnemy(); });
  on('e-retry', () => { pick.home = war.home.code; pick.enemy = war.enemy.code; showBriefing(); });
  on('e-menu', showMenu);
}

// ---------------------------------------------------------------- HUD

const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
let lastMsgCount = 0, lastMsgTime = -1;

function updateHud(s) {
  const p = s.player;
  const hp = Math.max(0, p.hp);
  const fill = $('hp-fill');
  const w = hp.toFixed(0) + '%';
  if (hudCache.hp !== w) {
    hudCache.hp = w; fill.style.width = w;
    fill.style.background = hp > 60 ? 'var(--ok)' : hp > 30 ? 'var(--warn)' : 'var(--danger)';
  }
  setText('st-msl', String(p.msl));
  setText('st-flr', String(p.flr));
  setText('st-lives', String(s.lives));
  setText('st-tg', `${s.remaining ?? s.totalTargets}/${s.totalTargets}`);
  setText('st-score', s.score.toLocaleString(getLang()));
  setText('over-label', s.over ? `${flag(s.over.code)} ${countryName(s.over.code)}` : '🌊 ' + t('ocean'));
  $('warn-missile').hidden = !s.warn.missile;
  setText('warn-missile', t('missileWarning'));
  $('warn-radar').hidden = !s.warn.radar || s.warn.missile;
  setText('warn-radar', '◎ ' + t('radarLock'));

  const banner = $('banner');
  let b = '', bad = false;
  if (s.repairing && p.alive && (p.hp < 100 || p.msl < 6 || p.flr < 8)) b = '🔧 ' + t('repairing');
  else if (p.alive && p.hp < 35) { b = '⚠ ' + t('returnHome'); bad = true; }
  banner.hidden = !b; setText('banner', b); banner.classList.toggle('bad', bad);

  // New kill / loss messages become toasts.
  const fresh = s.msgs.filter(m => m.t > lastMsgTime);
  for (const m of fresh) {
    const el = document.createElement('div');
    el.className = 'toast' + (m.bad ? ' bad' : '');
    el.textContent = m.key === 'destroyed' ? '💥 ' + t('destroyed', { x: t(m.item) }) : t(m.key);
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2600);
    lastMsgTime = Math.max(lastMsgTime, m.t);
  }
  lastMsgCount = s.msgs.length;
}

// ---------------------------------------------------------------- loop

let last = performance.now(), menuTime = 0, warnBeep = 0;

function frame(now) {
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  menuTime += raw;

  if (world) {
    if (mode === 'play' && war) {
      if (input.pause) pauseGame();
      if (input.zoom) changeZoom(input.zoom);
      const dt = raw * SPEED_SCALE[save.speed];
      update(war, dt, input);
      consumeEdges();
      draw(war, war.time);
      updateHud(war);
      engineHum(war.player.alive ? war.player.thr : 0, war.player.alive);
      warnBeep -= raw;
      if ((war.warn.missile || war.warn.radar) && warnBeep <= 0) { sfx.warn(); warnBeep = war.warn.missile ? 0.25 : 1.2; }
      if (war.phase === 'won' || war.phase === 'lost') showEnd(war.phase === 'won');
    } else if ((mode === 'paused' || mode === 'over') && war) {
      consumeEdges();
      draw(war, war.time);
    } else {
      consumeEdges();
      drawMenuBackdrop(world, { home: pick.home || save.campaign?.home, conquered: new Set(save.campaign?.conquered || []) }, menuTime);
    }
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

translateStatic();
h(`<div class="panel"><h1>✈ ${esc(t('title'))}</h1><p class="sub">…</p></div>`);
requestAnimationFrame(frame);

loadWorld('data/countries.json')
  .then(async w => {
    try { cities = await loadCities('data/cities.json', w); } catch { cities = []; }
    world = w; window.__skyfront = { get war() { return war; }, world }; showMenu(); })
  .catch(err => h(`<div class="panel"><h2>⚠</h2><p>${esc(err.message)}</p></div>`));
