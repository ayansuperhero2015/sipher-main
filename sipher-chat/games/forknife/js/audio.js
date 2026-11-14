// Audio: every sound is synthesised with WebAudio, so the game needs no audio files.
(() => {
'use strict';
const A = G.audio = {};
let ctx = null, master = null, noiseBuf = null;
A.init = () => {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = G.save.vol; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
};
A.setVol = v => { if (master) master.gain.value = v; };
A.muted = false;

function att(pos) {
  if (!pos || !G.camera) return 1;
  return G.clamp(1.1 - G.camera.position.distanceTo(pos) / 90, 0.12, 1);
}
function tone(freq, dur, o = {}) {
  if (!ctx || A.muted) return;
  const v = (o.vol || 0.3) * att(o.pos);
  const t = ctx.currentTime + (o.delay || 0);
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'square'; osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + 0.02);
}
function noise(dur, o = {}) {
  if (!ctx || A.muted) return;
  const v = (o.vol || 0.3) * att(o.pos);
  const t = ctx.currentTime + (o.delay || 0);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1200, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
A.click = () => tone(880, 0.05, { type: 'square', vol: 0.08 });
A.deny = () => tone(140, 0.15, { type: 'square', vol: 0.12 });
A.shot = (kind, pos) => {
  if (kind === 'rifle') { noise(0.16, { freq: 2600, to: 400, vol: 0.5, pos }); tone(190, 0.09, { type: 'sawtooth', to: 70, vol: 0.3, pos }); }
  else if (kind === 'smg') { noise(0.09, { freq: 3400, to: 700, vol: 0.38, pos }); tone(260, 0.05, { type: 'square', to: 110, vol: 0.16, pos }); }
  else if (kind === 'shotgun') { noise(0.34, { freq: 1700, to: 160, vol: 0.9, pos }); tone(110, 0.2, { type: 'sawtooth', to: 40, vol: 0.5, pos }); }
  else if (kind === 'cannon') { noise(0.3, { freq: 2200, to: 200, vol: 0.75, pos }); tone(150, 0.2, { type: 'sawtooth', to: 45, vol: 0.5, pos }); }
  else if (kind === 'sniper') { noise(0.6, { freq: 3000, to: 120, vol: 1, pos }); tone(120, 0.4, { type: 'sawtooth', to: 30, vol: 0.6, pos }); tone(900, 0.5, { type: 'sine', to: 200, vol: 0.08, pos, delay: 0.05 }); }
  else if (kind === 'rocket') { noise(0.5, { filter: 'bandpass', freq: 500, to: 1800, vol: 0.7, pos }); tone(90, 0.3, { type: 'sine', to: 50, vol: 0.5, pos }); }
};
A.empty = () => tone(1400, 0.03, { type: 'square', vol: 0.08 });
A.reload = () => { tone(520, 0.04, { type: 'square', vol: 0.09 }); tone(700, 0.04, { type: 'square', vol: 0.09, delay: 0.14 }); };
A.reloaded = () => { tone(900, 0.04, { type: 'square', vol: 0.1 }); noise(0.05, { freq: 3000, vol: 0.12 }); };
A.swap = () => noise(0.06, { filter: 'bandpass', freq: 1800, vol: 0.12 });
A.hit = () => tone(1250, 0.05, { type: 'triangle', vol: 0.3 });
A.headshot = () => { tone(1900, 0.09, { type: 'triangle', vol: 0.35 }); tone(2600, 0.12, { type: 'sine', vol: 0.25, delay: 0.04 }); };
A.hurt = () => { tone(190, 0.12, { type: 'sawtooth', to: 110, vol: 0.25 }); noise(0.08, { freq: 900, vol: 0.2 }); };
A.shieldBreak = pos => { noise(0.3, { filter: 'highpass', freq: 3500, vol: 0.4, pos }); tone(2400, 0.25, { type: 'triangle', to: 600, vol: 0.2, pos }); };
A.build = pos => { noise(0.07, { freq: 900, vol: 0.3, pos }); tone(230, 0.07, { type: 'square', to: 150, vol: 0.14, pos }); };
A.thud = pos => noise(0.07, { freq: 700, vol: 0.28, pos });
A.breakPiece = pos => { noise(0.25, { freq: 1500, to: 300, vol: 0.45, pos }); tone(180, 0.12, { type: 'square', to: 80, vol: 0.14, pos }); };
A.swing = pos => noise(0.12, { filter: 'bandpass', freq: 900, to: 2400, vol: 0.18, pos });
A.explode = pos => { noise(1.0, { freq: 1100, to: 50, vol: 1, pos }); tone(80, 0.7, { type: 'sine', to: 28, vol: 0.7, pos }); };
A.jump = pos => noise(0.05, { freq: 600, vol: 0.06, pos });
A.land = pos => noise(0.08, { freq: 400, vol: 0.14, pos });
A.heal = () => { for (let i = 0; i < 4; i++) tone(500 + i * 180, 0.14, { type: 'sine', vol: 0.14, delay: i * 0.07 }); };
A.drink = () => { for (let i = 0; i < 5; i++) tone(300 + (i % 2) * 90, 0.08, { type: 'sine', vol: 0.1, delay: i * 0.26 }); };
A.elim = pos => { tone(1400, 0.35, { type: 'sawtooth', to: 200, vol: 0.3, pos }); noise(0.4, { filter: 'highpass', freq: 2500, vol: 0.3, pos }); };
A.countdown = last => tone(last ? 1320 : 660, last ? 0.4 : 0.15, { type: 'square', vol: 0.18 });
A.roundWin = () => { tone(523, 0.12, { type: 'square', vol: 0.18 }); tone(659, 0.12, { type: 'square', vol: 0.18, delay: 0.1 }); tone(784, 0.25, { type: 'square', vol: 0.18, delay: 0.2 }); };
A.roundLose = () => { tone(392, 0.16, { type: 'triangle', vol: 0.25 }); tone(294, 0.3, { type: 'triangle', vol: 0.25, delay: 0.15 }); };
A.win = () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, { type: 'square', vol: 0.18, delay: i * 0.13 })); };
A.lose = () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.25, delay: i * 0.18 })); };
A.storm = () => { tone(220, 0.5, { type: 'sawtooth', to: 440, vol: 0.14 }); tone(330, 0.5, { type: 'sawtooth', to: 660, vol: 0.1, delay: 0.1 }); };
A.stormTick = () => noise(0.12, { filter: 'bandpass', freq: 500, vol: 0.18 });
// edit mode
A.editOpen = () => { tone(740, 0.05, { type: 'triangle', vol: 0.12 }); tone(1110, 0.06, { type: 'triangle', vol: 0.1, delay: 0.04 }); };
A.editTick = () => tone(1500, 0.025, { type: 'square', vol: 0.05 });
A.editConfirm = pos => { noise(0.09, { filter: 'bandpass', freq: 2200, to: 700, vol: 0.32, pos }); tone(420, 0.07, { type: 'square', to: 260, vol: 0.12, pos }); };
A.editReset = pos => { noise(0.1, { filter: 'bandpass', freq: 900, to: 2400, vol: 0.28, pos }); tone(300, 0.08, { type: 'square', to: 520, vol: 0.1, pos }); };
A.slide = pos => noise(0.5, { filter: 'bandpass', freq: 700, to: 300, vol: 0.22, pos });
A.uiHover = () => tone(1200, 0.02, { type: 'sine', vol: 0.05 });
})();
