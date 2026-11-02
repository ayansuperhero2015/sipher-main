// Sub-floors: The Archives (sectors A–Z) and The Stairwell (99 landings).
(() => {
'use strict';
const V3 = THREE.Vector3;
const SP = G.SP, E = G.E, FL = G.FLOORS, U = G.ui;
const M = G.mat, GEO = G.geo, K = G.faceKit, TK = G.texKit;
const A = G.audio;
const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/* =====================================================================
   Faces
   ===================================================================== */
Object.assign(G.FACES, {
  bash(x, S) { K.smoke(x, S, '220,70,10', 80); K.smoke(x, S, '60,0,0', 40, 0.22); K.eyesPair(x, S / 2, S * 0.4, S * 0.13, S * 0.06, S * 0.05, '#ffe080', '#300', 4, '#ff8000'); K.grin(x, S / 2, S * 0.62, S * 0.52, S * 0.15, '#ffd8a0', 16, '#400'); },
  drone(x, S) {
    x.strokeStyle = '#555'; x.lineWidth = 10;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { x.beginPath(); x.moveTo(S / 2, S / 2); x.lineTo(S / 2 + a * S * 0.32, S / 2 + b * S * 0.32); x.stroke(); x.fillStyle = 'rgba(160,160,160,0.4)'; x.beginPath(); x.ellipse(S / 2 + a * S * 0.32, S / 2 + b * S * 0.32, S * 0.12, S * 0.04, 0, 0, 7); x.fill(); }
    x.fillStyle = '#2a2c30'; x.beginPath(); x.arc(S / 2, S / 2, S * 0.16, 0, 7); x.fill();
    x.shadowColor = '#f00'; x.shadowBlur = 30; x.fillStyle = '#ff2020'; x.beginPath(); x.arc(S / 2, S / 2, S * 0.06, 0, 7); x.fill(); x.shadowBlur = 0;
  },
  alma(x, S) {
    x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(S / 2, S * 0.5, S * 0.34, S * 0.46, 0, 0, 7); x.fill();
    x.fillStyle = '#d8d2c8'; x.beginPath(); x.ellipse(S / 2, S * 0.48, S * 0.2, S * 0.27, 0, 0, 7); x.fill();
    x.strokeStyle = '#222'; x.lineWidth = 4;
    for (const s of [-1, 1]) { x.beginPath(); x.arc(S / 2 + s * S * 0.08, S * 0.44, S * 0.04, 0.2, Math.PI - 0.2); x.stroke(); }
    x.strokeStyle = 'rgba(20,20,40,0.85)'; x.lineWidth = 5;
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(S / 2 + s * S * 0.08, S * 0.48); x.quadraticCurveTo(S / 2 + s * S * 0.1, S * 0.6, S / 2 + s * S * 0.07, S * 0.75); x.stroke(); }
    x.strokeStyle = '#3a1a1a'; x.lineWidth = 3; x.beginPath(); x.arc(S / 2, S * 0.66, S * 0.04, Math.PI + 0.3, -0.3); x.stroke();
  },
  almaScream(x, S) {
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#e0dad0'; x.beginPath(); x.ellipse(S / 2, S * 0.5, S * 0.3, S * 0.42, 0, 0, 7); x.fill();
    K.eyesPair(x, S / 2, S * 0.36, S * 0.11, S * 0.07, S * 0.09, '#000', '#fff', 3);
    K.openMouth(x, S / 2, S * 0.68, S * 0.24, S * 0.34, '#d8d0c0');
    x.strokeStyle = 'rgba(0,0,0,0.8)'; x.lineWidth = 4; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(S / 2 + s * S * 0.11, S * 0.44); x.lineTo(S / 2 + s * S * 0.13, S * 0.8); x.stroke(); }
  },
  teller(x, S) {
    x.fillStyle = '#0c0d0a'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#cfc8b4'; x.beginPath(); x.ellipse(S / 2, S * 0.52, S * 0.22, S * 0.36, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(40,140,60,0.75)'; x.beginPath(); x.ellipse(S / 2, S * 0.24, S * 0.3, S * 0.08, 0, Math.PI, 0); x.fill();
    K.eyesPair(x, S / 2, S * 0.42, S * 0.08, S * 0.025, S * 0.025, '#000', null, 0);
    x.strokeStyle = '#2a0808'; x.lineWidth = 4; x.beginPath(); x.moveTo(S * 0.36, S * 0.66); x.quadraticCurveTo(S / 2, S * 0.74, S * 0.64, S * 0.66); x.stroke();
  },
  scribbles(x, S) {
    x.fillStyle = '#ece8dc'; x.fillRect(0, 0, S, S);
    x.strokeStyle = '#111'; x.lineWidth = 3;
    for (let i = 0; i < 26; i++) { let px = Math.random() * S, py = Math.random() * S; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 14; k++) { px += G.rand(-40, 40); py += G.rand(-40, 40); x.lineTo(px, py); } x.stroke(); }
    x.fillStyle = '#000'; K.eyesPair(x, S / 2, S * 0.42, S * 0.15, S * 0.08, S * 0.1, '#000', '#ece8dc', 6);
    K.grin(x, S / 2, S * 0.66, S * 0.5, S * 0.16, '#000', 0);
  },
  ransom(x, S) {
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#20ff60'; x.shadowColor = '#20ff60'; x.shadowBlur = 20;
    x.beginPath(); x.arc(S / 2, S * 0.42, S * 0.24, 0, 7); x.fill(); x.fillRect(S * 0.36, S * 0.56, S * 0.28, S * 0.16);
    x.shadowBlur = 0; x.fillStyle = '#000';
    for (const s of [-1, 1]) { x.beginPath(); x.arc(S / 2 + s * S * 0.09, S * 0.42, S * 0.06, 0, 7); x.fill(); }
    for (let i = 0; i < 4; i++) x.fillRect(S * 0.39 + i * S * 0.065, S * 0.62, S * 0.025, S * 0.1);
    x.fillStyle = '#20ff60'; x.font = `700 ${S * 0.16}px monospace`; x.textAlign = 'center'; x.fillText('$$$', S / 2, S * 0.92);
  },
  honcho(x, S) {
    x.fillStyle = '#060606'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#1c1c22'; x.fillRect(S * 0.18, S * 0.62, S * 0.64, S * 0.4);
    x.fillStyle = '#7a1414'; x.beginPath(); x.moveTo(S / 2, S * 0.62); x.lineTo(S * 0.46, S * 0.95); x.lineTo(S * 0.54, S * 0.95); x.fill();
    x.fillStyle = '#4a4a50'; x.fillRect(S * 0.26, S * 0.1, S * 0.48, S * 0.5);
    K.eyesPair(x, S / 2, S * 0.28, S * 0.11, S * 0.05, S * 0.035, '#fff', null, 0, '#fff');
    K.grin(x, S / 2, S * 0.44, S * 0.36, S * 0.1, '#f0f0e0', 14);
  },
  creak(x, S) {
    x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, S, S);
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.fillStyle = '#e6e2d6'; x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.2, S * 0.32, 0, 0, 7); x.fill();
    x.fillStyle = '#000'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(S / 2 + s * S * 0.075, S * 0.45, S * 0.045, S * 0.08, s * 0.2, 0, 7); x.fill(); }
    x.fillStyle = '#fff'; for (const s of [-1, 1]) { x.beginPath(); x.arc(S / 2 + s * S * 0.075, S * 0.47, S * 0.012, 0, 7); x.fill(); }
    x.strokeStyle = '#222'; x.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) { let px = S / 2 + G.rand(-S * 0.12, S * 0.12), py = S * G.rand(0.25, 0.75); x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += G.rand(-14, 14); py += G.rand(-14, 14); x.lineTo(px, py); } x.stroke(); }
  },
  noise(x, S) {
    const id = x.createImageData(S, S);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 200; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0);
    x.fillStyle = 'rgba(0,0,0,0.85)'; x.beginPath(); x.ellipse(S / 2, S * 0.62, S * 0.24, S * 0.42, 0, 0, 7); x.fill(); x.beginPath(); x.arc(S / 2, S * 0.3, S * 0.14, 0, 7); x.fill();
    K.eyesPair(x, S / 2, S * 0.3, S * 0.05, S * 0.02, S * 0.02, '#fff', null, 0, '#fff');
  },
  stem(x, S) {
    x.fillStyle = '#100808'; x.fillRect(0, 0, S, S);
    const g = x.createRadialGradient(S * 0.4, S * 0.4, 0, S / 2, S / 2, S * 0.44); g.addColorStop(0, '#c88a8a'); g.addColorStop(1, '#5a2a2a');
    x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, S * 0.42, 0, 7); x.fill();
    K.openMouth(x, S / 2, S * 0.56, S * 0.5, S * 0.4, '#f0e8d8');
  },
  cobbler(x, S) {
    x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, S, S);
    x.fillStyle = '#6a4424'; x.beginPath(); x.arc(S / 2, S * 0.6, S * 0.32, 0, 7); x.fill();
    x.fillStyle = '#2a1a0c'; x.fillRect(S * 0.3, S * 0.12, S * 0.4, S * 0.24); x.fillRect(S * 0.2, S * 0.34, S * 0.6, S * 0.05);
    K.eyesPair(x, S / 2, S * 0.56, S * 0.1, S * 0.05, S * 0.06, '#fff8e0', '#2a1a0c', 9);
    x.strokeStyle = '#2a1a0c'; x.lineWidth = 5; x.beginPath(); x.arc(S / 2, S * 0.68, S * 0.1, 0.3, Math.PI - 0.3); x.stroke();
  },
  crusher(x, S) {
    x.fillStyle = '#1a1a1c'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#9a9a9e';
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const px = 26 + i * 52, py = 26 + j * 52; x.beginPath(); x.moveTo(px - 16, py + 16); x.lineTo(px, py - 20); x.lineTo(px + 16, py + 16); x.fill(); }
    x.fillStyle = 'rgba(160,0,0,0.5)'; x.fillRect(0, 0, S, S);
  },
  fire(x, S) {
    const g = x.createLinearGradient(0, S, 0, 0); g.addColorStop(0, '#fff2a0'); g.addColorStop(0.3, '#ff8a10'); g.addColorStop(0.7, '#a01800'); g.addColorStop(1, '#100000');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    K.smoke(x, S, '255,120,0', 40);
  },
  spark(x, S) {
    x.clearRect(0, 0, S, S); x.strokeStyle = '#bfe8ff'; x.shadowColor = '#4ab8ff'; x.shadowBlur = 18; x.lineWidth = 4;
    for (let i = 0; i < 6; i++) { let px = S / 2, py = S / 2; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += G.rand(-30, 30); py += G.rand(-30, 30); x.lineTo(px, py); } x.stroke(); }
  },
});
Object.assign(U.FACE, { stampede: 'drone', drones: 'drone', currents: 'spark', alma: 'almaScream', incineration: 'fire', stems: 'stem', crusher: 'crusher' });
Object.assign(U.NAMES, {
  bash: 'Bash', stampede: 'the Drone Stampede', drones: 'the Drones', currents: 'the Currents', scribbles: 'Scribbles', teller: 'the Teller', alma: 'Alma',
  honcho: 'Honcho', creak: 'Creak', noise: 'Noise', stems: 'the Stems', crusher: 'a Crusher', incineration: 'the Incineration', ransom: 'Ransom',
});
Object.assign(U.GUIDE, {
  bash: ['You died to who you call Bash...', 'Listen for the crackling whoosh.', 'Get into a closet before it passes, or it sets you on fire.'],
  stampede: ['The Drones stampeded through you...', 'Watch the clock. At 9 and at 5, they swarm.', 'Hide before the hour strikes.'],
  drones: ['The Drones wore you down...', 'Keep your distance and break their line of sight.'],
  currents: ['You were electrocuted...', 'When a puddle crackles and sparks, stay out of it.'],
  scribbles: ['You died to who you call Scribbles...', 'It covers your eyes and will not stop.', 'Hide in a closet — it cannot find you there.'],
  teller: ['The Teller collected...', 'Return your ticket before you run out of doors.'],
  alma: ['You looked at Alma...', 'When you hear crying, keep your eyes down.', 'Do not look at her. Not even once.'],
  honcho: ['Honcho fired you...', 'Deliver the boxes in order: 1, 2, 3...', 'Keep moving. He is slower than you.'],
  creak: ['You died to who you call Creak...', 'It moves when you are not looking...', 'but it hates being stared at. Glance, then look away.'],
  noise: ['You died to who you call Noise...', 'It copies your path. Stop moving and it stops too.', 'Smash its TV to end it.'],
  stems: ['The Stems chewed you up...', 'Click them to pop them before they swarm.'],
  crusher: ['A Crusher flattened you...', 'When the wall shakes, wait for it to slam and pull back.'],
  incineration: ['You burned in the incineration...', 'After pulling the Fire Alarm, get inside the Fire Escape.'],
});
U.BESTIARY.push(
  ['bash', 'Bash', 'Archives. Hide or burn.'], ['drone', 'Drones', 'Stampede at 9 and 5.'], ['scribbles', 'Scribbles', 'Hide in a closet.'],
  ['teller', 'Teller', 'Return the ticket in time.'], ['almaScream', 'Alma', 'Never look at her.'], ['ransom', 'Ransom', 'Pay it gold.'],
  ['honcho', 'Honcho', 'Deliver boxes in order.'], ['creak', 'Creak', 'Glance, never stare.'], ['noise', 'Noise', 'Stop moving. Smash its TV.'],
  ['stem', 'Stems', 'Click to pop them.'], ['crusher', 'Crushers', 'Wait for the slam.'],
);
Object.assign(U.WIN_TEXT, {
  archives: ['YOU ESCAPED THE ARCHIVES', 'Sector Z is behind you. The records will remember your name.'],
  'archives-exit': ['YOU LEFT THE ARCHIVES', 'An exit door led back to the Hotel. Your progress is filed away.'],
  stairwell: ['YOU REACHED THE BOTTOM', 'Landing 99. The Cobbler waves you off with a warm pie.'],
});

/* =====================================================================
   Audio
   ===================================================================== */
const L = A.LOOPS, kit = A.kit;
Object.assign(L, {
  drone(g, n) { const b = kit.gain(0.08, g); const o = kit.osc('sawtooth', 190, b, n); kit.lfo(18, 12, o.frequency, n); kit.nsrc(kit.gain(0.15, g), n, 'bandpass', 1400, 4); },
  drones(g, n) { [170, 183, 205, 231].forEach(f => { const b = kit.gain(0.08, g); const o = kit.osc('sawtooth', f, b, n); kit.lfo(15 + f / 40, 10, o.frequency, n); }); const a = kit.gain(0.6, g); kit.nsrc(a, n, 'bandpass', 900, 0.8); kit.lfo(9, 0.4, a.gain, n); },
  bash(g, n) { const a = kit.gain(0.9, g); kit.nsrc(a, n, 'bandpass', 2200, 0.8); kit.lfo(26, 0.7, a.gain, n, 'square'); const b = kit.gain(0.3, g); kit.nsrc(b, n, 'lowpass', 180, 1); kit.osc('sawtooth', 46, kit.gain(0.2, g), n); },
  alma(g, n) { const b = kit.gain(0.12, g); const o = kit.osc('triangle', 520, b, n); kit.lfo(5.5, 25, o.frequency, n); kit.lfo(0.7, 0.12, b.gain, n); kit.nsrc(kit.gain(0.05, g), n, 'bandpass', 1800, 6); },
  scribble(g, n) { const a = kit.gain(0.6, g); kit.nsrc(a, n, 'highpass', 3000, 0.6); kit.lfo(11, 0.6, a.gain, n, 'square'); },
  creak(g, n) { const b = kit.gain(0.25, g); const f = A.kit.ctx().createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 9; f.connect(b); const o = kit.osc('sawtooth', 62, f, n); kit.lfo(0.35, 18, o.frequency, n); kit.lfo(2.2, 0.2, b.gain, n); },
  noiseTV(g, n) { const a = kit.gain(0.7, g); kit.nsrc(a, n, 'highpass', 2500, 0.3); kit.lfo(6, 0.25, a.gain, n); },
  alarm(g, n) { const b = kit.gain(0.08, g); const o = kit.osc('square', 760, b, n); kit.lfo(2, 180, o.frequency, n, 'square'); },
  honcho(g, n) { const b = kit.gain(0.28, g); kit.osc('sawtooth', 49, b, n); kit.lfo(3.2, 0.25, b.gain, n, 'square'); const c = kit.gain(0.05, g); const o = kit.osc('triangle', 392, c, n); kit.lfo(0.25, 30, o.frequency, n); },
  amb_archives(g, n) { kit.osc('sine', 120, kit.gain(0.03, g), n); kit.osc('sine', 240, kit.gain(0.012, g), n); kit.nsrc(kit.gain(0.05, g), n, 'lowpass', 400, 0.5); },
  amb_stairwell(g, n) { const a = kit.gain(0.12, g); kit.nsrc(a, n, 'bandpass', 160, 0.5); kit.lfo(0.06, 0.08, a.gain, n); kit.osc('sine', 38, kit.gain(0.06, g), n); },
});
Object.assign(A.SFX, {
  grind: () => { A.noise({ dur: 0.9, f: 600, f2: 1600, q: 2, vol: 0.4 }); A.tone({ f: 90, dur: 0.9, type: 'square', vol: 0.06 }); },
  pop: () => { A.noise({ dur: 0.08, f: 900, q: 1, vol: 0.5 }); A.tone({ f: 300, f2: 80, dur: 0.15, vol: 0.2 }); },
  crusherWarn: () => { for (let i = 0; i < 5; i++) A.noise({ dur: 0.08, f: 180, q: 2, vol: 0.35, delay: i * 0.2 }); },
  crush: () => { A.noise({ dur: 0.4, f: 90, q: 0.6, vol: 1, type: 'lowpass' }); A.noise({ dur: 0.2, f: 2500, q: 1, vol: 0.4 }); },
  spark: () => { for (let i = 0; i < 5; i++) A.noise({ dur: 0.05, f: 4000, q: 3, vol: 0.25, delay: i * 0.06 }); },
  ticket: () => { A.tone({ f: 1200, dur: 0.06, type: 'square', vol: 0.06 }); A.noise({ dur: 0.15, f: 3000, q: 2, vol: 0.12, delay: 0.05 }); },
  ding: () => { A.tone({ f: 1318, dur: 0.6, vol: 0.12 }); A.tone({ f: 1046, dur: 0.8, vol: 0.12, delay: 0.25 }); },
  chime: () => { [12, 1].forEach((_, i) => A.tone({ f: 523, dur: 1.2, vol: 0.14, delay: i * 0.9 })); },
});

/* =====================================================================
   Materials (built lazily, after the base materials exist)
   ===================================================================== */
let MM = null;
function mats() {
  if (MM) return MM;
  MM = {};
  { // office wall: pale paint with a darker lower panel
    const S = 512, [c, x] = TK.cv(S);
    x.fillStyle = '#b6ac94'; x.fillRect(0, 0, S, 400);
    for (let i = 0; i < S; i += 4) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; x.fillRect(i, 0, 2, 400); }
    TK.blotch(x, S, 400, 10, '60,50,30', 20, 70, 0.12);
    x.fillStyle = '#5c584e'; x.fillRect(0, 400, S, 112); x.fillStyle = '#3a382f'; x.fillRect(0, 396, S, 6); x.fillStyle = '#2a2820'; x.fillRect(0, 498, S, 14);
    TK.speckle(x, S, S, 12);
    MM.wall = TK.std(TK.toTex(c), 0.9);
  }
  { // carpet tiles
    const S = 512, [c, x] = TK.cv(S);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = TK.shade('#3e4a56', G.rand(-10, 10)); x.fillRect(i * 128, j * 128, 128, 128); }
    x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 2; for (let i = 0; i <= S; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); }
    TK.speckle(x, S, S, 30);
    MM.carpet = TK.std(TK.toTex(c), 1);
  }
  { // ceiling tiles
    const S = 512, [c, x] = TK.cv(S);
    x.fillStyle = '#c8c4b8'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2000; i++) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
    x.strokeStyle = '#7a776c'; x.lineWidth = 6; for (let i = 0; i <= S; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); }
    MM.ceil = TK.std(TK.toTex(c), 0.95);
  }
  { // concrete with a hazard band near the floor
    const S = 512, [c, x] = TK.cv(S);
    x.fillStyle = '#56544e'; x.fillRect(0, 0, S, S);
    TK.blotch(x, S, S, 40, '0,0,0', 15, 70, 0.12);
    for (let i = -64; i < S; i += 64) { x.fillStyle = '#c8a018'; x.beginPath(); x.moveTo(i, S); x.lineTo(i + 32, S); x.lineTo(i + 96, S - 64); x.lineTo(i + 64, S - 64); x.fill(); }
    x.fillStyle = '#1a1a1a'; x.fillRect(0, S - 70, S, 6);
    TK.speckle(x, S, S, 24);
    MM.hazard = TK.std(TK.toTex(c), 0.9);
  }
  MM.cubicle = new THREE.MeshStandardMaterial({ color: 0x56606a, roughness: 1 });
  MM.screen = new THREE.MeshBasicMaterial({ color: 0x4a7aa0 });
  MM.meld = new THREE.MeshStandardMaterial({ color: 0x2a0a2e, roughness: 0.15, metalness: 0.2, emissive: 0x12001a });
  MM.stem = new THREE.MeshStandardMaterial({ color: 0xa86a6a, roughness: 0.5 });
  MM.green = new THREE.MeshBasicMaterial({ color: 0x30ff70 });
  MM.box = new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 0.9 });
  MM.vine = new THREE.MeshStandardMaterial({ color: 0x2a5a24, roughness: 0.9 });
  MM.flower = new THREE.MeshBasicMaterial({ color: 0x7ab0ff });
  MM.yellow = new THREE.MeshStandardMaterial({ color: 0xd8b020, roughness: 0.7 });
  return MM;
}

/* =====================================================================
   Shared helpers
   ===================================================================== */
const exitLocal = (r, e, inset = 1.2) => {
  if (e.side === 'front') return { x: e.pos, z: r.L - inset };
  if (e.side === 'right') return { x: r.xr - inset, z: e.pos };
  return { x: r.xl + inset, z: e.pos };
};
const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
function placeFree(r, w, d, margin = 0.8, zmin = 2, zmax = r.L - 1.5) {
  for (let t = 0; t < 80; t++) {
    const x = G.rand(r.xl + w / 2 + 0.3, r.xr - w / 2 - 0.3), z = G.rand(zmin + d / 2, zmax - d / 2);
    const rect = { x0: x - w / 2 - margin, x1: x + w / 2 + margin, z0: z - d / 2 - margin, z1: z + d / 2 + margin };
    if (r.placed.some(p => hit(p, rect))) continue;
    r.placed.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    return { x, z };
  }
  return null;
}
const reserveExit = r => { for (const e of r.exits) { const p = exitLocal(r, e, 1); G.reserve(r, p.x - 1.6, p.x + 1.6, p.z - 1.6, p.z + 1.6); } G.reserve(r, -1.6, 1.6, 0, 2.6); };
const roomAt = p => G.game.rooms.find(r => r.isInside(p, 0.3));
const floorAt = p => { const r = roomAt(p); return r ? (r.floorY ? r.floorY(p) : r.origin.y) : p.y; };
function sign(r, x, y, z, ry, text, sub) {
  const mat = new THREE.MeshBasicMaterial({ map: G.signTex(text, sub) }); r.mats.push(mat);
  const m = r.mesh(GEO.plane, mat, x, y, z, null, 1.2, 0.6, 1); m.rotation.y = ry; return m;
}
const lampDummy = (pos, color, base, dist) => ({ pos, color: new THREE.Color(color), base, dist, mat: new THREE.MeshBasicMaterial(), on: true, broken: false, unbreakable: true, f: 1 });

/* =====================================================================
   Archives entities
   ===================================================================== */
E.RUSH.bash = { speed: 38, passes: 1, wait: 4.2, face: 'bash', size: 2.6, sound: 'bash', breaks: true, killR: 3.4, flick: 2.2, hit: () => FL.archives.ignite() };
E.RUSH.stampede = { speed: 30, passes: 1, wait: 3, face: 'drone', size: 2.6, sound: 'drones', breaks: false, killR: 3.4, flick: 1.5, hit: () => {
  const g = G.game; g.damage(35, 'stampede');
  const it = g.inv.selected();
  if (it && g.state === 'play' && !['key', 'ekey'].includes(it.id)) { g.inv.remove(it.id); U.caption(`The Drones knocked your ${it.name} loose!`, 2.5); }
} };

function droneModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(GEO.box, M.metal); body.scale.set(0.36, 0.16, 0.36); g.add(body);
  const rotors = [];
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const arm = new THREE.Mesh(GEO.box, M.black); arm.scale.set(0.04, 0.03, 0.34); arm.position.set(a * 0.17, 0.02, b * 0.17); arm.rotation.y = Math.atan2(a, b); g.add(arm);
    const rot = new THREE.Mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.45 })); rot.scale.set(0.16, 0.01, 0.16); rot.position.set(a * 0.3, 0.08, b * 0.3); g.add(rot); rotors.push(rot);
  }
  const eye = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0xff1a1a })); eye.scale.setScalar(0.06); eye.position.set(0, -0.02, 0.19); g.add(eye);
  g.userData.rotors = rotors;
  return g;
}
class Drone {
  constructor(room) {
    this.room = room;
    const lx = G.rand(room.xl + 1, room.xr - 1), lz = G.rand(2.5, room.L - 1);
    this.m = droneModel(); this.m.position.copy(room.l2w(lx, 1.9, lz)); G.scene.add(this.m);
    this.pos = this.m.position; this.life = G.rand(25, 50); this.hitCD = 0; this.t = Math.random() * 9; this.wp = null;
    this.snd = A.loop('drone');
  }
  update(dt) {
    if (this.room.disposed) { this.remove(); return false; }
    this.life -= dt; this.t += dt; this.hitCD -= dt;
    if (this.life <= 0) { this.remove(); return false; }
    this.m.userData.rotors.forEach(r => { r.rotation.y += dt * 40; });
    const P = G.player, cam = G.camera.position, d = this.pos.distanceTo(cam);
    this.snd.set(G.clamp(1 - d / 12, 0, 1) * 0.5);
    const chase = this.room.isInside(P.pos, 0.2) && d < 7.5 && !P.hiding && G.los(this.pos, cam, G.game.cols);
    if (!this.wp || this.pos.distanceTo(this.wp) < 0.4) this.wp = this.room.l2w(G.rand(this.room.xl + 1, this.room.xr - 1), 1.9, G.rand(1, this.room.L - 1));
    const tgt = chase ? cam.clone().add(new V3(0, -0.15, 0)) : this.wp;
    const dir = tgt.clone().sub(this.pos); const len = dir.length();
    if (len > 0.01) this.pos.addScaledVector(dir, Math.min(len, (chase ? 2.5 : 1.2) * dt) / len);
    this.pos.y += Math.sin(this.t * 3) * 0.004;
    G.collideCircle(this.pos, 0.3, G.game.cols, this.pos.y + 0.2);
    this.m.rotation.y = Math.atan2(dir.x, dir.z);
    if (d < 0.8 && this.hitCD <= 0 && !P.hiding) {
      this.hitCD = 1.5; G.game.damage(15, 'drones');
      const push = P.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(5); P.vel.add(push);
    }
    return true;
  }
  remove() { G.scene.remove(this.m); this.snd.stop(); }
}
class Current {
  constructor(room, pos) {
    this.room = room; this.pos = pos; this.phase = 'idle'; this.t = G.rand(3, 7);
    this.m = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), M.water); this.m.rotation.x = -Math.PI / 2; this.m.position.copy(pos).add(new V3(0, 0.015, 0));
    room.geos.push(this.m.geometry); G.scene.add(this.m);
    this.sp = G.faceSprite('spark', 1.6); this.sp.position.copy(pos).add(new V3(0, 0.4, 0)); this.sp.visible = false; G.scene.add(this.sp);
    this.lamp = lampDummy(pos.clone().add(new V3(0, 0.5, 0)), 0x6ac8ff, 10, 6); this.lamp.on = false; room.lamps.push(this.lamp);
  }
  update(dt) {
    if (this.room.disposed) { this.remove(); return false; }
    this.t -= dt;
    const near = G.distXZ(G.player.pos, this.pos) < 9;
    if (this.phase === 'idle' && this.t <= 0) { this.phase = 'warn'; this.t = 1.2; if (near) A.sfx('spark'); }
    else if (this.phase === 'warn') {
      this.sp.visible = Math.random() < 0.3; this.sp.material.opacity = 0.5;
      if (this.t <= 0) { this.phase = 'live'; this.t = 1.4; this.done = false; this.lamp.on = true; if (near) A.sfx('static'); }
    } else if (this.phase === 'live') {
      this.sp.visible = true; this.sp.material.opacity = 1; this.sp.material.rotation = Math.random() * 6;
      this.sp.scale.setScalar(G.rand(1.8, 2.6));
      const P = G.player;
      if (!this.done && !P.hiding && G.distXZ(P.pos, this.pos) < 1.15 && Math.abs(P.pos.y - this.pos.y) < 0.5) { this.done = true; G.game.damage(25, 'currents'); P.shake = 0.6; }
      if (this.t <= 0) { this.phase = 'idle'; this.t = G.rand(4, 8); this.sp.visible = false; this.lamp.on = false; }
    }
    return true;
  }
  remove() { G.scene.remove(this.m); G.scene.remove(this.sp); }
}
class Alma {
  constructor(room) {
    this.room = room; this.pos = room.l2w((room.xl + room.xr) / 2, 0.85, room.L / 2);
    this.s = G.faceSprite('alma', 1.5); this.s.position.copy(this.pos); G.scene.add(this.s);
    this.t = 0; this.warned = false; this.snd = A.loop('alma');
  }
  update(dt) {
    if (this.room.disposed) { this.remove(); return false; }
    const cam = G.camera.position, d = cam.distanceTo(this.pos);
    this.snd.set(G.clamp(1 - d / 18, 0, 1) * 0.7);
    this.s.position.y = this.pos.y + Math.sin(performance.now() / 260) * 0.015;
    if (!this.warned && d < 16) { this.warned = true; U.caption('Someone is crying in the middle of the room... keep your eyes down.', 4); }
    const looking = !G.player.hiding && d < 15 && G.lookingAt(this.pos, 0.87) && G.los(cam, this.pos, G.game.cols);
    if (looking) {
      this.t += dt;
      if (this.t > 0.5) { G.player.shake = Math.max(G.player.shake, 0.2); U.tint('alma', true); }
      if (this.t > 1.3) { U.tint('alma', false); G.game.kill('alma'); }
    } else { this.t = Math.max(0, this.t - dt * 0.8); if (this.t < 0.4) U.tint('alma', false); }
    return true;
  }
  remove() { G.scene.remove(this.s); this.snd.stop(); U.tint('alma', false); }
}

/* ---------- Archives special rooms ---------- */
G.THEMES.archives = party => {
  const mm = mats();
  return {
    name: 'archives', wall: mm.wall, floor: mm.carpet, ceil: mm.ceil, H: 3.3, door: M.door, trim: M.metal,
    lamp: 'fluor', lampColor: party ? new THREE.Color().setHSL(Math.random(), 0.8, 0.6).getHex() : 0xf2f4ff, lampI: 12, surface: 'carpet', noPaintings: true,
    closetMat: M.metal, closetDoor: M.locker, dresserMat: M.metal,
    furn: { cabinet: 4, cubicle: 4, closet: 3, locker: 1.5, plant: 1, none: 2 }, need: ['closet'], lootFurn: 'cabinet',
  };
};
G.furn.cabinet = (room, g) => G.furn.dresser(room, g);
G.furn.cabinet.w = 1.4; G.furn.cabinet.d = 0.62;
G.furn.cubicle = (room, g) => {
  const mm = mats();
  room.box(0, 0.7, 0.03, 1.6, 1.4, 0.06, mm.cubicle, { parent: g, collide: false, uv: 1 });
  for (const s of [-1, 1]) room.box(s * 0.77, 0.7, 0.7, 0.06, 1.4, 1.3, mm.cubicle, { parent: g, collide: false, uv: 1 });
  room.box(0, 0.74, 0.4, 1.5, 0.04, 0.7, M.wood, { parent: g, collide: false });
  room.box(0, 1.02, 0.25, 0.5, 0.34, 0.06, M.black, { parent: g, collide: false });
  room.mesh(GEO.plane, mm.screen, 0, 1.02, 0.285, g, 0.44, 0.28, 1);
  room.addCol(0, 0.7, 0.7, 1.6, 1.4, 1.4, g);
  if (G.chance(0.3)) G.furn.goldPile(room, g, 0.45, 0.77, 0.45);
  else if (FL.archives.partyNow && G.chance(0.5)) pizzaBox(room, g, -0.4, 0.77, 0.45);
};
G.furn.cubicle.w = 1.65; G.furn.cubicle.d = 1.45;
function pizzaBox(room, parent, x, y, z) {
  const b = room.box(x, y + 0.03, z, 0.4, 0.05, 0.4, mats().box, { parent, collide: false, uv: 1 });
  parent.updateMatrixWorld(true);
  const it = room.addInter(parent.localToWorld(new V3(x, y + 0.1, z)), () => (it.taken ? null : 'Take pizza'), () => { if (G.game.inv.add('pizza')) { it.taken = true; b.visible = false; } }, 1.8);
}

SP.teller = (game, r) => {
  const d = r.exitDoor, ex = exitLocal(r, r.exits[0], 1.6);
  d.sealed = true; d.o.sealedLabel = 'Wait in line'; d.o.sealedMsg = 'The Teller is watching you. Take a ticket first.';
  const side = ex.x > (r.xl + r.xr) / 2 ? -1 : 1;
  const dx = r.exits[0].side === 'front' ? ex.x + side * 1.3 : ex.x, dz = r.exits[0].side === 'front' ? ex.z : ex.z + 1.3;
  r.box(dx, 0.55, dz, 1.2, 1.1, 0.6, M.darkwood);
  const s = G.faceSprite('teller', 1.0); s.position.set(dx, 1.55, dz + (r.exits[0].side === 'front' ? 0.25 : 0)); r.group.add(s);
  const queue = [];
  for (let i = 0; i < 3; i++) { const q = r.mesh(GEO.sphere, M.black, ex.x, 0.9, ex.z, null, 0.25, 0.9, 0.2); queue.push(q); q.position.x += r.exits[0].side === 'front' ? 0 : (i - 1) * 0.5; q.position.z -= r.exits[0].side === 'front' ? i * 0.5 : 0; }
  const f = FL.archives;
  const it = r.addInter(r.l2w(dx, 1.1, dz), () => (it.used ? null : 'Take a ticket'), () => {
    it.used = true; A.sfx('ticket');
    const N = G.randi(4, 7);
    f.ticket = { left: N }; f.returnAt = r.index + G.randi(2, N - 1);
    queue.forEach(q => { q.visible = false; });
    d.sealed = false;
    U.caption(`Ticket #${G.randi(10, 99)}. Return it within ${N} doors.`, 3.5);
  }, 2.2);
};
SP.ticketReturn = (game, r) => {
  const p = placeFree(r, 0.6, 0.6, 0.5) || { x: r.xl + 1, z: r.L / 2 };
  r.box(p.x, 0.6, p.z, 0.5, 1.2, 0.4, M.metal, { uv: 1 });
  r.lamp(p.x, 1.3, p.z, { type: 'bare', color: 0x60ff90, intensity: 3, dist: 4 });
  const f = FL.archives;
  const it = r.addInter(r.l2w(p.x, 1.1, p.z), () => (f.ticket && !it.used ? 'Return ticket' : null), () => {
    it.used = true; f.ticket = null; f.returnAt = -1; A.sfx('ding'); U.caption('Ticket returned. The Teller is satisfied.', 2.5);
  }, 2);
};
SP.vines = (game, r) => {
  const d = r.exitDoor, mm = mats();
  d.sealed = true; d.o.sealedLabel = 'Overgrown'; d.o.sealedMsg = 'Forget-Me-Nots seal the door. Stare at every flower until it wilts.';
  const vines = [];
  for (let i = 0; i < 9; i++) { const v = new THREE.Mesh(GEO.box, mm.vine); v.scale.set(0.06, G.rand(1.6, 2.4), 0.06); v.position.set(G.rand(-0.6, 0.6), 1.1, -0.18); v.rotation.z = G.rand(-0.9, 0.9); d.fr.add(v); vines.push(v); }
  const flowers = [];
  const n = G.randi(3, 5);
  for (let i = 0; i < n; i++) {
    const p = placeFree(r, 0.4, 0.4, 0.3, 1.5) || { x: G.rand(r.xl + 1, r.xr - 1), z: G.rand(1.5, r.L - 1.5) };
    const g = r.sub(p.x, p.z, 0);
    r.mesh(GEO.cyl, mm.vine, 0, 0.25, 0, g, 0.02, 0.5, 0.02);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; r.mesh(GEO.sphere, mm.flower, Math.cos(a) * 0.07, 0.52, Math.sin(a) * 0.07, g, 0.05, 0.03, 0.05); }
    r.mesh(GEO.sphere, M.gold, 0, 0.53, 0, g, 0.03, 0.03, 0.03);
    flowers.push({ g, pos: g.localToWorld(new V3(0, 0.5, 0)), t: 0, done: false });
  }
  let cap = false;
  r.updaters.push(dt => {
    if (game.cur !== r) return;
    if (!cap) { cap = true; U.caption('Forget-Me-Nots. Stare at each flower to make it wilt.', 4); }
    let left = 0;
    for (const f of flowers) {
      if (f.done) continue; left++;
      const cam = G.camera.position;
      if (cam.distanceTo(f.pos) < 9 && G.lookingAt(f.pos, 0.97) && G.los(cam, f.pos, game.cols)) {
        f.t += dt; f.g.scale.setScalar(Math.max(0.2, 1 - f.t / 1.6)); f.g.rotation.z = Math.sin(f.t * 20) * 0.1;
        if (f.t > 1.5) { f.done = true; f.g.visible = false; A.sfx('pop'); }
      }
    }
    if (!left && d.sealed) { d.sealed = false; vines.forEach(v => { v.visible = false; }); A.sfx('good'); U.caption('The vines wither away.', 2); }
  });
};
SP.fishTank = r => {
  const p = placeFree(r, 1.4, 0.6, 0.4); if (!p) return;
  r.box(p.x, 0.4, p.z, 1.4, 0.8, 0.6, M.darkwood);
  r.box(p.x, 1.15, p.z, 1.3, 0.7, 0.5, M.glass, { collide: false, uv: 1 });
  const fish = [];
  for (let i = 0; i < 4; i++) { const f = r.mesh(GEO.sphere, new THREE.MeshBasicMaterial({ color: G.pick([0xff8a20, 0xffd040, 0x60b0ff]) }), p.x, 1.1, p.z, null, 0.06, 0.04, 0.03); r.mats.push(f.material); fish.push({ f, a: Math.random() * 7, sp: G.rand(0.6, 1.4) }); }
  r.updaters.push(dt => { fish.forEach(o => { o.a += dt * o.sp; o.f.position.x = p.x + Math.sin(o.a) * 0.5; o.f.position.y = 1.1 + Math.sin(o.a * 1.7) * 0.15; o.f.rotation.y = Math.cos(o.a) > 0 ? 0 : Math.PI; }); });
  const it = r.addInter(r.l2w(p.x, 1.1, p.z), () => (it.fed ? null : 'Feed the Fih'), () => { it.fed = true; A.sfx('good'); U.caption('Fih are friends.', 2); }, 1.9);
};

SP.archBoundary = (game, at, n, s) => {
  const th = G.THEMES.archives(false); th.lampColor = 0xffe8c8;
  const lay = G.chooseLayout(game, at, { Wfix: 12, Lfix: 14, center: true, sides: ['front'] });
  const r = new G.Room(game, { index: n, origin: at.origin, dir: at.dir, xl: lay.xl, xr: lay.xr, L: lay.L, H: 3.6, theme: th });
  r.safe = true;
  const final = s === 25;
  if (!final) r.exits.push({ side: 'front', pos: 0, real: true, w: 2, h: 2.6 });
  const exitDoor = s >= 2 && s % 2 === 0 && !final;
  if (exitDoor) r.exits.push({ side: 'left', pos: r.L * 0.5, inset: true, fake: true });
  r.shell();
  if (!final) {
    r.makeExit(r.exits[0], { number: n + 1, w: 2, h: 2.6, mat: M.metal, noKnob: true });
    sign(r, 0, 2.95, r.L - 0.02, Math.PI, 'ELEVATOR', `TO SECTOR ${LET[s + 1]}`);
  }
  if (exitDoor) {
    const d = r.makeExit(r.exits[1], { fake: true, noAuto: true, plateText: 'EXIT', mat: M.doorDark });
    d.onFake = () => { G.ui.fade(true, 1); game.escaping = true; setTimeout(() => game.win('archives-exit'), 900); };
    r.lamp(r.xl + 0.3, 2.6, r.L * 0.5, { type: 'bare', color: 0x30ff60, intensity: 4, dist: 5 });
  }
  sign(r, 0, 2.5, 0.17, 0, `SECTOR ${LET[s]}`, final ? 'FINAL RECORD' : 'CLEARED');
  r.lamp(-3, r.H, 5, { type: 'fluor' }); r.lamp(3, r.H, 9, { type: 'fluor' });
  G.reserve(r, -1.6, 1.6, 0, 3); G.reserve(r, -2, 2, r.L - 2, r.L);
  if (exitDoor) G.reserve(r, r.xl, r.xl + 2, r.L * 0.5 - 1.5, r.L * 0.5 + 1.5);
  G.furnish(r, { sofa: 2, plant: 2, none: 1 }, { need: ['sofa', 'sofa', 'plant'], max: 5 });
  // water cooler (heals)
  const wc = placeFree(r, 0.5, 0.5, 0.5) || { x: r.xr - 1, z: 3 };
  r.box(wc.x, 0.55, wc.z, 0.45, 1.1, 0.45, M.white, { uv: 1 });
  r.mesh(GEO.cyl, M.glass, wc.x, 1.35, wc.z, null, 0.17, 0.5, 0.17);
  let sips = 3;
  const wit = r.addInter(r.l2w(wc.x, 1.1, wc.z), () => (sips > 0 ? `Drink water (${sips})` : null), () => {
    const P = G.player; if (P.hp >= 100) { U.caption('You are not thirsty.', 1.2); return; }
    sips--; P.hp = Math.min(100, P.hp + 25); U.hp(P.hp); A.sfx('gulp');
  }, 2);
  wit.kind = 'cooler';
  // supply table
  const st = placeFree(r, 1.2, 0.7, 0.5);
  if (st) {
    r.box(st.x, 0.4, st.z, 1.2, 0.8, 0.7, M.wood);
    const g = r.sub(st.x, st.z, 0);
    pizzaBox(r, g, -0.3, 0.8, 0);
    const b = r.box(0.3, 0.86, 0, 0.2, 0.1, 0.14, M.white, { parent: g, collide: false });
    const it = r.addInter(g.localToWorld(new V3(0.3, 0.9, 0)), () => (it.t ? null : 'Take bandage'), () => { if (game.inv.add('bandage')) { it.t = true; b.visible = false; } }, 1.8);
  }
  // terminal: pay gold to skip the next sector
  if (s < 24) {
    const tp = placeFree(r, 1.0, 0.6, 0.5) || { x: r.xl + 1.2, z: r.L - 3 };
    r.box(tp.x, 0.45, tp.z, 1.0, 0.9, 0.6, M.metal, { uv: 1 });
    r.box(tp.x, 1.15, tp.z, 0.6, 0.45, 0.08, M.black, { collide: false });
    const scr = r.mesh(GEO.plane, MM.green, tp.x, 1.15, tp.z + 0.045, null, 0.52, 0.36, 1); scr.material = new THREE.MeshBasicMaterial({ color: 0x0a3a1a }); r.mats.push(scr.material);
    const f = FL.archives;
    let used = false;
    r.addInter(r.l2w(tp.x, 1.1, tp.z), () => {
      if (used || (r.exitDoor && r.exitDoor.isOpen)) return null;
      return `Skip sector ${LET[s + 1]} (${100 * (f.skips + 1)} gold)`;
    }, () => {
      const cost = 100 * (f.skips + 1);
      if (game.gold < cost) { A.sfx('bad'); U.caption(`You need ${cost} gold.`, 2); return; }
      game.gold -= cost; U.gold(game.gold); f.skips++; used = true;
      f.ticket = null; f.returnAt = -1;
      game.regenNext((s + 2) * 51);
      A.sfx('ding'); U.caption(`Sector ${LET[s + 1]} skipped. The elevator goes to ${LET[s + 2]}.`, 3);
    }, 2);
  }
  r.onEnter = () => {
    A.sfx('chime');
    if (final) { game.escaping = true; U.msg('SECTOR Z CLEARED', 3, 'title'); setTimeout(() => { G.ui.fade(true, 1.2); setTimeout(() => game.win('archives'), 1200); }, 1500); return; }
    U.msg(`SECTOR ${LET[s]} CLEARED`, 3, 'title');
    U.caption(exitDoor ? 'A safe room. Heal up. The green EXIT door leads back to the Hotel.' : 'A safe room. Heal up and restock before the elevator.', 4);
  };
  return r.finish();
};

/* ---------- Honcho's office (end of sector J) ---------- */
function honchoModel() {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.6 });
  const head = new THREE.MeshStandardMaterial({ color: 0x48484e, roughness: 0.4, metalness: 0.3 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const body = new THREE.Group(); g.add(body);
  const add = (geo, mat, x, y, z, sx, sy, sz, p = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); p.add(m); return m; };
  add(GEO.box, suit, 0, 1.75, 0, 1.1, 1.3, 0.6);
  add(GEO.box, new THREE.MeshStandardMaterial({ color: 0x7a1414 }), 0, 1.85, 0.31, 0.12, 0.9, 0.02);
  const h = new THREE.Group(); h.position.set(0, 2.85, 0); body.add(h);
  add(GEO.box, head, 0, 0, 0, 0.9, 0.8, 0.8, h);
  for (const s of [-1, 1]) add(GEO.sphere, white, s * 0.2, 0.12, 0.41, 0.09, 0.05, 0.02, h);
  add(GEO.box, white, 0, -0.18, 0.41, 0.55, 0.1, 0.02, h);
  const limbs = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.65, 2.3, 0); body.add(arm); add(GEO.box, suit, 0, -0.65, 0, 0.25, 1.3, 0.25, arm);
    const leg = new THREE.Group(); leg.position.set(s * 0.28, 1.1, 0); g.add(leg); add(GEO.box, suit, 0, -0.55, 0, 0.3, 1.1, 0.3, leg);
    limbs.push(arm, leg);
  }
  g.userData = { limbs, head: h };
  return g;
}
SP.honcho = (game, at, n) => {
  const th = G.THEMES.archives(false); th.lampColor = 0xffd8a0; th.wall = M.wallD;
  const lay = G.chooseLayout(game, at, { Wfix: 20, Lfix: 26, center: true, sides: ['front'] });
  const r = new G.Room(game, { index: n, origin: at.origin, dir: at.dir, xl: lay.xl, xr: lay.xr, L: lay.L, H: 5, theme: th });
  r.safe = true;
  r.exits = [{ side: 'front', pos: 0, real: true, w: 2, h: 2.6 }];
  r.shell();
  const exit = r.makeExit(r.exits[0], { number: n + 1, w: 2, h: 2.6, mat: M.metal, noKnob: true, sealed: true, sealedLabel: 'Elevator (locked)', sealedMsg: 'Deliver all six boxes to the chute — in order.' });
  r.box(0, 0.5, r.L - 4, 5, 1, 1.4, M.darkwood);
  r.box(0, 0.006, r.L / 2, 14, 0.01, 18, M.carpet, { collide: false });
  for (const [x, z] of [[-6, 6], [6, 6], [-6, 18], [6, 18], [0, 12]]) r.lamp(x, r.H, z, { type: 'chandelier', intensity: 16, dist: 14 });
  // the chute
  r.box(0, 0.012, r.L / 2, 1.8, 0.02, 1.8, M.black, { collide: false });
  for (const [x, z, w, d] of [[0, -0.95, 2.1, 0.12], [0, 0.95, 2.1, 0.12], [-0.95, 0, 0.12, 2.1], [0.95, 0, 0.12, 2.1]]) r.box(x, 0.03, r.L / 2 + z, w, 0.06, d, mats().yellow, { collide: false });
  G.reserve(r, -2, 2, r.L / 2 - 2, r.L / 2 + 2); G.reserve(r, -3, 3, r.L - 6, r.L); G.reserve(r, -1.6, 1.6, 0, 3);
  const boxes = [];
  for (let i = 1; i <= 6; i++) {
    const p = placeFree(r, 0.6, 0.6, 1.0) || { x: G.rand(r.xl + 1, r.xr - 1), z: G.rand(3, r.L - 6) };
    const [c, x] = TK.cv(128); x.fillStyle = '#9a7a4a'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#2a1a0a'; x.font = '700 80px Oswald, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(i, 64, 68);
    const mat = new THREE.MeshStandardMaterial({ map: TK.toTex(c, false) }); r.mats.push(mat);
    const m = r.mesh(GEO.box, mat, p.x, 0.3, p.z, null, 0.6, 0.6, 0.6);
    const b = { i, m, home: new V3(p.x, 0.3, p.z), held: false, done: false };
    boxes.push(b);
    b.it = r.addInter(r.l2w(p.x, 0.5, p.z), () => (b.held || b.done || h.carry ? null : `Pick up box ${i}`), () => {
      h.carry = b; b.held = true; m.visible = false; G.player.speedMul = 0.85; A.sfx('pickup');
    }, 1.8);
  }
  const h = { next: 1, carry: null, active: false, stun: 0, path: [], pi: 0, repath: 0, walk: 0 };
  const drop = () => {
    const b = h.carry; if (!b) return;
    h.carry = null; G.player.speedMul = 1; b.held = false;
    if (b.i === h.next) { b.done = true; h.next++; A.sfx('good'); U.caption(`Box ${b.i} delivered. ${h.next <= 6 ? 'Next: ' + h.next : ''}`, 2); }
    else { b.m.position.copy(b.home); b.m.visible = true; A.sfx('bad'); U.caption(`Wrong order! Box ${b.i} went back. Next is ${h.next}.`, 2.5); h.speedBonus = (h.speedBonus || 0) + 0.25; }
    if (h.next > 6) {
      exit.sealed = false; exit.open(); h.active = false; h.done = true;
      U.msg('ALL BOXES DELIVERED', 2.5); U.caption('Honcho slumps back into his chair. The elevator is open.', 3);
      if (h.snd) h.snd.set(0, 1);
    }
  };
  r.addInter(r.l2w(0, 0.6, r.L / 2), () => (h.carry ? `Drop box ${h.carry.i} in the chute` : null), drop, 2.4);
  const hm = honchoModel(); hm.position.copy(r.l2w(0, 0, r.L - 2.2)); hm.rotation.y = r.dir * Math.PI / 2 + Math.PI; G.scene.add(hm);
  r.onDispose = () => { G.scene.remove(hm); if (h.snd) h.snd.stop(); G.player.speedMul = 1; };
  r.onEnter = () => { U.caption('An executive office. Someone important sits behind that desk...', 3.5); };
  r.updaters.push(dt => {
    if (game.state !== 'play') return;
    const P = G.player;
    if (!h.active && !h.done && game.cur === r) {
      const lp = r.w2l(P.pos);
      if (lp.z > r.L - 9) {
        h.active = true; A.sfx('roar'); P.shake = 0.8;
        U.msg('"YOU\'RE LATE."', 2.5, 'run'); U.caption('HONCHO: Sort those boxes. In order. NOW.', 4);
        h.snd = A.loop('honcho'); h.snd.set(0.6, 0.5);
        r.nav = new G.Nav(r);
      }
    }
    if (!h.active) return;
    const d = G.distXZ(hm.position, P.pos);
    if (h.stun > 0) { h.stun -= dt; return; }
    h.repath -= dt;
    if (h.repath <= 0) { h.path = r.nav.path(hm.position, P.pos) || []; h.pi = 0; h.repath = 0.4; }
    let move = (3.4 + (h.speedBonus || 0)) * dt;
    while (move > 0 && h.pi < h.path.length) {
      const tg = h.path[h.pi], dx = tg.x - hm.position.x, dz = tg.z - hm.position.z, dd = Math.hypot(dx, dz);
      if (dd > 0.01) hm.rotation.y = Math.atan2(dx, dz);
      if (dd <= move) { hm.position.x = tg.x; hm.position.z = tg.z; h.pi++; move -= dd; h.walk += dd; }
      else { hm.position.x += dx / dd * move; hm.position.z += dz / dd * move; h.walk += move; move = 0; }
    }
    hm.userData.limbs.forEach((l, i) => { l.rotation.x = Math.sin(h.walk * 2.4 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.7; });
    hm.userData.head.rotation.z = Math.sin(h.walk) * 0.12;
    if (d < 1.3 && !P.hiding && !game.escaping) {
      game.scare('honcho', 30);
      if (game.state !== 'play') return;
      if (h.carry) { const b = h.carry; h.carry = null; P.speedMul = 1; b.held = false; b.m.position.copy(b.home); b.m.visible = true; }
      P.pos.copy(r.l2w(G.rand(-6, 6), 0, G.rand(2, 5)));
      hm.position.copy(r.l2w(0, 0, r.L - 2.2)); h.stun = 3;
      U.caption('Honcho threw you across the office. Keep sorting.', 3);
    }
  });
  return r.finish();
};

/* ---------- Archives floor ---------- */
FL.archives = {
  id: 'archives', name: 'The Archives', tag: 'SUB-FLOOR', color: '#c8b878', face: 'honcho', range: 'A-000 – Z-050',
  desc: '26 sectors of offices and records. Dodge Drones and Bash, hide from Scribbles, return the Teller\'s ticket, never look at Alma — and survive Honcho.',
  start: 0, end: 25 * 51 + 50, ambient: 'archives', fog: [0x07080a, 0.045],
  plate: n => LET[Math.floor(n / 51)] + '-' + G.pad(n % 51, 3),
  init() {
    this.skips = 0; this.party = G.chance(0.6) ? G.pick([3, 4, 5, 6, 7, 11, 12, 14, 16, 18, 20, 22]) : -1;
    this.clock = 0; this.hour = 12; this.ticket = null; this.returnAt = -1; this.ransom = null; this.burn = 0; this.scrib = null; this.lastBash = 0; this.partyNow = false;
    U.timer(true);
  },
  cleanup() { U.timer(false); U.tint('fire', false); U.tint('alma', false); this.endScribbles(); this.endRansom(); },
  build(game, n, at) {
    const s = Math.floor(n / 51), k = n % 51;
    if (k === 50) return s === 9 ? SP.honcho(game, at, n) : SP.archBoundary(game, at, n, s);
    const party = this.partyNow = s === this.party;
    const cfg = {
      theme: G.THEMES.archives(party), kind: G.weighted({ hall: 3, room: 4, big: 2, small: 2 }), noBackGap: n === 0,
      locked: k > 2 && G.chance(0.16), dark: s >= 1 && !party && G.chance(0.16),
    };
    const teller = s >= 1 && k > 2 && k < 42 && !this.ticket && this.returnAt < 0 && G.chance(0.06);
    const vines = s >= 2 && !teller && k > 2 && k < 49 && G.chance(0.07);
    if (teller || vines) cfg.locked = false;
    const r = G.buildStandard(game, n, at, cfg);
    reserveExit(r);
    if (teller) SP.teller(game, r);
    else if (vines) SP.vines(game, r);
    if (n === this.returnAt) SP.ticketReturn(game, r);
    if (G.chance(party ? 0.7 : 0.32)) for (let i = 0; i < (party ? 2 : G.randi(1, 2)); i++) game.spawn(new Drone(r));
    if (s >= 2 && G.chance(0.3)) for (let i = 0; i < G.randi(1, 2); i++) { const p = placeFree(r, 2, 2, 0.2, 2, r.L - 2); if (p) game.spawn(new Current(r, r.l2w(p.x, 0, p.z))); }
    if (s >= 5 && k > 2 && !teller && G.chance(0.05)) game.spawn(new Alma(r));
    if (G.chance(0.07)) SP.fishTank(r);
    if (party) { for (let i = 0; i < 3; i++) { const p = placeFree(r, 0.5, 0.5, 0.3); if (p) { const g = r.sub(p.x, p.z, 0); G.furn.goldPile(r, g, 0, 0.02, 0); } } r.lamps.forEach(L => { L.buzz = true; }); }
    this.partyNow = false;
    return r;
  },
  onEnter(game, room) {
    game.hideLimit = 25; game.goldMul = Math.floor(room.index / 51) === this.party ? 2 : 1;
    const s = Math.floor(room.index / 51), k = room.index % 51;
    if (k === 0) {
      U.msg(`SECTOR ${LET[s]}`, 2.5, 'title');
      if (s === this.party) U.caption('PIZZA PARTY! Loot everything... but mind the Drones.', 4);
      else if (s === 0) U.caption('The Archives. Watch the clock — at 9 and 5 the Drones stampede.', 5);
      else if (s === 2) U.caption('Puddles can carry current from here on. Listen for the crackle.', 4);
    }
  },
  onDoorOpen(game, door) {
    const n = door.number, s = Math.floor(n / 51), k = n % 51;
    if (this.ticket) {
      this.ticket.left--;
      if (this.ticket.left <= 0) { this.ticket = null; this.returnAt = -1; game.scare('teller', 50); U.caption("You didn't return the Teller's ticket.", 3); }
    }
    if (k <= 1 || k >= 50) return;
    if (n - this.lastBash > 5 && !game.rush && G.chance(0.07)) { this.lastBash = n; game.spawn(new E.Rusher('bash')); }
    else if (s >= 1 && !this.scrib && G.chance(0.035)) this.startScribbles();
    else if (s >= 3 && !this.ransom && G.chance(0.03)) this.startRansom(game);
  },
  ignite() { this.burn = 3.2; U.caption('YOU ARE ON FIRE!', 2); U.tint('fire', true); },
  startScribbles() {
    const c = document.getElementById('scribbles');
    c.width = innerWidth; c.height = innerHeight; c.classList.remove('hidden');
    this.scrib = { t: 0, dmgT: 0.6, hideT: 0, ctx: c.getContext('2d'), snd: A.loop('scribble') };
    this.scrib.snd.set(0.6, 0.3);
    A.sfx('attack'); U.caption('Something is scribbling over your eyes — HIDE!', 3);
  },
  endScribbles() {
    if (!this.scrib) return;
    this.scrib.snd.stop(); this.scrib = null;
    const c = document.getElementById('scribbles'); c.classList.add('hidden'); c.getContext('2d').clearRect(0, 0, c.width, c.height);
  },
  startRansom(game) {
    const demand = G.randi(4, 12) * 5;
    this.ransom = { demand };
    game.itemsLocked = true; if (game.light) game.setLight(null);
    document.getElementById('rs-text').textContent = `PAY ${demand} GOLD`;
    document.getElementById('ransom').classList.remove('hidden'); document.body.classList.add('hacked');
    A.sfx('static'); A.sfx('bad');
  },
  endRansom() {
    this.ransom = null; G.game.itemsLocked = false;
    document.getElementById('ransom').classList.add('hidden'); document.body.classList.remove('hacked');
  },
  onKey(game, e) {
    if (e.code === 'KeyG' && this.ransom) {
      if (game.gold >= this.ransom.demand) { game.gold -= this.ransom.demand; U.gold(game.gold); this.endRansom(); A.sfx('gold'); U.caption('Ransom paid. Your screen is yours again.', 2.5); }
      else { A.sfx('bad'); U.caption(`You need ${this.ransom.demand} gold. Search drawers and closets.`, 2.5); }
      return true;
    }
    return false;
  },
  update(game, dt) {
    const cur = game.cur, P = G.player;
    // the Clock: an hour every 25 seconds; the Drones stampede at 9 and 5
    if (!cur || !cur.safe) this.clock += dt;
    const hour = ((Math.floor(this.clock / 25) + 11) % 12) + 1, mins = Math.floor((this.clock % 25) / 25 * 60);
    if (hour !== this.hour) {
      this.hour = hour; A.sfx('bell');
      if ((hour === 9 || hour === 5) && cur && !cur.safe && !game.rush) { U.msg(`${hour} O'CLOCK`, 2, 'run'); U.caption('The Drones are stampeding — HIDE!', 3); game.spawn(new E.Rusher('stampede')); }
    }
    const soon = (hour === 8 || hour === 4) && mins >= 30;
    U.timerText(`${hour}:${String(mins).padStart(2, '0')}`, soon);
    // fire from Bash
    if (this.burn > 0) {
      this.burn -= dt; this._bt = (this._bt || 0) - dt;
      if (this._bt <= 0) { this._bt = 0.3; game.damage(5, 'bash'); }
      if (this.burn <= 0) U.tint('fire', false);
    }
    // Scribbles
    const sc = this.scrib;
    if (sc) {
      sc.t += dt;
      const x = sc.ctx, w = x.canvas.width, h = x.canvas.height;
      x.strokeStyle = `rgba(10,10,10,${0.5 + Math.random() * 0.4})`; x.lineWidth = G.rand(3, 9); x.lineCap = 'round';
      for (let i = 0; i < 4; i++) { let px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += G.rand(-90, 90); py += G.rand(-90, 90); x.lineTo(px, py); } x.stroke(); }
      if (Math.random() < dt * 1.5) { const ex = Math.random() * w, ey = Math.random() * h; x.fillStyle = '#000'; x.beginPath(); x.arc(ex, ey, 30, 0, 7); x.arc(ex + 80, ey, 30, 0, 7); x.fill(); x.fillStyle = '#eee'; x.beginPath(); x.arc(ex + 4, ey, 6, 0, 7); x.arc(ex + 84, ey, 6, 0, 7); x.fill(); }
      if (P.hiding) { sc.hideT += dt; if (sc.hideT > 1.2) { this.endScribbles(); U.caption('Scribbles lost you.', 2); } }
      else { sc.dmgT -= dt; if (sc.dmgT <= 0) { sc.dmgT = 0.5; game.damage(4, 'scribbles'); } if (sc.t > 16) this.endScribbles(); }
    }
    if (this.ransom && Math.random() < dt * 2) G.player.shake = Math.max(G.player.shake, 0.15);
    U.extra(this.ticket ? `🎟 Return the ticket within ${this.ticket.left} doors` : (this.ransom ? '🔒 Inventory locked by Ransom' : ''));
  },
};

/* =====================================================================
   Stairwell
   ===================================================================== */
G.SIZES.depot = { W: [14, 18], L: [16, 22], sides: ['front', 'left', 'right'] };
G.SIZES.landing = { W: [6, 8], L: [6, 8.5], sides: ['front', 'left', 'right'] };
G.THEMES.stairwell = () => {
  const mm = mats();
  return {
    name: 'stairwell', wall: mm.hazard, floor: M.concreteDark, ceil: M.concreteDark, H: 4, door: M.doorDark, trim: M.metal,
    lamp: 'lantern', lampColor: 0xfff0c8, lampI: 14, lampD: 12, surface: 'metal', noPaintings: true, closetMat: M.rust, closetDoor: M.metal, dresserMat: M.rust,
    furn: { locker: 3, crate: 3, barrel: 2, pipes: 1, none: 3 }, need: ['locker'], lootFurn: 'toolbox',
  };
};

function creakModel() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const add = (x, y, z, sx, sy, sz, rx = 0) => { const m = new THREE.Mesh(GEO.sphere, dark); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; g.add(m); return m; };
  add(0, 1.5, 0, 0.2, 0.75, 0.14);
  for (const s of [-1, 1]) { const a = add(s * 0.24, 1.4, 0.05, 0.05, 0.9, 0.05); a.rotation.z = s * 0.12; add(s * 0.1, 0.55, 0, 0.06, 0.6, 0.06); }
  const face = G.faceSprite('creak', 0.9); face.position.set(0, 2.45, 0.05); g.add(face);
  g.userData.face = face;
  return g;
}
class Creak {
  constructor(room, pos) {
    this.room = room; this.m = creakModel(); this.m.position.copy(pos); G.scene.add(this.m);
    this.pos = this.m.position; this.stare = 0; this.warned = false; this.snd = A.loop('creak'); this.t = 0;
  }
  update(dt) {
    if (this.room.disposed) { this.remove(); return false; }
    const P = G.player, cam = G.camera.position;
    this.t += dt;
    const head = this.pos.clone().add(new V3(0, 2.3, 0));
    const d3 = cam.distanceTo(head), dxz = G.distXZ(this.pos, P.pos);
    if (dxz > 30) { this.snd.set(0); return true; }
    const seen = G.frustum.containsPoint(head) && G.lookingAt(head, 0.72) && G.los(cam, head, G.game.cols);
    this.snd.set(G.clamp(1 - d3 / 20, 0, 1) * (seen ? 0.2 : 0.7));
    if (seen) {
      this.stare += dt;
      if (this.stare > 1.4 && !this.warned) { this.warned = true; U.caption('Look away... it hates being watched.', 2.5); }
      if (this.stare > 1.4) { P.shake = Math.max(P.shake, (this.stare - 1.4) * 0.4); U.tint('creak', true); }
      if (this.stare > 2.9) { U.tint('creak', false); G.game.kill('creak', this); return true; }
      if (this.stare < 1.2 && dxz < 10) { const away = this.pos.clone().sub(P.pos).setY(0).normalize(); this.pos.addScaledVector(away, 0.9 * dt); }
      this.m.userData.face.material.rotation = Math.sin(this.t * 30) * 0.05 * this.stare;
    } else {
      this.stare = Math.max(0, this.stare - dt * 0.6); if (this.stare < 1.4) U.tint('creak', false);
      if (!P.hiding) {
        const dir = P.pos.clone().sub(this.pos).setY(0); const len = dir.length();
        if (len > 0.01) { this.pos.addScaledVector(dir, Math.min(len, 3.5 * dt) / len); this.m.rotation.y = Math.atan2(dir.x, dir.z); }
        G.collideCircle(this.pos, 0.35, G.game.cols, this.pos.y + 1.6);
      }
      this.m.userData.face.material.rotation = Math.sin(this.t * 2) * 0.3;
    }
    this.pos.y = floorAt(this.pos);
    if (dxz < 0.9 && Math.abs(this.pos.y - P.pos.y) < 1.6 && !P.hiding) G.game.kill('creak', this);
    return true;
  }
  remove() { G.scene.remove(this.m); this.snd.stop(); U.tint('creak', false); }
}
class Noise {
  constructor(room, pos, screen) {
    this.room = room; this.tv = pos.clone(); this.screen = screen; this.state = 'off'; this.t = 0;
    this.s = G.faceSprite('noise', 2.0); this.s.visible = false; G.scene.add(this.s);
    this.pos = pos.clone();
  }
  update(dt) {
    if (this.room.disposed && this.state === 'off') { this.remove(); return false; }
    const P = G.player, g = G.game;
    if (this.state === 'off') {
      if (this.room.isInside(P.pos) && G.distXZ(P.pos, this.tv) < 7) {
        this.state = 'wake'; this.t = 1.8; A.sfx('static');
        this.snd = A.loop('noiseTV'); this.snd.set(0.4);
        U.caption('The TV flickers on... something is copying your steps.', 3.5);
      }
      return true;
    }
    this.screen.color.setHex(Math.random() < 0.5 ? 0xffffff : 0x888888);
    if (this.state === 'wake') { this.t -= dt; if (this.t <= 0) { this.state = 'follow'; this.ci = Math.max(0, g.crumbs.length - 1); this.s.visible = true; } return true; }
    const cr = g.crumbs, dist = this.pos.distanceTo(P.pos);
    if (P.moving) {
      let move = 4.0 * (dist > 14 ? 1.7 : 1) * dt;
      while (move > 0 && this.ci < cr.length) {
        const tg = cr[this.ci], v = tg.clone().sub(this.pos), dd = v.length();
        if (dd <= move) { this.pos.copy(tg); this.ci++; move -= dd; } else { this.pos.addScaledVector(v, move / dd); move = 0; }
      }
    }
    this.s.position.copy(this.pos).add(new V3(G.rand(-0.06, 0.06), 1.4, G.rand(-0.06, 0.06)));
    this.s.material.opacity = 0.7 + Math.random() * 0.3;
    if (this.snd) this.snd.set(G.clamp(1 - dist / 16, 0.1, 1) * 0.8);
    if (dist < 1.0 && !P.hiding) g.kill('noise', this);
    return true;
  }
  smash() { this.screen.color.setHex(0x050505); A.sfx('break'); if (this.state !== 'off') U.caption('The screen shatters. Noise is gone.', 2.5); G.game.despawn(this); }
  remove() { G.scene.remove(this.s); if (this.snd) this.snd.stop(); }
}
class Stem {
  constructor(room, pos) {
    this.room = room;
    const g = this.m = new THREE.Group();
    const ball = new THREE.Mesh(GEO.sphere, mats().stem); ball.scale.setScalar(0.32); g.add(ball);
    const mouth = new THREE.Mesh(GEO.sphere, M.black); mouth.scale.set(0.2, 0.1, 0.1); mouth.position.set(0, -0.02, 0.27); g.add(mouth);
    for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), M.white); t.position.set(-0.12 + i * 0.05, 0.03, 0.3); t.rotation.z = Math.PI; g.add(t); }
    g.position.copy(pos).add(new V3(0, 0.32, 0)); G.scene.add(g);
    this.pos = g.position; this.cd = 0.8; this.roll = 0;
    FL.stairwell.stems.push(this);
  }
  update(dt) {
    if (this.room.disposed) { G.game.despawn(this); return false; }
    const P = G.player; this.cd -= dt;
    if (this.room.isInside(P.pos, 0.5) && !P.hiding) {
      const v = P.pos.clone().sub(this.pos).setY(0), len = v.length();
      if (len > 0.01) { this.pos.addScaledVector(v, Math.min(len, 2.6 * dt) / len); this.m.rotation.y = Math.atan2(v.x, v.z); }
      G.collideCircle(this.pos, 0.3, G.game.cols, this.pos.y + 0.5);
      this.roll += dt * 8; this.m.children[0].rotation.x = this.roll;
      if (len < 0.75 && this.cd <= 0) { this.cd = 1.2; G.game.damage(12, 'stems'); this.pos.addScaledVector(v, -1 / Math.max(len, 0.1)); A.sfx('hurt'); }
    }
    this.pos.y = this.room.origin.y + 0.32 + Math.abs(Math.sin(this.roll)) * 0.06;
    return true;
  }
  remove() { G.scene.remove(this.m); const a = FL.stairwell.stems; const i = a.indexOf(this); if (i >= 0) a.splice(i, 1); }
}

SP.stairs = (game, at, n) => {
  const th = G.THEMES.stairwell(), W = 3.6, Ls = 13, drop = 4.2, H = 4.4;
  const lay = G.chooseLayout(game, at, { Wfix: W, Lfix: Ls, center: true, sides: ['front'] });
  const r = new G.Room(game, { index: n, origin: at.origin, dir: at.dir, xl: -W / 2, xr: W / 2, L: Ls, H, theme: th });
  r.exits = [{ side: 'front', pos: 0, real: true, y: -drop }];
  const top = 1.2, bot = Ls - 1.4, steps = 16;
  r.floorY = p => r.origin.y - drop * G.clamp((r.w2l(p).z - top) / (bot - top), 0, 1);
  r.box(0, -0.1, top / 2, W + 0.4, 0.2, top, M.grate, { collide: false, uv: 2 });
  r.box(0, -drop - 0.1, (bot + Ls) / 2 + 0.1, W + 0.4, 0.2, Ls - bot + 0.2, M.grate, { collide: false, uv: 2 });
  const sl = (bot - top) / steps;
  for (let i = 0; i < steps; i++) {
    const y = -drop * (i + 0.5) / steps, z = top + sl * (i + 0.5);
    r.box(0, (y - drop - 0.3) / 2, z, W, y + drop + 0.3, sl, M.concrete, { collide: false, uv: 2 });
    r.box(0, y + 0.01, z + sl / 2 - 0.04, W, 0.02, 0.06, mats().yellow, { collide: false });
  }
  const wall = th.wall, hgt = H + drop, cy = (H - drop) / 2;
  r.box(r.xr + 0.1, cy, Ls / 2, 0.2, hgt, Ls + 0.2, wall, { uv: 4 });
  r.box(r.xl - 0.1, cy, Ls / 2, 0.2, hgt, Ls + 0.2, wall, { uv: 4 });
  const gw = G.DW + 0.1, gh = G.DH + 0.05, seg = (W - gw) / 2;
  for (const s of [-1, 1]) {
    r.box(s * (gw / 2 + seg / 2), cy, 0.075, seg, hgt, 0.15, wall, { uv: 4 });
    r.box(s * (gw / 2 + seg / 2), cy, Ls + 0.1, seg, hgt, 0.2, wall, { uv: 4 });
  }
  r.box(0, (gh + H) / 2, 0.075, gw, H - gh, 0.15, wall, { collide: false, uv: 4 });
  r.box(0, -drop / 2, 0.075, gw, drop, 0.15, wall, { collide: false, uv: 4 });
  r.box(0, (-drop + gh + H) / 2, Ls + 0.1, gw, H + drop - gh, 0.2, wall, { collide: false, uv: 4 });
  r.box(0, H + 0.1, Ls / 2, W + 0.4, 0.2, Ls + 0.4, th.ceil, { collide: false, uv: 4 });
  // railing
  const rail = r.mesh(GEO.box, M.metal, r.xr - 0.15, 0, (top + bot) / 2, null, 0.05, 0.05, Math.hypot(bot - top, drop));
  rail.position.y = -drop / 2 + 0.95; rail.rotation.x = Math.atan2(drop, bot - top);
  for (let i = 0; i <= 4; i++) { const z = top + (bot - top) * i / 4, y = -drop * i / 4; r.mesh(GEO.box, M.metal, r.xr - 0.15, y + 0.47, z, null, 0.04, 0.95, 0.04); }
  r.makeExit(r.exits[0], { number: n + 1 });
  r.lamp(0, H, 2.5, { type: 'lantern', buzz: G.chance(0.3) });
  r.lamp(0, -drop + 3.4, Ls - 1.2, { type: 'lantern', buzz: G.chance(0.3) });
  if (n >= 5 && G.chance(0.4)) {
    const lower = G.chance(0.6);
    game.spawn(new Creak(r, lower ? r.l2w(0, -drop, Ls - 0.9) : r.l2w(0, 0, 0.7)));
  }
  r.finish();
  r.path = [r.l2w(0, 1.6, 0.6), r.l2w(0, 1.6 - drop / 2, Ls / 2), r.exitPt.clone()];
  return r;
};

function stairCfg(n, kind) { return { theme: G.THEMES.stairwell(), kind, noBackGap: n === 0, locked: false }; }
SP.landing = (game, at, n) => {
  const r = G.buildStandard(game, n, at, Object.assign(stairCfg(n, 'landing'), { sides: ['front', 'left', 'right'] }));
  sign(r, (r.xl + r.xr) / 2, 2.9, 0.17, 0, `LANDING ${n / 2}`, n === 0 ? 'THE STAIRWELL' : 'KEEP DESCENDING');
  reserveExit(r);
  if (G.chance(0.5)) salvage(r);
  if (n >= 6 && G.chance(0.1)) game.spawn(new Creak(r, r.l2w(G.rand(r.xl + 1, r.xr - 1), 0, r.L - 1.5)));
  return r;
};
function salvage(r) {
  const p = placeFree(r, 0.6, 0.6, 0.4); if (!p) return;
  const kind = G.randi(0, 2), mat = G.pick([M.rust, M.metal, M.beam]);
  const m = kind === 0 ? r.mesh(GEO.cyl, mat, p.x, 0.25, p.z, null, 0.18, 0.5, 0.18) : kind === 1 ? r.mesh(GEO.box, mat, p.x, 0.18, p.z, null, 0.5, 0.36, 0.4) : r.mesh(GEO.sphere, mat, p.x, 0.2, p.z, null, 0.25, 0.2, 0.25);
  const it = r.addInter(r.l2w(p.x, 0.4, p.z), () => (it.taken ? null : 'Take salvage'), () => {
    const f = FL.stairwell;
    if (f.salvage.length >= 5) { U.caption('Your arms are full. Scrap it at a Scrapper first.', 2); return; }
    it.taken = true; m.visible = false; f.salvage.push(G.randi(1, 4)); A.sfx('pickup');
  }, 1.8);
}
function scrapper(r, x, z) {
  r.box(x, 0.7, z, 1.2, 1.4, 1.0, M.rust, { uv: 1 });
  r.box(x, 1.5, z, 0.9, 0.2, 0.7, M.black, { collide: false });
  r.lamp(x, 1.8, z, { type: 'bare', color: 0xffa040, intensity: 3, dist: 5 });
  r.addInter(r.l2w(x, 1.2, z), () => { const f = FL.stairwell; return f.salvage.length ? `Scrap salvage (${f.salvage.length})` : null; }, () => {
    const f = FL.stairwell, v = f.salvage.reduce((a, b) => a + b, 0);
    f.scrap += v; f.salvage = []; A.sfx('grind'); U.caption(`+${v} Scrap`, 2);
  }, 2.2);
}
SP.depot = (game, at, n, landing) => {
  const th = G.THEMES.stairwell(); th.H = 5.5;
  const r = G.buildStandard(game, n, at, Object.assign(stairCfg(n, 'depot'), { H: 5.5 }));
  sign(r, 0, 3.4, 0.17, 0, `DEPOT ${landing}`, 'SALVAGE · SCRAP · SURVIVE');
  reserveExit(r);
  const mm = mats(), cx = (r.xl + r.xr) / 2;
  // crusher lane across the middle
  let crusherZ = null;
  if (landing >= 4 && G.chance(0.45)) { crusherZ = r.L * G.rand(0.45, 0.6); G.reserve(r, r.xl, r.xr, crusherZ - 1.6, crusherZ + 1.6); }
  // meld + fire escape
  const meld = landing >= 8 && G.chance(0.3);
  let esc = null;
  if (meld) {
    const ex = r.exits[0].side === 'left' ? 'right' : 'left';
    const x0 = ex === 'left' ? r.xl : r.xr - 2.4;
    esc = { x0, x1: x0 + 2.4, z0: 0.3, z1: 2.8 };
    G.reserve(r, esc.x0, esc.x1, esc.z0, esc.z1 + 0.4);
  }
  scrapper(r, r.xl + 1, 3.6); G.reserve(r, r.xl, r.xl + 2, 2.8, 4.4);
  // storage racks
  for (let i = 0; i < G.randi(3, 6); i++) { const p = placeFree(r, G.rand(2, 3.5), 0.8, 1.2, 3); if (p) { r.box(p.x, 1.2, p.z, 2.8, 2.4, 0.8, M.rust, { uv: 1 }); r.box(p.x, 2.45, p.z, 2.9, 0.06, 0.85, M.metal, { collide: false }); } }
  for (let i = 0; i < G.randi(3, 6); i++) salvage(r);
  // containers: loot or Stems
  for (let i = 0; i < G.randi(2, 4); i++) {
    const p = placeFree(r, 1.0, 0.8, 0.6); if (!p) continue;
    const body = r.box(p.x, 0.4, p.z, 1.0, 0.8, 0.8, M.locker, { uv: 1 });
    const lid = r.box(p.x, 0.83, p.z, 1.04, 0.06, 0.84, M.metal, { collide: false });
    const it = r.addInter(r.l2w(p.x, 0.8, p.z), () => (it.open ? null : 'Open container'), () => {
      it.open = true; lid.position.y += 0.25; lid.rotation.x = -0.6; A.sfx('drawer'); game.noise(G.player.pos, 6);
      const roll = Math.random();
      if (roll < 0.35 && landing >= 2) { const k = G.randi(2, 3); for (let s = 0; s < k; s++) game.spawn(new Stem(r, r.l2w(p.x + G.rand(-0.4, 0.4), 0, p.z + 0.8))); U.caption('Stems! Click them to pop them.', 2.5); A.sfx('attack'); }
      else if (roll < 0.7) { FL.stairwell.salvage.length < 5 ? (FL.stairwell.salvage.push(G.randi(2, 5)), U.caption('Valuable salvage.', 1.5), A.sfx('pickup')) : game.addGold(G.randi(5, 15)); }
      else if (roll < 0.85) game.addGold(G.randi(6, 18));
      else game.inv.add(G.pick(['bandage', 'battery', 'lockpick', 'lighter']));
    }, 1.9);
    body.userData.container = true;
  }
  // TV → Noise
  if (landing >= 3 && G.chance(0.45)) {
    const p = placeFree(r, 1, 1, 1.2, 5);
    if (p) {
      r.box(p.x, 0.45, p.z, 0.9, 0.9, 0.9, M.beam, { uv: 1 });
      r.box(p.x, 1.2, p.z, 0.8, 0.6, 0.5, M.black, { collide: false });
      const scr = new THREE.MeshBasicMaterial({ color: 0x0a0a0a }); r.mats.push(scr);
      const sm = r.mesh(GEO.box, scr, p.x, 1.2, p.z, null, 0.66, 0.46, 0.52);
      const nz = game.spawn(new Noise(r, r.l2w(p.x, 0, p.z), scr));
      const it = r.addInter(r.l2w(p.x, 1.2, p.z), () => (it.done ? null : 'Smash TV'), () => { it.done = true; sm.scale.y = 0.2; nz.smash(); }, 2.2);
    }
  }
  // crusher
  if (crusherZ !== null) {
    const W = r.xr - r.xl, wallG = r.sub(r.xl - W / 2 - 0.3, crusherZ, 0);
    r.box(0, 1.6, 0, W, 3.2, 0.7, M.metal, { parent: wallG, collide: false, uv: 2 });
    for (let i = 0; i < Math.floor(W / 0.6); i++) for (const zz of [-1, 1]) { const c = r.mesh(new THREE.ConeGeometry(0.1, 0.35, 5), M.white, -W / 2 + 0.3 + i * 0.6, G.rand(0.3, 2.9), zz * 0.5, wallG); c.rotation.x = zz * Math.PI / 2; r.geos.push(c.geometry); }
    for (const s of [-1, 1]) r.box(cx, 0.012, crusherZ + s * 0.95, W, 0.02, 0.15, mm.yellow, { collide: false });
    const cr = { phase: 'idle', t: G.rand(2, 4) }, out = r.xl - W / 2 - 0.3, inX = cx;
    r.updaters.push(dt => {
      cr.t -= dt;
      const pl = r.w2l(G.player.pos), near = game.cur === r && Math.abs(pl.z - crusherZ) < 8;
      if (cr.phase === 'idle' && cr.t <= 0) { cr.phase = 'warn'; cr.t = 1.2; if (near) { A.sfx('crusherWarn'); G.player.shake = Math.max(G.player.shake, 0.25); } }
      else if (cr.phase === 'warn') { wallG.position.x = out + Math.sin(performance.now() / 20) * 0.08 + (1.2 - cr.t) * 0.3; if (cr.t <= 0) { cr.phase = 'slam'; cr.t = 0.18; if (near) A.sfx('crush'); } }
      else if (cr.phase === 'slam') { wallG.position.x = G.lerp(inX, out, Math.max(0, cr.t / 0.18)); if (cr.t <= 0) { cr.phase = 'hold'; cr.t = 0.6; if (near) G.player.shake = 0.9; } }
      else if (cr.phase === 'hold') { wallG.position.x = inX; if (cr.t <= 0) { cr.phase = 'back'; cr.t = 1.1; } }
      else if (cr.phase === 'back') { wallG.position.x = G.lerp(out, inX, cr.t / 1.1); if (cr.t <= 0) { cr.phase = 'idle'; cr.t = G.rand(2.2, 4.5); } }
      const live = cr.phase === 'hold' || (cr.phase === 'slam' && cr.t < 0.1);
      if (live && game.cur === r && !G.player.hiding && Math.abs(pl.z - crusherZ) < 0.7) game.kill('crusher');
    });
  }
  // Meld: alarm, fire escape, incineration, emergency override
  if (meld) {
    const d = r.exitDoor, ex = exitLocal(r, r.exits[0], 1.4);
    d.sealed = true; d.o.sealedLabel = 'Blocked by Meld'; d.o.sealedMsg = 'Meld blocks the gate. Pull the Fire Alarm, then get inside the Fire Escape.';
    const goo = [];
    for (let i = 0; i < 16; i++) goo.push(r.mesh(GEO.sphere, mm.meld, ex.x + G.rand(-1.6, 1.6), G.rand(0.1, 1.6), ex.z + G.rand(-1, 1), null, G.rand(0.3, 0.7), G.rand(0.3, 0.8), G.rand(0.3, 0.7)));
    for (let i = 0; i < 8; i++) goo.push(r.mesh(GEO.sphere, mm.meld, G.rand(r.xl + 1, r.xr - 1), 0.05, G.rand(3, r.L - 3), null, G.rand(0.5, 1.2), 0.12, G.rand(0.5, 1.2)));
    r.box((esc.x0 + esc.x1) / 2, 0.012, (esc.z0 + esc.z1) / 2, esc.x1 - esc.x0, 0.02, esc.z1 - esc.z0, MM.green, { collide: false });
    sign(r, (esc.x0 + esc.x1) / 2, 3.1, 0.17, 0, 'FIRE ESCAPE', 'GET INSIDE');
    r.lamp((esc.x0 + esc.x1) / 2, 3.5, 1.5, { type: 'bare', color: 0x40ff70, intensity: 6, dist: 6 });
    const alarmZ = r.L * 0.4, alarmX = esc.x0 === r.xl ? r.xl : r.xr;
    r.box(alarmX + (alarmX === r.xl ? 0.08 : -0.08), 1.3, alarmZ, 0.12, 0.4, 0.3, new THREE.MeshBasicMaterial({ color: 0xd01010 }), { collide: false });
    const st = { phase: 'idle', t: 0 };
    let loop = null, panel = null;
    r.addInter(r.l2w(alarmX + (alarmX === r.xl ? 0.4 : -0.4), 1.3, alarmZ), () => (st.phase === 'idle' ? 'Pull Fire Alarm' : null), () => {
      st.phase = 'armed'; st.t = 22; A.sfx('alarm'); loop = A.loop('alarm'); loop.set(0.6);
      U.msg('INCINERATION IN 22s', 2.5, 'run'); U.caption('Get inside the green FIRE ESCAPE!', 4); U.timer(true);
      r.lamps.forEach(L => { L.color.setHex(0xff2010); L.buzz = true; });
    }, 2);
    r.onDispose = () => { if (loop) loop.stop(); };
    r.updaters.push(dt => {
      if (st.phase !== 'armed') return;
      st.t -= dt; U.timerText(`INCINERATION ${Math.ceil(st.t)}`, true);
      if (st.t > 0) return;
      st.phase = 'done'; loop.stop(); U.timer(false); U.flash('#ff7a10'); A.sfx('splash'); A.sfx('crush');
      const pl = r.w2l(G.player.pos);
      if (game.cur === r && !(pl.x > esc.x0 && pl.x < esc.x1 && pl.z > esc.z0 && pl.z < esc.z1)) { game.kill('incineration'); return; }
      goo.forEach(m => { m.visible = false; });
      game.ents.filter(e => (e instanceof Noise || e instanceof Stem) && e.room === r).forEach(e => game.despawn(e));
      r.lamps.forEach(L => { L.color.setHex(0xfff0c8); L.buzz = false; });
      U.caption('Incineration complete. Use the Emergency Override by the gate.', 4);
      const pp = exitLocal(r, r.exits[0], 1.2);
      const px = r.exits[0].side === 'front' ? pp.x + 1.4 : pp.x, pz = r.exits[0].side === 'front' ? pp.z : pp.z - 1.4;
      panel = r.box(px, 1.3, pz, 0.5, 0.6, 0.2, M.metal, { collide: false, uv: 1 });
      const it = r.addInter(r.l2w(px, 1.3, pz), () => (it.used ? null : 'Emergency Override'), () => { it.used = true; A.sfx('unlock'); d.sealed = false; d.open(); }, 2.2);
    });
  }
  if (G.chance(0.15) && landing >= 6) game.spawn(new Creak(r, r.l2w(G.rand(r.xl + 2, r.xr - 2), 0, r.L - 2)));
  return r;
};
SP.cobbler = (game, at, n) => {
  const th = G.THEMES.stairwell(); th.lampColor = 0xffd8a0;
  const lay = G.chooseLayout(game, at, { Wfix: 10, Lfix: 12, center: true, sides: ['front'] });
  const r = new G.Room(game, { index: n, origin: at.origin, dir: at.dir, xl: lay.xl, xr: lay.xr, L: lay.L, H: 4, theme: th });
  r.safe = true;
  r.exits = [{ side: 'front', pos: 0, inset: true, fake: true }];
  r.shell();
  const d = r.makeExit(r.exits[0], { fake: true, noAuto: true, plateText: 'EXIT', mat: M.door });
  d.onFake = () => { game.escaping = true; G.ui.fade(true, 1); setTimeout(() => game.win('stairwell'), 1000); };
  r.box(0, 0.55, 6, 5, 1.1, 0.8, M.darkwood);
  const cm = G.assetModel('cobbler', 1.6);
  if (cm) { cm.position.set(0, 0, 7.1); cm.rotation.y = Math.PI; r.group.add(cm); }
  else { const cs = G.faceSprite('cobbler', 1.4); cs.position.set(0, 1.7, 7); r.group.add(cs); }
  r.lamp(0, r.H, 6, { type: 'pendant', intensity: 18 });
  sign(r, 0, 3, 0.17, 0, 'COBBLER', 'LANDING 99');
  scrapper(r, r.xl + 1, 3);
  r.addInter(r.l2w(-1.5, 1.2, 5.5), () => (FL.stairwell.scrap ? `Trade ${FL.stairwell.scrap} scrap for ${FL.stairwell.scrap * 10} gold` : null), () => {
    const f = FL.stairwell; game.addGold(f.scrap * 10); f.scrap = 0; U.caption('COBBLER: "Pleasure doin\' business!"', 2.5);
  }, 2.4);
  r.addInter(r.l2w(1.5, 1.2, 5.5), 'Buy Peach Cobbler (250 gold)', () => {
    if (game.gold < 250) { A.sfx('bad'); U.caption('COBBLER: "Come back with more gold."', 2); return; }
    game.gold -= 250; U.gold(game.gold); G.player.hp = 100; U.hp(100); A.sfx('gulp'); U.caption('Warm peach cobbler. You feel whole again.', 2.5);
  }, 2.4);
  r.onEnter = () => { game.escaping = true; A.sfx('chime'); U.msg('LANDING 99', 3, 'title'); U.caption('The Cobbler\'s shop. Trade your scrap, then take the EXIT.', 4); };
  return r.finish();
};
FL.stairwell = {
  id: 'stairwell', name: 'The Stairwell', tag: 'SUB-FLOOR', color: '#d8c040', face: 'creak', range: 'Landings 0 – 99',
  desc: 'Descend 99 landings. Creak stalks the stairs, Noise copies your every step, Stems burst from containers, Crushers slam and Meld must be burned away.',
  start: 0, end: 198, ambient: 'stairwell', fog: [0x060605, 0.05], crumbs: true,
  plate: n => (n % 2 ? 'STAIRS' : 'L-' + G.pad(n / 2, 2)),
  init() { this.salvage = []; this.scrap = 0; this.stems = []; },
  cleanup() { U.tint('creak', false); U.timer(false); },
  build(game, n, at) {
    if (n === 198) return SP.cobbler(game, at, n);
    if (n % 2 === 1) return SP.stairs(game, at, n);
    const landing = n / 2;
    if (n > 0 && G.chance(landing < 5 ? 0.45 : 0.6)) return SP.depot(game, at, n, landing);
    return SP.landing(game, at, n);
  },
  onEnter(game, room) {
    game.hideLimit = 25;
    if (room.index === 0) U.caption('THE STAIRWELL. Don\'t stare at Creak. Don\'t let Noise catch your path.', 5);
    if (room.index === 2) U.caption('Collect salvage and scrap it — the Cobbler at Landing 99 pays in gold.', 4);
  },
  onDoorOpen() {},
  onClick(game) {
    const cam = G.camera.position;
    const s = this.stems.find(t => t.pos.distanceTo(cam) < 3.6 && G.lookingAt(t.pos, 0.85));
    if (!s) return false;
    A.sfx('pop'); game.despawn(s); return true;
  },
  update() { U.extra(`⚙ Salvage ${this.salvage.length}/5 · Scrap ${this.scrap}`); },
};

G.FLOOR_ORDER.push('archives', 'stairwell');
})();
