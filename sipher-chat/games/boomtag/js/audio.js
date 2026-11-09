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
A.muted = false; // set while fast-forwarding

function att(pos) {
  if (!pos || !G.camera) return 1;
  return G.clamp(1 - G.camera.position.distanceTo(pos) / 45, 0, 1);
}
function tone(freq, dur, o = {}) {
  if (!ctx || A.muted) return;
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
  if (!ctx || A.muted) return;
  const v = (o.vol || 0.3) * att(o.pos); if (v <= 0.01) return;
  const t = ctx.currentTime + (o.delay || 0);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1200, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
A.click = () => tone(880, 0.05, { type: 'square', vol: 0.1 });
A.buy = () => { tone(660, 0.08, { type: 'square', vol: 0.15 }); tone(990, 0.12, { type: 'square', vol: 0.15, delay: 0.07 }); tone(1320, 0.14, { type: 'square', vol: 0.12, delay: 0.14 }); };
A.deny = () => tone(140, 0.2, { type: 'square', vol: 0.18 });
A.step = pos => noise(0.04, { freq: 500, vol: 0.05, pos });
A.jump = pos => tone(300, 0.12, { type: 'square', to: 520, vol: 0.08, pos });
A.tick = urgent => tone(urgent ? 1560 : 1100, 0.05, { type: 'square', vol: urgent ? 0.14 : 0.09 });
A.pass = pos => { noise(0.14, { filter: 'bandpass', freq: 1800, to: 500, vol: 0.3, pos }); tone(520, 0.09, { type: 'square', to: 980, vol: 0.2, pos }); };
A.gotBomb = () => { tone(240, 0.14, { type: 'sawtooth', vol: 0.25 }); tone(170, 0.3, { type: 'sawtooth', vol: 0.25, delay: 0.12 }); };
A.explode = pos => { noise(1.1, { freq: 1100, to: 50, vol: 1, pos }); tone(80, 0.8, { type: 'sine', to: 28, vol: 0.7, pos }); tone(160, 0.25, { type: 'sawtooth', to: 40, vol: 0.3, pos }); };
A.oof = pos => tone(330, 0.22, { type: 'square', to: 150, vol: 0.22, pos });
A.pickup = () => { tone(990, 0.08, { type: 'sine', vol: 0.2 }); tone(1480, 0.12, { type: 'sine', vol: 0.15, delay: 0.06 }); };
A.dash = pos => noise(0.25, { filter: 'bandpass', freq: 3000, to: 500, vol: 0.35, pos });
A.superjump = pos => { tone(200, 0.35, { type: 'triangle', to: 1200, vol: 0.25, pos }); noise(0.3, { freq: 600, vol: 0.2, pos }); };
A.blink = pos => { tone(1800, 0.18, { type: 'sine', to: 300, vol: 0.2, pos }); tone(2400, 0.1, { type: 'sine', vol: 0.1, pos, delay: 0.05 }); };
A.shock = pos => { tone(90, 0.5, { type: 'sine', to: 35, vol: 0.6, pos }); noise(0.4, { freq: 700, to: 100, vol: 0.5, pos }); };
A.freeze = pos => { for (let i = 0; i < 4; i++) tone(1400 + i * 300, 0.12, { type: 'sine', vol: 0.12, delay: i * 0.04, pos }); };
A.frozen = pos => { noise(0.3, { filter: 'highpass', freq: 3000, vol: 0.3, pos }); tone(2000, 0.3, { type: 'triangle', to: 900, vol: 0.15, pos }); };
A.invis = pos => tone(600, 0.4, { type: 'sine', to: 1600, vol: 0.18, pos });
A.decoy = pos => { tone(500, 0.1, { type: 'square', vol: 0.15, pos }); tone(750, 0.1, { type: 'square', vol: 0.15, delay: 0.08, pos }); };
A.pop = pos => { noise(0.12, { freq: 2500, vol: 0.3, pos }); tone(900, 0.08, { type: 'square', to: 300, vol: 0.15, pos }); };
A.toss = pos => noise(0.3, { filter: 'bandpass', freq: 1200, to: 2600, vol: 0.3, pos });
A.boing = pos => tone(180, 0.35, { type: 'sine', to: 700, vol: 0.3, pos });
A.sizzle = pos => { noise(0.4, { filter: 'highpass', freq: 2500, vol: 0.35, pos }); tone(160, 0.2, { type: 'sawtooth', vol: 0.12, pos }); };
A.tele = pos => { tone(400, 0.3, { type: 'sine', to: 1600, vol: 0.2, pos }); tone(1600, 0.3, { type: 'sine', to: 400, vol: 0.12, delay: 0.1, pos }); };
A.shield = pos => { tone(700, 0.2, { type: 'triangle', to: 1400, vol: 0.25, pos }); noise(0.15, { filter: 'highpass', freq: 4000, vol: 0.2, pos }); };
A.countdown = last => tone(last ? 1320 : 660, last ? 0.4 : 0.15, { type: 'square', vol: 0.2 });
A.round = () => { tone(523, 0.12, { type: 'square', vol: 0.18 }); tone(659, 0.12, { type: 'square', vol: 0.18, delay: 0.1 }); tone(784, 0.25, { type: 'square', vol: 0.18, delay: 0.2 }); };
A.mod = () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, { type: 'triangle', vol: 0.2, delay: i * 0.06 })); };
A.win = () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, { type: 'square', vol: 0.18, delay: i * 0.13 })); };
A.lose = () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.25, delay: i * 0.18 })); };
})();
