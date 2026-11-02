// Synthesised audio: one-shot SFX and controllable loops (no audio files needed).
(() => {
'use strict';
const A = G.audio = {};
let ctx = null, master, out, nb, amb = null;

A.init = () => {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  A.ctx = ctx;
  master = ctx.createGain();
  master.gain.value = G.save.settings.vol;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ctx.destination);
  out = ctx.createGain(); out.connect(master);
  // Cheap generated reverb for the hallway feel.
  const conv = ctx.createConvolver();
  const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  conv.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.22;
  out.connect(conv); conv.connect(wet); wet.connect(master);
  nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
};
A.setVol = v => { if (master) master.gain.value = v; };

function env(g, t, a, peak, dcy) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
}
function noise({ dur = 0.2, f = 1000, f2 = null, q = 1, type = 'bandpass', vol = 0.3, a = 0.005, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + dur);
  fl.Q.value = q;
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  s.connect(fl); fl.connect(g); g.connect(A._route || out);
  s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05);
}
function tone({ f = 440, f2 = null, dur = 0.2, type = 'sine', vol = 0.2, a = 0.005, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dur);
  const g = ctx.createGain(); env(g, t, a, vol, dur);
  o.connect(g); g.connect(A._route || out);
  o.start(t); o.stop(t + a + dur + 0.05);
}

const SFX = {
  step: o => noise({ dur: 0.07, f: o.surface === 'dirt' ? 260 : o.surface === 'grass' ? 1800 : o.surface === 'metal' ? 1400 : 520, q: 0.8, vol: o.crouch ? 0.03 : 0.09 }),
  door: () => { tone({ f: 190, f2: 120, dur: 0.55, type: 'sawtooth', vol: 0.025, a: 0.05 }); noise({ dur: 0.18, f: 160, q: 1, vol: 0.35 }); noise({ dur: 0.4, f: 900, f2: 500, q: 6, vol: 0.05, delay: 0.05 }); },
  slam: () => { noise({ dur: 0.5, f: 110, q: 0.7, vol: 0.9, type: 'lowpass' }); tone({ f: 70, f2: 40, dur: 0.4, vol: 0.4 }); },
  drawer: () => noise({ dur: 0.28, f: 900, f2: 380, q: 2, vol: 0.14 }),
  pickup: () => { tone({ f: 880, dur: 0.08, type: 'triangle', vol: 0.12 }); tone({ f: 1320, dur: 0.12, type: 'triangle', vol: 0.1, delay: 0.07 }); },
  gold: () => { [1300, 1700, 2200].forEach((f, i) => tone({ f, dur: 0.12, type: 'triangle', vol: 0.08, delay: i * 0.05 })); },
  locked: () => { noise({ dur: 0.06, f: 2400, q: 4, vol: 0.2 }); noise({ dur: 0.06, f: 2000, q: 4, vol: 0.2, delay: 0.09 }); },
  unlock: () => { noise({ dur: 0.05, f: 3000, q: 5, vol: 0.25 }); tone({ f: 600, f2: 900, dur: 0.1, type: 'square', vol: 0.04, delay: 0.08 }); },
  hurt: () => { noise({ dur: 0.25, f: 300, q: 0.6, vol: 0.5, type: 'lowpass' }); tone({ f: 110, f2: 50, dur: 0.3, vol: 0.35 }); },
  psst: () => { noise({ dur: 0.12, f: 5500, q: 1.5, vol: 0.35, type: 'highpass' }); noise({ dur: 0.18, f: 5000, q: 1.5, vol: 0.3, type: 'highpass', delay: 0.22 }); },
  attack: () => { tone({ f: 1400, f2: 500, dur: 0.6, type: 'sawtooth', vol: 0.3 }); noise({ dur: 0.6, f: 2500, q: 0.5, vol: 0.6 }); },
  jumpscare: () => {
    noise({ dur: 0.9, f: 3000, q: 0.3, vol: 1, type: 'lowpass' });
    [220, 233, 311, 466].forEach(f => tone({ f, f2: f * 0.7, dur: 0.8, type: 'sawtooth', vol: 0.18 }));
  },
  flicker: () => { for (let i = 0; i < 6; i++) noise({ dur: 0.04, f: 3500, q: 6, vol: 0.12, delay: i * 0.09 + Math.random() * 0.05 }); },
  break: () => { noise({ dur: 0.25, f: 5000, q: 0.8, vol: 0.4, type: 'highpass' }); noise({ dur: 0.1, f: 800, q: 1, vol: 0.3 }); },
  heartbeat: () => { tone({ f: 55, dur: 0.12, vol: 0.6 }); tone({ f: 50, dur: 0.14, vol: 0.45, delay: 0.24 }); },
  good: () => { tone({ f: 660, dur: 0.1, type: 'triangle', vol: 0.12 }); tone({ f: 990, dur: 0.18, type: 'triangle', vol: 0.12, delay: 0.08 }); },
  bad: () => { tone({ f: 180, dur: 0.25, type: 'square', vol: 0.08 }); tone({ f: 120, dur: 0.3, type: 'square', vol: 0.08, delay: 0.12 }); },
  roar: () => { tone({ f: 80, f2: 45, dur: 1.6, type: 'sawtooth', vol: 0.35, a: 0.2 }); noise({ dur: 1.6, f: 400, f2: 150, q: 0.7, vol: 0.5, a: 0.2 }); },
  halt: () => { tone({ f: 330, f2: 300, dur: 1.2, type: 'sine', vol: 0.18, a: 0.2 }); tone({ f: 494, f2: 440, dur: 1.2, vol: 0.1, a: 0.3 }); },
  dupe: () => { tone({ f: 90, f2: 300, dur: 0.5, type: 'sawtooth', vol: 0.3 }); noise({ dur: 0.5, f: 700, q: 1, vol: 0.5 }); },
  snare: () => { noise({ dur: 0.12, f: 2000, q: 1, vol: 0.7 }); tone({ f: 200, f2: 80, dur: 0.2, type: 'square', vol: 0.2 }); },
  lever: () => { noise({ dur: 0.15, f: 1200, q: 3, vol: 0.3 }); noise({ dur: 0.12, f: 300, q: 1, vol: 0.4, delay: 0.15 }); },
  valve: () => noise({ dur: 0.4, f: 700, f2: 1400, q: 8, vol: 0.12 }),
  alarm: () => { for (let i = 0; i < 4; i++) { tone({ f: 880, dur: 0.25, type: 'square', vol: 0.07, delay: i * 0.5 }); tone({ f: 660, dur: 0.25, type: 'square', vol: 0.07, delay: i * 0.5 + 0.25 }); } },
  click: () => tone({ f: 1800, dur: 0.03, type: 'square', vol: 0.05 }),
  whoosh: () => noise({ dur: 0.6, f: 300, f2: 3000, q: 1, vol: 0.4, a: 0.1 }),
  static: () => noise({ dur: 0.7, f: 3000, q: 0.2, vol: 0.7 }),
  gulp: () => { tone({ f: 300, f2: 200, dur: 0.12, vol: 0.2 }); tone({ f: 300, f2: 200, dur: 0.12, vol: 0.2, delay: 0.2 }); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone({ f, dur: 0.6, type: 'triangle', vol: 0.12, delay: i * 0.18 })); },
  bell: () => { tone({ f: 2100, dur: 1.2, vol: 0.12 }); tone({ f: 4200, dur: 0.6, vol: 0.04 }); },
  splash: () => noise({ dur: 1.5, f: 1200, f2: 300, q: 0.5, vol: 0.6, a: 0.05 }),
};
A.sfx = (name, o = {}) => { if (ctx && SFX[name]) SFX[name](o); };
A.SFX = SFX;
A.dest = () => out;
A.noise = noise; A.tone = tone;

/* ---------- loops ---------- */
function osc(type, f, dest, nodes) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dest); o.start(); nodes.push(o); return o; }
function nsrc(dest, nodes, ftype, f, q) {
  const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = ftype; fl.frequency.value = f; fl.Q.value = q;
  s.connect(fl); fl.connect(dest); s.start(0, Math.random()); nodes.push(s);
  return fl;
}
function lfo(rate, depth, target, nodes, type = 'sine') {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = rate;
  const g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(target); o.start(); nodes.push(o);
}
function gain(v, dest) { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; }

const LOOPS = {
  rush(g, n) { const a = gain(0.9, g); nsrc(a, n, 'bandpass', 380, 0.7); lfo(13, 0.5, a.gain, n); const b = gain(0.25, g); osc('sawtooth', 52, b, n); lfo(6, 0.2, b.gain, n); },
  ambush(g, n) { const a = gain(0.8, g); nsrc(a, n, 'bandpass', 900, 1.2); lfo(17, 0.5, a.gain, n); const b = gain(0.12, g); const o = osc('sawtooth', 1350, b, n); lfo(9, 120, o.frequency, n); const c = gain(0.2, g); osc('square', 85, c, n); },
  blitz(g, n) { const a = gain(0.7, g); nsrc(a, n, 'bandpass', 600, 1); lfo(22, 0.6, a.gain, n, 'square'); const b = gain(0.15, g); osc('sawtooth', 70, b, n); },
  a60(g, n) { const a = gain(0.9, g); nsrc(a, n, 'highpass', 1500, 0.5); lfo(30, 0.6, a.gain, n, 'square'); [311, 330, 466].forEach(f => osc('sawtooth', f, gain(0.06, g), n)); },
  a120(g, n) { const a = gain(0.5, g); nsrc(a, n, 'lowpass', 500, 1); const b = gain(0.15, g); const o = osc('triangle', 140, b, n); lfo(0.7, 30, o.frequency, n); },
  eyes(g, n) { [220, 223, 330].forEach(f => { const b = gain(0.07, g); const o = osc('sine', f, b, n); lfo(0.3, 4, o.frequency, n); }); },
  figure(g, n) { const b = gain(0.35, g); const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 220; fl.connect(b); osc('sawtooth', 42, fl, n); lfo(1.3, 0.3, b.gain, n); nsrc(gain(0.25, g), n, 'lowpass', 160, 1); },
  seek(g, n) {
    const b = gain(0.3, g); osc('sawtooth', 55, b, n); lfo(2.6, 0.3, b.gain, n, 'square');
    const c = gain(0.06, g); osc('square', 220, c, n); lfo(5.2, 0.06, c.gain, n, 'square');
    const d = gain(0.08, g); const o = osc('triangle', 440, d, n); lfo(0.5, 40, o.frequency, n);
    nsrc(gain(0.2, g), n, 'bandpass', 120, 1.5);
  },
  haste(g, n) { const a = gain(0.4, g); nsrc(a, n, 'highpass', 4000, 1); lfo(2, 0.4, a.gain, n, 'square'); const b = gain(0.2, g); osc('sawtooth', 48, b, n); },
  grumble(g, n) { const b = gain(0.3, g); const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 300; fl.connect(b); osc('sawtooth', 60, fl, n); lfo(3, 0.25, b.gain, n); },
  gloom(g, n) { const a = gain(0.5, g); nsrc(a, n, 'bandpass', 2500, 3); lfo(28, 0.5, a.gain, n, 'square'); },
  water(g, n) { nsrc(gain(0.8, g), n, 'lowpass', 600, 0.5); },
  fire(g, n) { const a = gain(0.6, g); nsrc(a, n, 'bandpass', 700, 0.4); lfo(7, 0.3, a.gain, n); },
  hide(g, n) { const a = gain(0.4, g); osc('sine', 60, a, n); lfo(1.6, 0.4, a.gain, n, 'square'); },
  amb_hotel(g, n) { [55, 82.5, 110.3].forEach(f => osc('sine', f, gain(0.05, g), n)); nsrc(gain(0.05, g), n, 'lowpass', 300, 0.5); },
  amb_mines(g, n) { [41, 61.7].forEach(f => osc('sine', f, gain(0.07, g), n)); const a = gain(0.08, g); nsrc(a, n, 'bandpass', 220, 0.6); lfo(0.08, 0.06, a.gain, n); },
  amb_backdoor(g, n) { [49, 51.5, 98].forEach(f => osc('sawtooth', f, gain(0.012, g), n)); nsrc(gain(0.06, g), n, 'lowpass', 250, 1); },
  amb_rooms(g, n) { osc('sine', 60, gain(0.05, g), n); osc('sine', 120, gain(0.02, g), n); nsrc(gain(0.05, g), n, 'highpass', 5000, 0.4); },
  amb_outdoors(g, n) { const a = gain(0.12, g); nsrc(a, n, 'bandpass', 500, 0.3); lfo(0.1, 0.08, a.gain, n); const c = gain(0.008, g); osc('sine', 4200, c, n); lfo(14, 0.008, c.gain, n, 'square'); },
};
A.LOOPS = LOOPS;
A.kit = { osc, nsrc, lfo, gain, ctx: () => ctx };
// Directional panner (no distance falloff: loops already scale their own volume by distance).
const makePanner = () => {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'linear'; p.rolloffFactor = 0;
  p.connect(out);
  return p;
};
const placePanner = (p, v) => {
  const t = ctx.currentTime;
  p.positionX.setTargetAtTime(v.x, t, 0.03); p.positionY.setTargetAtTime(v.y, t, 0.03); p.positionZ.setTargetAtTime(v.z, t, 0.03);
};
A.loop = name => {
  if (!ctx || !LOOPS[name]) return { set() {}, stop() {}, at() {} };
  const g = ctx.createGain(); g.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000;
  g.connect(lp); lp.connect(out);
  const nodes = [];
  LOOPS[name](g, nodes);
  let dead = false, pan = null;
  return {
    // The first call to at() makes this loop positional; muffled = heard through a wall.
    at(v, muffled) {
      if (dead || !v) return;
      if (!pan) { pan = makePanner(); lp.disconnect(); lp.connect(pan); }
      placePanner(pan, v);
      lp.frequency.setTargetAtTime(muffled ? 650 : 18000, ctx.currentTime, 0.12);
    },
    set(v, t = 0.08) { if (!dead) g.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, t); },
    stop() {
      if (dead) return; dead = true;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => { nodes.forEach(x => { try { x.stop(); } catch (e) { /* stopped */ } }); g.disconnect(); if (pan) pan.disconnect(); }, 900);
    },
  };
};
// One-shot from a point in the world.
A.sfxAt = (name, pos, o = {}) => {
  if (!ctx || !SFX[name]) return;
  const p = makePanner(); placePanner(p, pos);
  A._route = p;
  try { SFX[name](o); } finally { A._route = null; }
  setTimeout(() => p.disconnect(), 6000);
};
A.listen = cam => {
  if (!ctx) return;
  const L = ctx.listener, t = ctx.currentTime, p = cam.position;
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  if (L.positionX) {
    L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02);
    L.forwardX.setTargetAtTime(f.x, t, 0.02); L.forwardY.setTargetAtTime(f.y, t, 0.02); L.forwardZ.setTargetAtTime(f.z, t, 0.02);
    L.upX.setTargetAtTime(u.x, t, 0.02); L.upY.setTargetAtTime(u.y, t, 0.02); L.upZ.setTargetAtTime(u.z, t, 0.02);
  } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
};
A.ambient = name => {
  if (amb) amb.stop();
  amb = name ? A.loop('amb_' + name) : null;
  if (amb) amb.set(1, 1.5);
};
// Pull the ambience away (silence before something arrives) or bring it back.
A.duck = (v, t = 0.4) => { if (amb) amb.set(v, t); };
})();
