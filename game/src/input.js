// Keyboard and touch input, merged into one state object the game reads.

export const input = {
  turn: 0,          // -1 left .. 1 right (keyboard)
  throttle: 0,      // -1 slower .. 1 faster (keyboard)
  stick: null,      // { angle, mag } while the touch stick is held
  fire: false,      // held
  missile: false,   // pressed this frame (consumed by the game)
  flare: false,     // pressed this frame
  zoom: 0,          // +1 / -1 pressed this frame
  pause: false,     // pressed this frame
  touchUsed: false,
};

const keys = new Set();

function refreshKeys() {
  const has = (...k) => k.some(x => keys.has(x));
  input.turn = (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0);
  input.throttle = (has('ArrowUp', 'KeyW') ? 1 : 0) - (has('ArrowDown', 'KeyS') ? 1 : 0);
  input.fire = has('Space') || touchFire;
}

let touchFire = false;

export function setupInput(onFirstGesture) {
  const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement) return;
    onFirstGesture();
    if (gameKeys.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyF' || e.code === 'Enter') input.missile = true;
    if (e.code === 'KeyQ' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.flare = true;
    if (e.code === 'Equal' || e.code === 'NumpadAdd') input.zoom = 1;
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') input.zoom = -1;
    if (e.code === 'KeyP' || e.code === 'Escape') input.pause = true;
    refreshKeys();
  });
  addEventListener('keyup', e => { keys.delete(e.code); refreshKeys(); });
  addEventListener('blur', () => { keys.clear(); touchFire = false; input.stick = null; refreshKeys(); });

  // Touch stick: the plane turns toward the direction the stick points,
  // and how far it is pushed sets the throttle.
  const zone = document.getElementById('stick-zone');
  const base = document.getElementById('stick-base');
  const knob = document.getElementById('stick-knob');
  let stickId = null, cx = 0, cy = 0;
  const R = 56;
  zone.addEventListener('pointerdown', e => {
    onFirstGesture();
    input.touchUsed = true;
    stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect();
    cx = e.clientX - r.left; cy = e.clientY - r.top;
    base.style.left = cx + 'px'; base.style.top = cy + 'px';
    base.classList.add('active');
    moveStick(e);
  });
  const moveStick = e => {
    if (e.pointerId !== stickId) return;
    const r = zone.getBoundingClientRect();
    let dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.stick = d > 8 ? { angle: Math.atan2(dy, dx), mag: Math.min(1, d / R) } : null;
  };
  zone.addEventListener('pointermove', moveStick);
  const endStick = e => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    input.stick = null;
    knob.style.transform = '';
    base.classList.remove('active');
  };
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);

  const hold = (id, on, off) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); onFirstGesture(); input.touchUsed = true; el.classList.add('down'); on(); });
    const up = () => { el.classList.remove('down'); off && off(); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  };
  hold('btn-gun', () => { touchFire = true; refreshKeys(); }, () => { touchFire = false; refreshKeys(); });
  hold('btn-msl', () => { input.missile = true; });
  hold('btn-flr', () => { input.flare = true; });
  hold('btn-zin', () => { input.zoom = 1; });
  hold('btn-zout', () => { input.zoom = -1; });

  document.addEventListener('contextmenu', e => { if (e.target.closest('#touch')) e.preventDefault(); });
}

export function consumeEdges() {
  input.missile = false; input.flare = false; input.zoom = 0; input.pause = false;
}

export function resetInput() {
  keys.clear(); touchFire = false; input.stick = null; consumeEdges(); refreshKeys();
}
