// Audio: every sound is synthesised with WebAudio, so the game needs no audio files.
(() => {
'use strict';
const A = G.audio = {};
let ctx = null, master = null, noiseBuf = null;
A.init = () => {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = G.settings.vol; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
};
A.setVol = v => { if (master) master.gain.value = v; };

// Distance falloff from the listener for positional sounds.
function att(pos) {
  if (!pos || !G.camera) return 1;
  const d = G.camera.position.distanceTo(pos);
  return G.clamp(1 - d / 40, 0, 1);
}
function tone(freq, dur, o = {}) {
  if (!ctx) return;
  const v = (o.vol || 0.3) * att(o.pos); if (v <= 0.01) return;
  const t = ctx.currentTime + (o.delay || 0);
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'square'; osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + 0.02);
}
function noise(dur, o = {}) {
  if (!ctx) return;
  const v = (o.vol || 0.3) * att(o.pos); if (v <= 0.01) return;
  const t = ctx.currentTime + (o.delay || 0);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1200, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
A.place = pos => { noise(0.08, { freq: 900, vol: 0.35, pos }); tone(180, 0.06, { type: 'triangle', vol: 0.15, pos }); };
A.dig = pos => noise(0.05, { freq: 1800, vol: 0.18, pos });
A.breakBlock = pos => { noise(0.18, { freq: 1400, to: 300, vol: 0.4, pos }); };
A.swing = () => noise(0.07, { filter: 'bandpass', freq: 2500, to: 900, vol: 0.12 });
A.hit = pos => { tone(160, 0.12, { type: 'sawtooth', to: 70, vol: 0.3, pos }); noise(0.08, { freq: 2200, vol: 0.3, pos }); };
A.hurt = () => { tone(300, 0.18, { type: 'square', to: 120, vol: 0.25 }); };
A.pickup = (k) => { const f = { iron: 880, gold: 1046, diamond: 1318, emerald: 1568 }[k] || 900; tone(f, 0.09, { type: 'sine', vol: 0.18 }); tone(f * 1.5, 0.1, { type: 'sine', vol: 0.12, delay: 0.05 }); };
A.buy = () => { tone(660, 0.08, { type: 'square', vol: 0.15 }); tone(990, 0.12, { type: 'square', vol: 0.15, delay: 0.07 }); };
A.deny = () => { tone(140, 0.2, { type: 'square', vol: 0.18 }); };
A.bow = pos => { tone(420, 0.12, { type: 'triangle', to: 160, vol: 0.25, pos }); noise(0.1, { filter: 'highpass', freq: 3000, vol: 0.1, pos }); };
A.arrowHit = pos => { tone(900, 0.05, { type: 'square', vol: 0.15, pos }); };
A.explode = pos => { noise(0.9, { freq: 900, to: 60, vol: 0.9, pos }); tone(70, 0.7, { type: 'sine', to: 30, vol: 0.6, pos }); };
A.fuse = pos => noise(0.25, { filter: 'highpass', freq: 4000, vol: 0.12, pos });
A.death = () => { tone(400, 0.25, { type: 'square', to: 100, vol: 0.25 }); tone(200, 0.4, { type: 'square', to: 60, vol: 0.2, delay: 0.15 }); };
A.kill = () => { tone(1200, 0.07, { type: 'square', vol: 0.15 }); tone(1600, 0.1, { type: 'square', vol: 0.15, delay: 0.06 }); };
A.bedBroken = (mine) => {
  if (mine) { [523, 392, 330, 262].forEach((f, i) => tone(f, 0.3, { type: 'sawtooth', vol: 0.22, delay: i * 0.16 })); }
  else { [392, 523, 659].forEach((f, i) => tone(f, 0.22, { type: 'square', vol: 0.16, delay: i * 0.1 })); }
};
A.alarm = () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 700 : 900, 0.15, { type: 'square', vol: 0.18, delay: i * 0.16 }); };
A.countdown = (last) => tone(last ? 1320 : 660, last ? 0.4 : 0.15, { type: 'square', vol: 0.2 });
A.event = () => { tone(523, 0.15, { type: 'triangle', vol: 0.25 }); tone(784, 0.25, { type: 'triangle', vol: 0.25, delay: 0.12 }); };
A.win = () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, { type: 'square', vol: 0.2, delay: i * 0.14 })); };
A.lose = () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.25, delay: i * 0.18 })); };
A.eat = () => { for (let i = 0; i < 3; i++) noise(0.06, { freq: 700, vol: 0.2, delay: i * 0.12 }); };
A.pearl = pos => { tone(300, 0.3, { type: 'sine', to: 1200, vol: 0.2, pos }); };
A.step = pos => noise(0.04, { freq: 500, vol: 0.06, pos });
})();
