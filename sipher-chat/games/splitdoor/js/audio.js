'use strict';
// Procedural audio: every sound is synthesised into a buffer at boot. Positional sounds pan and fade by distance.
G.audio = {
  ctx: null, master: null, sfx: null, music: null, bank: {}, loops: {}, musicSrc: null,
  listener: { pos: new THREE.Vector3(), right: new THREE.Vector3(1, 0, 0) },

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master = this.ctx.createGain(); this.master.connect(comp); comp.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
    this.music = this.ctx.createGain(); this.music.connect(this.master);
    this.applyVolume();
    this.build();
  },
  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.value = G.settings.vol;
    this.music.gain.value = G.settings.music * 0.5;
  },

  // ---------------------------------------------------------------- synthesis helpers
  mk(dur, fn, stereo) {
    const sr = this.ctx.sampleRate, n = Math.max(1, Math.floor(sr * dur));
    const b = this.ctx.createBuffer(stereo ? 2 : 1, n, sr);
    const L = b.getChannelData(0), R = stereo ? b.getChannelData(1) : null;
    const st = {};
    for (let i = 0; i < n; i++) {
      const v = fn(i / sr, st, i);
      if (stereo) { L[i] = v[0]; R[i] = v[1]; } else L[i] = v;
    }
    // soft clip + fade tail
    for (let c = 0; c < (stereo ? 2 : 1); c++) {
      const d = b.getChannelData(c), fade = Math.min(n, Math.floor(sr * 0.01));
      for (let i = 0; i < n; i++) d[i] = Math.tanh(d[i] * 1.2);
      for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
    }
    return b;
  },

  build() {
    const N = () => Math.random() * 2 - 1;
    const E = (t, a, d) => t < a ? t / a : Math.exp(-(t - a) / d);
    const S = (f, t) => Math.sin(Math.PI * 2 * f * t);
    const lp = (st, k, key, x) => (st[key] = (st[key] || 0) + k * (x - (st[key] || 0)));
    const B = this.bank;
    const gun = (dur, body, crack, thump, tf, k) => this.mk(dur, (t, st) => {
      const n = N();
      const low = lp(st, k, 'a', n);
      return low * body * E(t, 0.001, dur * 0.25) + n * crack * E(t, 0.0005, 0.012)
        + S(tf * (1 - t * 2.5), t) * thump * E(t, 0.002, 0.05);
    });
    B.ar = gun(0.26, 1.0, 0.55, 0.9, 130, 0.25);
    B.smg = gun(0.18, 0.8, 0.5, 0.6, 170, 0.33);
    B.br = gun(0.32, 1.1, 0.6, 1.0, 110, 0.2);
    B.pistol = gun(0.28, 0.9, 0.7, 0.8, 150, 0.3);
    B.scatter = this.mk(0.6, (t, st) => { const n = N(); return lp(st, 0.12, 'a', n) * 1.6 * E(t, 0.002, 0.13) + n * 0.6 * E(t, 0, 0.02) + S(70 * (1 - t), t) * 1.2 * E(t, 0.003, 0.09); });
    B.rail = this.mk(1.0, (t, st) => {
      const f = 2200 * Math.exp(-t * 7) + 160;
      st.p = (st.p || 0) + f / this.ctx.sampleRate;
      const fm = Math.sin(st.p * Math.PI * 2 + Math.sin(st.p * Math.PI * 6) * 2);
      return fm * 0.7 * E(t, 0.002, 0.25) + N() * 0.4 * E(t, 0, 0.05) + S(55, t) * 0.9 * E(t, 0.005, 0.18);
    });
    B.rocket = this.mk(0.9, (t, st) => { const n = N(); const bp = lp(st, 0.05 + t * 0.1, 'a', n); return bp * 1.5 * E(t, 0.01, 0.3) + S(90 - t * 40, t) * E(t, 0.005, 0.12); });
    B.boom = this.mk(1.8, (t, st) => { const n = N(); const k = 0.02 + 0.2 * Math.exp(-t * 6); return lp(st, k, 'a', n) * 2.2 * E(t, 0.004, 0.45) + S(42 + 30 * Math.exp(-t * 5), t) * 1.4 * E(t, 0.004, 0.4) + n * 0.4 * E(t, 0, 0.03); });
    B.portal0 = this.mk(0.6, t => (S(520 + 600 * t, t) * 0.4 + S(1040 + 1100 * t, t) * 0.25 + S(780, t) * 0.15 * S(9, t)) * E(t, 0.01, 0.18));
    B.portal1 = this.mk(0.6, t => (S(400 + 480 * t, t) * 0.4 + S(800 + 900 * t, t) * 0.25 + S(600, t) * 0.15 * S(7, t)) * E(t, 0.01, 0.18));
    B.portalPass = this.mk(0.7, (t, st) => { const n = N(); const k = 0.02 + 0.3 * Math.sin(Math.PI * t / 0.7); const a = lp(st, k, 'a', n); const b = lp(st, k * 0.5, 'b', a); return (a - b) * 2.2 * Math.sin(Math.PI * t / 0.7) + S(220 + 300 * t, t) * 0.15 * E(t, 0.05, 0.2); });
    B.fizzle = this.mk(0.32, t => (S(300 - 600 * t, t) > 0 ? 0.3 : -0.3) * E(t, 0.003, 0.09) + N() * 0.1 * E(t, 0, 0.05));
    B.portalClose = this.mk(0.35, t => S(700 - 1300 * t, t) * 0.4 * E(t, 0.005, 0.1));
    B.hit = this.mk(0.07, t => S(1900, t) * 0.5 * E(t, 0.001, 0.02));
    B.head = this.mk(0.35, t => (S(2400, t) * 0.4 + S(3610, t) * 0.25) * E(t, 0.001, 0.09));
    B.kill = this.mk(0.5, t => (S(t < 0.08 ? 880 : 1320, t) * 0.45 + S(t < 0.08 ? 1760 : 2640, t) * 0.12) * E(t % 0.08 + (t > 0.08 ? 0.0 : 0), 0.002, t < 0.08 ? 0.05 : 0.15));
    B.shieldBreak = this.mk(0.6, (t, st) => { const n = N(); const h = n - lp(st, 0.4, 'a', n); return h * 0.8 * E(t, 0.001, 0.12) + (S(1870, t) + S(2730, t) + S(4110, t)) * 0.15 * E(t, 0.001, 0.2); });
    B.shieldUp = this.mk(0.7, t => (S(300 + 700 * t, t) * 0.25 + S(600 + 1400 * t, t) * 0.12) * Math.sin(Math.PI * t / 0.7));
    B.hurt = this.mk(0.18, (t, st) => lp(st, 0.08, 'a', N()) * 1.6 * E(t, 0.002, 0.05) + S(90, t) * 0.5 * E(t, 0.002, 0.05));
    B.jet = this.mk(1.0, (t, st) => { const n = N(); const a = lp(st, 0.18, 'a', n); return (a - lp(st, 0.02, 'b', a)) * 1.2; });
    B.step = this.mk(0.09, (t, st) => lp(st, 0.15, 'a', N()) * 1.3 * E(t, 0.001, 0.02) + S(70, t) * 0.4 * E(t, 0.001, 0.02));
    B.land = this.mk(0.25, (t, st) => lp(st, 0.08, 'a', N()) * 1.8 * E(t, 0.002, 0.06) + S(55, t) * 0.8 * E(t, 0.002, 0.07));
    B.slide = this.mk(0.6, (t, st) => { const n = N(); const a = lp(st, 0.3, 'a', n); return (a - lp(st, 0.05, 'b', a)) * 0.9 * E(t, 0.02, 0.25); });
    B.jump = this.mk(0.15, (t, st) => lp(st, 0.2, 'a', N()) * 0.6 * E(t, 0.005, 0.05));
    B.reload = this.mk(0.6, t => { let v = 0; for (const c of [0, 0.22, 0.44]) { const u = t - c; if (u > 0) v += (S(2400, u) * 0.3 + N() * 0.3) * E(u, 0.0005, 0.012); } return v; });
    B.switch = this.mk(0.2, t => (S(1600, t) * 0.25 + N() * 0.2) * E(t, 0.0005, 0.015) + (S(1100, t - 0.08) * 0.2) * (t > 0.08 ? E(t - 0.08, 0.0005, 0.015) : 0));
    B.melee = this.mk(0.3, (t, st) => { const n = N(); return lp(st, 0.1 + t, 'a', n) * 0.8 * Math.sin(Math.PI * Math.min(1, t / 0.15)) + S(80, t) * (t > 0.12 ? E(t - 0.12, 0.002, 0.05) : 0); });
    B.denied = this.mk(0.15, t => (S(160, t) > 0 ? 0.25 : -0.25) * E(t, 0.003, 0.06));
    B.pickup = this.mk(0.5, t => { const f = t < 0.1 ? 660 : t < 0.2 ? 880 : 1320; return S(f, t) * 0.35 * E(t % 0.1, 0.002, 0.08) * (t < 0.3 ? 1 : Math.exp(-(t - 0.3) * 10)); });
    B.beep = this.mk(0.15, t => S(880, t) * 0.4 * E(t, 0.003, 0.05));
    B.go = this.mk(0.6, t => (S(1320, t) * 0.4 + S(660, t) * 0.25) * E(t, 0.003, 0.2));
    B.medal = this.mk(0.7, t => (S(1046, t) * 0.25 + S(1318, t) * 0.2 + S(1568, t) * 0.18 + S(2093, t) * 0.1 * S(6, t)) * E(t, 0.005, 0.22));
    B.spawn = this.mk(0.8, t => (S(200 + 400 * t, t) * 0.3 + S(600 + 1200 * t, t) * 0.1) * Math.sin(Math.PI * t / 0.8));
    B.death = this.mk(0.9, (t, st) => S(400 * Math.exp(-t * 3), t) * 0.4 * E(t, 0.005, 0.3) + lp(st, 0.1, 'a', N()) * 1.2 * E(t, 0.002, 0.12));
    B.clink = this.mk(0.1, t => (S(3100, t) * 0.25 + S(4700, t) * 0.15) * E(t, 0.0005, 0.03));
    B.tick = this.mk(0.05, t => S(2000, t) * 0.25 * E(t, 0.0005, 0.01));
    B.zone = this.mk(0.3, t => (S(520, t) * 0.25 + S(780, t) * 0.18) * E(t, 0.005, 0.1));
    B.alarm = this.mk(0.6, t => S(t % 0.3 < 0.15 ? 740 : 560, t) * 0.3 * E(t % 0.3, 0.003, 0.12));
    B.win = this.mk(2.2, t => { const ch = t < 0.35 ? [523, 659] : t < 0.7 ? [587, 740] : [659, 784, 988, 1318]; let v = 0; for (const f of ch) v += S(f, t) * 0.16; return v * E(t < 0.7 ? t % 0.35 : t - 0.7, 0.01, t < 0.7 ? 0.3 : 0.8); });
    B.lose = this.mk(2.2, t => { const ch = t < 0.5 ? [392, 466] : [311, 370, 466]; let v = 0; for (const f of ch) v += S(f, t) * 0.17; return v * E(t < 0.5 ? t : t - 0.5, 0.01, t < 0.5 ? 0.4 : 0.9); });
    // ambient pads per map: slow detuned chords, loopable
    const pad = (notes, bright) => this.mk(12, (t, st) => {
      let l = 0, r = 0;
      for (let i = 0; i < notes.length; i++) {
        const f = notes[i], w = 0.5 + 0.5 * Math.sin(Math.PI * 2 * t / 12 * (i + 1));
        l += Math.sin(Math.PI * 2 * f * t) * w + Math.sin(Math.PI * 2 * f * 1.003 * t) * 0.5 * bright;
        r += Math.sin(Math.PI * 2 * f * 0.997 * t) * w + Math.sin(Math.PI * 2 * f * 2.001 * t) * 0.2 * bright;
      }
      return [l * 0.06, r * 0.06];
    }, true);
    B.pad_hinge = pad([110, 164.8, 220, 277.2, 329.6], 0.5);
    B.pad_foundry = pad([73.4, 110, 146.8, 174.6, 220], 0.3);
    B.pad_mesa = pad([98, 146.8, 196, 246.9, 293.7], 0.6);
  },

  // ---------------------------------------------------------------- playback
  play(name, o = {}) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return null;
    const buf = this.bank[name]; if (!buf) return null;
    let vol = o.vol == null ? 1 : o.vol, pan = 0;
    if (o.pos) {
      const L = this.listener, dx = o.pos.x - L.pos.x, dy = o.pos.y - L.pos.y, dz = o.pos.z - L.pos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      vol *= 1 / (1 + Math.pow(d / (o.ref || 9), 1.4));
      if (vol < 0.012) return null;
      if (d > 0.01) pan = (dx * L.right.x + dy * L.right.y + dz * L.right.z) / d * 0.75;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (o.rate || 1) * (1 + (o.jit == null ? 0.04 : o.jit) * (Math.random() * 2 - 1));
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g);
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
    src.start();
    return src;
  },
  loop(key, name, on, vol = 1, rate = 1) {
    if (!this.ctx) return;
    let l = this.loops[key];
    if (on && !l) {
      const src = this.ctx.createBufferSource(); src.buffer = this.bank[name]; src.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.sfx); src.start();
      l = this.loops[key] = { src, g };
    }
    if (!l) return;
    l.g.gain.setTargetAtTime(on ? vol : 0, this.ctx.currentTime, 0.05);
    l.src.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.05);
  },
  startMusic(name) {
    if (!this.ctx) return;
    if (this.musicSrc) { try { this.musicSrc.stop(); } catch (e) { /* stopped */ } }
    const src = this.ctx.createBufferSource(); src.buffer = this.bank[name]; src.loop = true;
    src.connect(this.music); src.start(); this.musicSrc = src;
  },
  say(text) {
    if (!G.settings.announcer || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05; u.pitch = 0.55; u.volume = Math.min(1, G.settings.vol + 0.1);
      speechSynthesis.speak(u);
    } catch (e) { /* no tts */ }
  },
};
