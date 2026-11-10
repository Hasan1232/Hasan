// Tiny synthesized sound effects (no audio files to download).

let ctx = null, master = null, noiseBuf = null, engine = null, enabled = true;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.5 : 0;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setSound(on) {
  enabled = on;
  if (master) master.gain.value = on ? 0.5 : 0;
}

function noise(dur, freq, vol, type = 'lowpass') {
  if (!ctx || !enabled) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, dur);
}

function tone(freq, dur, vol, type = 'square') {
  if (!ctx || !enabled) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur);
}

export const sfx = {
  gun: () => noise(0.06, 2500, 0.18, 'bandpass'),
  missile: () => noise(0.7, 900, 0.35),
  flare: () => noise(0.25, 4000, 0.15, 'highpass'),
  boom: (big) => noise(big ? 1.4 : 0.6, big ? 300 : 600, big ? 0.9 : 0.5),
  hit: () => tone(180, 0.08, 0.15, 'sawtooth'),
  lock: () => tone(1320, 0.07, 0.08),
  warn: () => tone(880, 0.12, 0.12),
  ui: () => tone(660, 0.05, 0.06, 'triangle'),
};

export function engineHum(throttle, on) {
  if (!ctx) return;
  if (!engine) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(f).connect(g).connect(master);
    o.start();
    engine = { o, g, f };
  }
  const t = ctx.currentTime;
  engine.o.frequency.setTargetAtTime(60 + throttle * 70, t, 0.2);
  engine.f.frequency.setTargetAtTime(300 + throttle * 500, t, 0.2);
  engine.g.gain.setTargetAtTime(on && enabled ? 0.04 + throttle * 0.04 : 0, t, 0.15);
}
