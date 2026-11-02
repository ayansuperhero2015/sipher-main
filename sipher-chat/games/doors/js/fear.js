// Fear: high-detail horror faces, glitching sprites, screaming jumpscares, proximity dread and ambient scares.
(() => {
'use strict';
const V3 = THREE.Vector3;
const E = G.E, U = G.ui, A = G.audio, R = G.rand;
const TAU = Math.PI * 2;

/* =====================================================================
   Painting helpers (all faces are drawn on a 512px canvas)
   ===================================================================== */
function radial(x, cx, cy, r, stops) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function smokeBall(x, S, core, edge, n = 140, spread = 0.38) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, r = Math.pow(Math.random(), 0.7) * S * spread;
    const px = S / 2 + Math.cos(a) * r, py = S / 2 + Math.sin(a) * r * 1.05, rr = R(S * 0.05, S * 0.17);
    x.fillStyle = radial(x, px, py, rr, [[0, i % 3 ? core : edge], [1, 'rgba(0,0,0,0)']]);
    x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
}
function tendrils(x, S, col, n = 26, len = 0.5) {
  x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    let px = S / 2 + Math.cos(a) * S * 0.28, py = S / 2 + Math.sin(a) * S * 0.28;
    x.strokeStyle = col; x.lineWidth = R(2, 7);
    x.beginPath(); x.moveTo(px, py);
    let ang = a;
    for (let k = 0; k < 8; k++) { ang += R(-0.5, 0.5); px += Math.cos(ang) * S * len / 8; py += Math.sin(ang) * S * len / 8; x.lineTo(px, py); x.lineWidth *= 0.8; }
    x.globalAlpha = R(0.25, 0.7); x.stroke(); x.globalAlpha = 1;
  }
}
function veins(x, cx, cy, r, n = 16) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    let px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.65;
    x.strokeStyle = `rgba(${R(140, 200) | 0},10,10,${R(0.4, 0.8)})`; x.lineWidth = R(0.8, 2.2);
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 5; k++) { px += (cx - px) * 0.18 + R(-5, 5); py += (cy - py) * 0.18 + R(-5, 5); x.lineTo(px, py); }
    x.stroke();
  }
}
// Wet, bloodshot human eye sunk in a dark socket.
function bloodEye(x, cx, cy, r, o = {}) {
  x.fillStyle = radial(x, cx, cy, r * 1.9, [[0, 'rgba(0,0,0,0.95)'], [0.6, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
  x.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  x.save();
  x.beginPath(); x.ellipse(cx, cy, r, r * (o.open || 0.66), o.tilt || 0, 0, TAU); x.clip();
  x.fillStyle = radial(x, cx, cy, r, [[0, '#f4ecdc'], [0.7, '#d8c2b0'], [1, '#8a5a50']]);
  x.fillRect(cx - r, cy - r, r * 2, r * 2);
  veins(x, cx, cy, r, 22);
  const ix = cx + (o.look || 0) * r * 0.25, ir = r * (o.iris || 0.42);
  x.fillStyle = radial(x, ix, cy, ir, [[0, '#000'], [0.35, o.irisCol || '#3a2a1a'], [0.9, o.irisEdge || '#120a06'], [1, '#000']]);
  x.beginPath(); x.arc(ix, cy, ir, 0, TAU); x.fill();
  x.fillStyle = '#000'; x.beginPath(); x.arc(ix, cy, ir * (o.pupil || 0.35), 0, TAU); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(ix - ir * 0.35, cy - ir * 0.35, ir * 0.16, 0, TAU); x.fill();
  x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(cx - r, cy - r, r * 2, r * 0.35);
  x.restore();
  x.strokeStyle = 'rgba(60,0,0,0.7)'; x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy, r, r * (o.open || 0.66), o.tilt || 0, 0, TAU); x.stroke();
}
// Empty socket with a pin of light deep inside.
function voidEye(x, cx, cy, rx, ry, glow = '#fff', tilt = 0) {
  x.fillStyle = radial(x, cx, cy, rx * 1.6, [[0, 'rgba(0,0,0,1)'], [0.7, 'rgba(0,0,0,0.85)'], [1, 'rgba(0,0,0,0)']]);
  x.fillRect(cx - rx * 2, cy - rx * 2, rx * 4, rx * 4);
  x.fillStyle = '#000'; x.beginPath(); x.ellipse(cx, cy, rx, ry, tilt, 0, TAU); x.fill();
  x.shadowColor = glow; x.shadowBlur = 30; x.fillStyle = glow;
  x.beginPath(); x.arc(cx + R(-2, 2), cy + ry * 0.15, Math.max(3, rx * 0.12), 0, TAU); x.fill();
  x.shadowBlur = 0;
}
// A grin full of uneven needle teeth, with gums and drool.
function maw(x, cx, cy, w, h, o = {}) {
  const n = o.teeth || 28, up = o.upCurve || 0.25;
  const top = t => cy - h * up * Math.sin(Math.PI * t) + h * 0.05;
  const bot = t => cy + h * Math.sin(Math.PI * t);
  const X = t => cx - w / 2 + w * t;
  x.beginPath(); x.moveTo(X(0), cy);
  for (let i = 1; i <= 40; i++) x.lineTo(X(i / 40), top(i / 40));
  for (let i = 40; i >= 0; i--) x.lineTo(X(i / 40), bot(i / 40));
  x.closePath();
  x.fillStyle = o.lip || '#3a0606'; x.fill();
  x.save(); x.clip();
  x.fillStyle = radial(x, cx, cy + h * 0.4, w * 0.6, [[0, '#000'], [0.6, '#120000'], [1, o.gum || '#5a0a0a']]);
  x.fillRect(cx - w, cy - h, w * 2, h * 3);
  const tooth = (tx, ty, tw, th, down) => {
    const g = x.createLinearGradient(tx, ty, tx, ty + (down ? th : -th));
    g.addColorStop(0, o.toothBase || '#b8aa80'); g.addColorStop(1, o.tooth || '#f4ecd4');
    x.fillStyle = g; x.beginPath(); x.moveTo(tx - tw / 2, ty); x.lineTo(tx + tw / 2, ty); x.lineTo(tx + R(-tw * 0.2, tw * 0.2), ty + (down ? th : -th)); x.closePath(); x.fill();
  };
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, tw = w / n * R(0.8, 1.3), th = h * R(0.28, 0.6) * (0.5 + Math.sin(Math.PI * t) * 0.6);
    tooth(X(t), top(t) - 1, tw, th, true);
    tooth(X(t + R(-0.01, 0.01)), bot(t) + 1, tw, th * 0.9, false);
  }
  if (o.drool !== false) for (let i = 0; i < 6; i++) {
    const t = R(0.2, 0.8), px = X(t), py = top(t) + h * 0.3;
    x.strokeStyle = 'rgba(220,220,200,0.35)'; x.lineWidth = R(1, 2.5);
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + R(-6, 6), py + h * 0.4, px + R(-3, 3), bot(t) - 2); x.stroke();
  }
  x.restore();
}
// Lamprey-style round mouth with rings of teeth.
function lamprey(x, cx, cy, r, rings = 4) {
  x.fillStyle = radial(x, cx, cy, r, [[0, '#000'], [0.5, '#1a0000'], [0.85, '#6a0a0a'], [1, '#2a0000']]);
  x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  for (let k = 0; k < rings; k++) {
    const rr = r * (0.95 - k * 0.2), n = 22 - k * 3;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + k * 0.3, tx = cx + Math.cos(a) * rr, ty = cy + Math.sin(a) * rr, tl = r * 0.18 * (1 - k * 0.15);
      x.fillStyle = k ? '#d8ccaa' : '#f0e6c8';
      x.beginPath(); x.moveTo(tx + Math.cos(a + 1.57) * 4, ty + Math.sin(a + 1.57) * 4); x.lineTo(tx - Math.cos(a + 1.57) * 4, ty - Math.sin(a + 1.57) * 4);
      x.lineTo(tx - Math.cos(a) * tl, ty - Math.sin(a) * tl); x.fill();
    }
  }
}
function drips(x, S, col, n = 14, y0 = 0.55) {
  for (let i = 0; i < n; i++) {
    const px = S * R(0.2, 0.8), py = S * R(y0, y0 + 0.15), len = S * R(0.05, 0.3), w = R(3, 9);
    const g = x.createLinearGradient(0, py, 0, py + len); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - w / 2, py, w, len);
    x.beginPath(); x.arc(px, py + len * 0.9, w * 0.7, 0, TAU); x.fill();
  }
}
function cracks(x, S, col = 'rgba(0,0,0,0.7)', n = 10) {
  x.strokeStyle = col;
  for (let i = 0; i < n; i++) {
    let px = S * R(0.25, 0.75), py = S * R(0.2, 0.8); x.lineWidth = R(1, 3);
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += R(-22, 22); py += R(-22, 22); x.lineTo(px, py); }
    x.stroke();
  }
}

/* =====================================================================
   Faces — redrawn to be properly horrifying
   ===================================================================== */
const F = G.FACES;
Object.assign(F, {
  rush(x, S) {
    smokeBall(x, S, 'rgba(14,14,14,0.6)', 'rgba(40,40,40,0.35)', 170);
    tendrils(x, S, 'rgba(10,10,10,0.9)', 34, 0.55);
    smokeBall(x, S, 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.5)', 50, 0.2);
    voidEye(x, S * 0.36, S * 0.36, S * 0.085, S * 0.11, '#e8e8ff', -0.25);
    voidEye(x, S * 0.64, S * 0.36, S * 0.085, S * 0.11, '#e8e8ff', 0.25);
    maw(x, S / 2, S * 0.56, S * 0.74, S * 0.2, { teeth: 34, upCurve: 0.45 });
  },
  ambush(x, S) {
    smokeBall(x, S, 'rgba(40,80,40,0.5)', 'rgba(120,180,110,0.3)', 150, 0.4);
    tendrils(x, S, 'rgba(60,120,60,0.7)', 30, 0.6);
    x.fillStyle = radial(x, S / 2, S * 0.48, S * 0.3, [[0, 'rgba(200,230,190,0.95)'], [0.7, 'rgba(110,150,100,0.9)'], [1, 'rgba(0,0,0,0)']]);
    x.beginPath(); x.ellipse(S / 2, S * 0.48, S * 0.22, S * 0.36, 0, 0, TAU); x.fill();
    bloodEye(x, S * 0.4, S * 0.33, S * 0.055, { irisCol: '#2a6a20', open: 0.9, look: -0.6 });
    bloodEye(x, S * 0.6, S * 0.33, S * 0.055, { irisCol: '#2a6a20', open: 0.9, look: 0.6 });
    maw(x, S / 2, S * 0.5, S * 0.3, S * 0.36, { teeth: 14, upCurve: 0.05, lip: '#1a3a10' });
    drips(x, S, 'rgba(160,220,140,0.6)', 10, 0.78);
  },
  screech(x, S) {
    smokeBall(x, S, 'rgba(6,6,6,0.75)', 'rgba(20,20,20,0.5)', 120, 0.34);
    tendrils(x, S, 'rgba(0,0,0,0.95)', 40, 0.7);
    lamprey(x, S / 2, S * 0.56, S * 0.25, 4);
    for (const s of [-1, 1]) { x.shadowColor = '#fff'; x.shadowBlur = 20; x.fillStyle = '#fff'; x.beginPath(); x.arc(S / 2 + s * S * 0.12, S * 0.24, S * 0.018, 0, TAU); x.fill(); x.shadowBlur = 0; }
  },
  eyes(x, S) {
    x.fillStyle = radial(x, S / 2, S / 2, S * 0.48, [[0, '#2a0838'], [0.6, '#150420'], [0.85, 'rgba(120,40,180,0.5)'], [1, 'rgba(0,0,0,0)']]);
    x.fillRect(0, 0, S, S);
    veins(x, S / 2, S / 2, S * 0.4, 30);
    const spots = [[0.5, 0.5, 0.08]];
    for (let i = 0; i < 13; i++) { const a = i / 13 * TAU + R(-0.2, 0.2), r = S * R(0.17, 0.33); spots.push([0.5 + Math.cos(a) * r / S, 0.5 + Math.sin(a) * r / S, R(0.035, 0.06)]); }
    spots.forEach(([px, py, r]) => {
      x.shadowColor = '#d070ff'; x.shadowBlur = 25;
      bloodEye(x, S * px, S * py, S * r, { irisCol: '#a030e0', irisEdge: '#300050', look: R(-1, 1), open: R(0.5, 0.9), tilt: R(-0.5, 0.5) });
      x.shadowBlur = 0;
    });
  },
  halt(x, S) {
    x.fillStyle = radial(x, S / 2, S / 2, S * 0.48, [[0, 'rgba(150,230,255,0.85)'], [0.5, 'rgba(40,140,220,0.5)'], [1, 'rgba(0,30,90,0)']]);
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 6) { x.fillStyle = `rgba(200,240,255,${Math.random() * 0.12})`; x.fillRect(0, i, S, 2); }
    voidEye(x, S * 0.38, S * 0.4, S * 0.07, S * 0.1, '#bff');
    voidEye(x, S * 0.62, S * 0.4, S * 0.07, S * 0.1, '#bff');
    drips(x, S, 'rgba(0,30,60,0.8)', 6, 0.45);
    x.fillStyle = '#001424'; x.beginPath(); x.ellipse(S / 2, S * 0.7, S * 0.07, S * 0.13, 0, 0, TAU); x.fill();
  },
  seek(x, S) {
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    x.fillStyle = radial(x, S / 2, S * 0.45, S * 0.5, [[0, '#1c1c1c'], [0.7, '#060606'], [1, '#000']]);
    x.beginPath(); x.ellipse(S / 2, S * 0.48, S * 0.4, S * 0.5, 0, 0, TAU); x.fill();
    for (let i = 0; i < 20; i++) { x.fillStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); x.ellipse(S * R(0.2, 0.8), S * R(0.1, 0.9), S * 0.02, S * 0.05, 0, 0, TAU); x.fill(); }
    bloodEye(x, S / 2, S * 0.44, S * 0.22, { irisCol: '#050505', irisEdge: '#000', iris: 0.5, pupil: 0.6, open: 0.62 });
    drips(x, S, 'rgba(0,0,0,0.95)', 16, 0.55);
  },
  figure(x, S) {
    x.fillStyle = '#0a0202'; x.fillRect(0, 0, S, S);
    x.fillStyle = radial(x, S / 2, S * 0.45, S * 0.45, [[0, '#8a2a1c'], [0.7, '#4a1008'], [1, '#100202']]);
    x.beginPath(); x.ellipse(S / 2, S * 0.48, S * 0.34, S * 0.48, 0, 0, TAU); x.fill();
    for (let i = 0; i < 30; i++) { x.strokeStyle = `rgba(30,0,0,${R(0.2, 0.5)})`; x.lineWidth = R(1, 3); const px = S * R(0.25, 0.75), py = S * R(0.1, 0.9); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + R(-30, 30), py + R(-30, 30), px + R(-40, 40), py + R(-40, 40)); x.stroke(); }
    x.fillStyle = radial(x, S / 2, S * 0.56, S * 0.3, [[0, '#000'], [0.8, '#1a0000'], [1, '#3a0404']]);
    x.beginPath(); x.ellipse(S / 2, S * 0.56, S * 0.2, S * 0.34, 0, 0, TAU); x.fill();
    for (let i = 0; i < 9; i++) {
      const yy = S * 0.28 + i * S * 0.062, half = S * 0.2 * Math.sqrt(1 - Math.pow((yy - S * 0.56) / (S * 0.34), 2));
      const g = x.createLinearGradient(0, yy - 6, 0, yy + 6); g.addColorStop(0, '#fff6e0'); g.addColorStop(1, '#a89a70');
      x.strokeStyle = g; x.lineWidth = R(6, 10);
      x.beginPath(); x.moveTo(S / 2 - half, yy); x.quadraticCurveTo(S / 2, yy + 18, S / 2 + half, yy); x.stroke();
    }
    drips(x, S, 'rgba(120,10,10,0.8)', 8, 0.75);
  },
  a60(x, S) {
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    smokeBall(x, S, 'rgba(160,0,0,0.55)', 'rgba(255,40,40,0.3)', 120, 0.4);
    for (let k = 0; k < 4; k++) {
      const ox = R(-60, 60), oy = R(-40, 40), a = k ? 0.45 : 1;
      x.globalAlpha = a;
      voidEye(x, S * 0.38 + ox, S * 0.4 + oy, S * 0.06, S * 0.08, '#fff');
      voidEye(x, S * 0.62 + ox, S * 0.4 + oy, S * 0.06, S * 0.08, '#fff');
      maw(x, S / 2 + ox, S * 0.6 + oy, S * 0.5, S * 0.14, { teeth: 22, lip: '#600', drool: false });
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 18; i++) { const y = R(0, S), h = R(3, 18); const img = x.getImageData(0, y, S, h); x.putImageData(img, R(-40, 40), y); }
  },
  a90(x, S) {
    x.fillStyle = '#000'; x.fillRect(S * 0.12, S * 0.1, S * 0.76, S * 0.8);
    const px = S / 32;
    const cell = (cx, cy, w, h, c) => { x.fillStyle = c; x.fillRect(Math.round(cx * S / px) * px, Math.round(cy * S / px) * px, w * S, h * S); };
    cell(0.26, 0.28, 0.16, 0.16, '#e00'); cell(0.58, 0.28, 0.16, 0.16, '#e00');
    cell(0.3, 0.33, 0.06, 0.06, '#000'); cell(0.64, 0.33, 0.06, 0.06, '#000');
    cell(0.27, 0.58, 0.46, 0.2, '#e00');
    for (let i = 0; i < 7; i++) cell(0.29 + i * 0.062, 0.58, 0.025, 0.1, '#000');
    for (let i = 0; i < 12; i++) { const y = R(0, S), h = R(2, 14); const img = x.getImageData(0, y, S, h); x.putImageData(img, R(-30, 30), y); }
  },
  a120(x, S) {
    smokeBall(x, S, 'rgba(60,20,100,0.55)', 'rgba(150,80,220,0.3)', 140);
    voidEye(x, S * 0.38, S * 0.38, S * 0.08, S * 0.12, '#d9b0ff');
    voidEye(x, S * 0.62, S * 0.38, S * 0.08, S * 0.12, '#d9b0ff');
    drips(x, S, 'rgba(20,0,40,0.9)', 12, 0.45);
    x.strokeStyle = '#000'; x.lineWidth = 14; x.beginPath(); x.arc(S / 2, S * 0.5, S * 0.18, 0.25, Math.PI - 0.25); x.stroke();
  },
  blitz(x, S) {
    smokeBall(x, S, 'rgba(90,20,90,0.6)', 'rgba(255,80,255,0.3)', 150);
    tendrils(x, S, 'rgba(255,120,255,0.5)', 30, 0.6);
    voidEye(x, S * 0.36, S * 0.37, S * 0.08, S * 0.08, '#ff9aff');
    voidEye(x, S * 0.64, S * 0.37, S * 0.08, S * 0.08, '#ff9aff');
    maw(x, S / 2, S * 0.56, S * 0.68, S * 0.16, { teeth: 30, lip: '#400040' });
  },
  lookman(x, S) {
    x.fillStyle = radial(x, S / 2, S / 2, S * 0.45, [[0, '#4a4a4c'], [0.8, '#1e1e20'], [1, 'rgba(0,0,0,0)']]);
    x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.36, S * 0.45, 0, 0, TAU); x.fill();
    cracks(x, S, 'rgba(0,0,0,0.6)', 8);
    bloodEye(x, S * 0.38, S * 0.42, S * 0.11, { irisCol: '#5a5a5a', open: 0.95, pupil: 0.15 });
    bloodEye(x, S * 0.62, S * 0.42, S * 0.11, { irisCol: '#5a5a5a', open: 0.95, pupil: 0.15 });
  },
  haste(x, S) {
    smokeBall(x, S, 'rgba(100,0,0,0.6)', 'rgba(255,40,20,0.25)', 150);
    x.fillStyle = radial(x, S / 2, S * 0.45, S * 0.26, [[0, '#2a0808'], [1, '#000']]); x.beginPath(); x.arc(S / 2, S * 0.45, S * 0.25, 0, TAU); x.fill();
    voidEye(x, S * 0.41, S * 0.41, S * 0.06, S * 0.07, '#ff3030');
    voidEye(x, S * 0.59, S * 0.41, S * 0.06, S * 0.07, '#ff3030');
    maw(x, S / 2, S * 0.56, S * 0.3, S * 0.09, { teeth: 14, lip: '#200' });
    x.strokeStyle = 'rgba(255,60,60,0.8)'; x.lineWidth = 6; x.beginPath(); x.moveTo(S / 2, S * 0.45); x.lineTo(S / 2, S * 0.2); x.moveTo(S / 2, S * 0.45); x.lineTo(S * 0.68, S * 0.5); x.stroke();
  },
  jack(x, S) {
    x.fillStyle = '#100'; x.fillRect(0, 0, S, S);
    x.fillStyle = radial(x, S / 2, S / 2, S * 0.42, [[0, '#d42020'], [0.8, '#6a0808'], [1, '#100']]);
    x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.32, S * 0.44, 0, 0, TAU); x.fill();
    bloodEye(x, S * 0.4, S * 0.38, S * 0.09, { open: 1, pupil: 0.12, irisCol: '#200' });
    bloodEye(x, S * 0.6, S * 0.38, S * 0.09, { open: 1, pupil: 0.12, irisCol: '#200' });
    maw(x, S / 2, S * 0.6, S * 0.42, S * 0.22, { teeth: 18 });
  },
  dupe(x, S) {
    x.fillStyle = '#1c0e06'; x.fillRect(S * 0.22, S * 0.04, S * 0.56, S * 0.92);
    x.strokeStyle = '#0a0402'; x.lineWidth = 8; x.strokeRect(S * 0.26, S * 0.08, S * 0.48, S * 0.84);
    bloodEye(x, S * 0.4, S * 0.24, S * 0.06, { open: 0.9 }); bloodEye(x, S * 0.6, S * 0.24, S * 0.06, { open: 0.9 });
    maw(x, S / 2, S * 0.48, S * 0.42, S * 0.4, { teeth: 16, upCurve: 0.3 });
  },
  giggle(x, S) {
    smokeBall(x, S, 'rgba(0,0,0,0.75)', 'rgba(20,20,20,0.4)', 120, 0.34);
    tendrils(x, S, 'rgba(0,0,0,0.9)', 18, 0.5);
    maw(x, S / 2, S * 0.48, S * 0.8, S * 0.26, { teeth: 40, upCurve: 0.6 });
    for (const s of [-1, 1]) { x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 15; x.beginPath(); x.arc(S / 2 + s * S * 0.2, S * 0.28, S * 0.015, 0, TAU); x.fill(); x.shadowBlur = 0; }
  },
  grumble(x, S) {
    x.fillStyle = '#0a0806'; x.fillRect(0, 0, S, S);
    x.fillStyle = radial(x, S / 2, S / 2, S * 0.48, [[0, '#4a423a'], [1, '#141210']]); x.beginPath(); x.arc(S / 2, S / 2, S * 0.46, 0, TAU); x.fill();
    lamprey(x, S / 2, S * 0.58, S * 0.3, 3);
    for (const s of [-1, 1]) { x.shadowColor = '#fc0'; x.shadowBlur = 30; x.fillStyle = '#ffd040'; x.beginPath(); x.ellipse(S / 2 + s * S * 0.22, S * 0.22, S * 0.04, S * 0.025, 0, 0, TAU); x.fill(); x.shadowBlur = 0; }
  },
  monument(x, S) {
    x.fillStyle = '#050506'; x.fillRect(0, 0, S, S);
    x.fillStyle = radial(x, S * 0.45, S * 0.4, S * 0.5, [[0, '#f0eee8'], [0.7, '#a8a49c'], [1, '#3a3834']]);
    x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.3, S * 0.43, 0, 0, TAU); x.fill();
    cracks(x, S, 'rgba(40,36,30,0.75)', 14);
    voidEye(x, S * 0.4, S * 0.42, S * 0.055, S * 0.09, '#222');
    voidEye(x, S * 0.6, S * 0.42, S * 0.055, S * 0.09, '#222');
    drips(x, S, 'rgba(20,20,20,0.6)', 4, 0.48);
    x.strokeStyle = '#2a2824'; x.lineWidth = 5; x.beginPath(); x.arc(S / 2, S * 0.6, S * 0.1, 0.35, Math.PI - 0.35); x.stroke();
  },
  hide(x, S) {
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 6; i++) x.fillRect(0, S * (0.15 + i * 0.14), S, S * 0.07);
    bloodEye(x, S * 0.36, S * 0.5, S * 0.1, { open: 0.5, pupil: 0.1 });
    bloodEye(x, S * 0.64, S * 0.5, S * 0.1, { open: 0.5, pupil: 0.1 });
  },
  timothy(x, S) {
    x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, S, S);
    x.strokeStyle = '#180c0a'; x.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1, k = i % 4, a0 = (side < 0 ? Math.PI : 0) + (k - 1.5) * 0.45 * side;
      x.lineWidth = 12; x.beginPath(); x.moveTo(S / 2, S * 0.5);
      const kx = S / 2 + Math.cos(a0) * S * 0.28, ky = S * 0.32 + k * 10;
      x.lineTo(kx, ky); x.lineTo(kx + Math.cos(a0) * S * 0.16, ky + S * 0.3); x.stroke();
      for (let h = 0; h < 8; h++) { x.lineWidth = 1.5; const t = h / 8; const hx = G.lerp(S / 2, kx, t), hy = G.lerp(S * 0.5, ky, t); x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx + R(-8, 8), hy - R(4, 10)); x.stroke(); }
    }
    x.fillStyle = radial(x, S / 2, S * 0.56, S * 0.2, [[0, '#4a2420'], [1, '#140806']]); x.beginPath(); x.ellipse(S / 2, S * 0.58, S * 0.15, S * 0.2, 0, 0, TAU); x.fill();
    x.beginPath(); x.arc(S / 2, S * 0.38, S * 0.1, 0, TAU); x.fill();
    for (let i = 0; i < 8; i++) { x.shadowColor = '#f00'; x.shadowBlur = 12; x.fillStyle = '#ff2020'; x.beginPath(); x.arc(S / 2 + (i % 4 - 1.5) * 13, S * 0.35 + Math.floor(i / 4) * 12, i < 4 ? 6 : 4, 0, TAU); x.fill(); }
    x.shadowBlur = 0;
    x.fillStyle = '#e8e0c8'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(S / 2 + s * 10, S * 0.44); x.lineTo(S / 2 + s * 16, S * 0.52); x.lineTo(S / 2 + s * 4, S * 0.45); x.fill(); }
  },
  shadow(x, S) {
    x.clearRect(0, 0, S, S);
    x.fillStyle = radial(x, S / 2, S * 0.55, S * 0.5, [[0, 'rgba(0,0,0,0.95)'], [0.6, 'rgba(0,0,0,0.8)'], [1, 'rgba(0,0,0,0)']]);
    x.beginPath(); x.ellipse(S / 2, S * 0.62, S * 0.16, S * 0.42, 0, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(S / 2, S * 0.18, S * 0.09, S * 0.11, 0, 0, TAU); x.fill();
    for (const s of [-1, 1]) { x.shadowColor = '#fff'; x.shadowBlur = 10; x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.arc(S / 2 + s * 14, S * 0.17, 3.5, 0, TAU); x.fill(); }
    x.shadowBlur = 0;
  },
});
// Faces drawn by subfloors keep their art; give them the shared film treatment only.
const NO_FX = new Set(['spark', 'shadow', 'drone', 'cobbler', 'noise']);
G.horrify = (x, S, name) => {
  if (NO_FX.has(name)) return;
  // chromatic ghosting
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = S; tmp.getContext('2d').drawImage(x.canvas, 0, 0);
  x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.09;
  x.drawImage(tmp, -5, 0); x.drawImage(tmp, 5, 2);
  x.restore();
  // grain + scratches, only where there is paint
  const id = x.getImageData(0, 0, S, S), d = id.data;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const n = (Math.random() - 0.5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(id, 0, 0);
  x.save(); x.globalCompositeOperation = 'source-atop'; x.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 6; i++) { const px = R(0, S); x.lineWidth = R(0.5, 1.5); x.beginPath(); x.moveTo(px, 0); x.lineTo(px + R(-20, 20), S); x.stroke(); }
  x.restore();
};
// Torn, channel-shifted copy of a face for glitch frames.
const glitchCache = {};
G.glitchTex = name => {
  if (glitchCache[name]) return glitchCache[name];
  const src = G.faceCanvas(name), S = src.width;
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  for (let i = 0; i < 14; i++) { const y = R(0, S), h = R(4, 40); x.drawImage(src, 0, y, S, h, R(-60, 60), y, S, h); }
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = G.pick(['rgba(255,0,0,0.35)', 'rgba(0,255,255,0.3)', 'rgba(255,255,255,0.25)']); x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (glitchCache[name] = t);
};

/* =====================================================================
   Sound: screams, stingers and ambience one-shots
   ===================================================================== */
const curve = (() => { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const v = i / n * 2 - 1; c[i] = Math.tanh(v * 28); } return c; })();
function voice(f, dur, vol, t0 = 0, slide = 1.35) {
  const ctx = A.kit.ctx(); if (!ctx) return;
  const t = ctx.currentTime + t0, out = A.dest();
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f * 0.7, t); o.frequency.exponentialRampToValueAtTime(f * slide, t + 0.12); o.frequency.exponentialRampToValueAtTime(f * 0.75, t + dur);
  const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = R(6, 9); vg.gain.value = f * 0.06; vib.connect(vg); vg.connect(o.frequency);
  const sh = ctx.createWaveShaper(); sh.curve = curve;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(sh);
  [[800, 1], [1150, 0.8], [2900, 0.5], [3300, 0.3]].forEach(([ff, a]) => { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff * R(0.9, 1.1); bp.Q.value = 6; const ga = ctx.createGain(); ga.gain.value = a; sh.connect(bp); bp.connect(ga); ga.connect(g); });
  g.connect(out);
  o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
}
Object.assign(A.SFX, {
  scream: (o = {}) => {
    const dur = o.dur || 1.1, f = o.f || R(520, 760);
    A.noise({ dur: 0.12, f: 300, f2: 6000, q: 0.5, vol: 0.5 });
    voice(f, dur, 0.55); voice(f * 1.07, dur * 0.9, 0.4, 0.02); voice(f * 0.5, dur, 0.3, 0.01, 1.2);
    A.noise({ dur: dur * 0.9, f: 2400, q: 0.35, vol: 0.9, a: 0.01 });
    A.tone({ f: 60, f2: 28, dur: 0.7, vol: 0.9, type: 'sine' });
    A.noise({ dur: 0.25, f: 120, q: 0.6, vol: 1, type: 'lowpass' });
  },
  sting: () => {
    [466, 494, 523, 554, 1108].forEach((f, i) => A.tone({ f, dur: 1.6, type: i % 2 ? 'sawtooth' : 'triangle', vol: i % 2 ? 0.025 : 0.06, a: 0.04 }));
    A.noise({ dur: 1.4, f: 7000, q: 1, vol: 0.12, a: 0.05, type: 'highpass' });
    A.tone({ f: 46, dur: 1.2, vol: 0.4 });
  },
  knock: () => { for (let i = 0; i < 3; i++) { A.noise({ dur: 0.09, f: 140, q: 0.8, vol: 0.6, type: 'lowpass', delay: i * 0.38 }); A.tone({ f: 85, f2: 60, dur: 0.12, vol: 0.3, delay: i * 0.38 }); } },
  whisper: () => {
    const ctx = A.kit.ctx(); if (!ctx) return;
    for (let k = 0; k < 3; k++) {
      const t = ctx.currentTime + k * 0.55 + R(0, 0.2);
      for (let s = 0; s < 4; s++) A.noise({ dur: R(0.08, 0.2), f: R(1800, 5200), q: R(6, 14), vol: R(0.05, 0.12), delay: t - ctx.currentTime + s * R(0.07, 0.14) });
    }
  },
  footsteps: () => { let d = 0; for (let i = 0; i < 7; i++) { d += 0.6 - i * 0.05; A.noise({ dur: 0.07, f: 420, q: 0.8, vol: 0.04 + i * 0.03, delay: d }); } },
  groan: () => { A.tone({ f: 72, f2: 52, dur: 2.6, type: 'sawtooth', vol: 0.07, a: 0.6 }); A.noise({ dur: 2.4, f: 260, f2: 160, q: 3, vol: 0.12, a: 0.6 }); },
  breath: () => { for (let i = 0; i < 2; i++) { A.noise({ dur: 0.7, f: 700, q: 0.7, vol: 0.09, a: 0.5, delay: i * 1.5 }); A.noise({ dur: 0.6, f: 500, q: 0.7, vol: 0.06, a: 0.3, delay: i * 1.5 + 0.8 }); } },
  riser: () => { A.noise({ dur: 1.4, f: 150, f2: 4500, q: 0.8, vol: 0.45, a: 0.9 }); A.tone({ f: 40, f2: 120, dur: 1.4, type: 'sawtooth', vol: 0.12, a: 0.9 }); },
  thud: () => { A.noise({ dur: 0.35, f: 90, q: 0.6, vol: 0.7, type: 'lowpass' }); },
  giggleLaugh: () => { for (let i = 0; i < 6; i++) A.tone({ f: R(700, 900), f2: R(500, 650), dur: 0.08, type: 'square', vol: 0.05, delay: i * 0.11 }); },
});

/* =====================================================================
   Jumpscare: strobing, lunging, chromatic-split face with a real scream
   ===================================================================== */
U.jumpscare = (face, dur = 0.8) => {
  const el = document.getElementById('jumpscare');
  if (!el.dataset.built) {
    el.innerHTML = '<div class="js-shake"><img class="js-c1" alt=""><img class="js-c2" alt=""><img class="js-main" alt=""><div class="js-glitch"></div></div><div class="js-strobe"></div><div class="js-scan"></div>';
    el.dataset.built = '1';
  }
  const url = G.faceURL(U.faceFor(face));
  el.querySelectorAll('img').forEach(i => { i.src = url; });
  el.querySelector('.js-glitch').style.backgroundImage = `url(${url})`;
  el.style.setProperty('--dur', dur + 's');
  el.classList.remove('hidden', 'go'); void el.offsetWidth; el.classList.add('go');
  A.sfx('scream', { dur: Math.max(0.6, dur) });
  clearTimeout(U._js); U._js = setTimeout(() => el.classList.add('hidden'), dur * 1000);
};

/* =====================================================================
   Entity visual upgrades
   ===================================================================== */
const smokeTex = (() => { let t; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); smokeBall(x, 128, 'rgba(10,10,10,0.5)', 'rgba(30,30,30,0.3)', 40, 0.3); t = new THREE.CanvasTexture(c); return t; }; })();
const RP = E.Rusher.prototype, rUpdate = RP.update, rRemove = RP.remove;
RP.update = function (dt) {
  const alive = rUpdate.call(this, dt);
  this._ft = (this._ft || 0) + dt;
  if (this.t > -1.3 && !this._riser) { this._riser = true; A.sfx('riser'); }
  if (!this.trail) {
    this.trail = [];
    for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), transparent: true, depthWrite: false, fog: false, opacity: 0 })); G.scene.add(s); this.trail.push({ s, p: null }); }
  }
  if (this.pos && this.sprite.visible) {
    const base = this.C.size, k = 1 + Math.sin(this._ft * 34) * 0.07 + Math.random() * 0.08;
    this.sprite.scale.set(base * k, base * k * R(0.95, 1.08), 1);
    this.sprite.material.rotation = R(-0.06, 0.06);
    this.sprite.material.map = Math.random() < 0.18 ? G.glitchTex(this.C.face) : G.faceTex(this.C.face);
    this._tt = (this._tt || 0) + dt;
    if (this._tt > 0.03) {
      this._tt = 0;
      const last = this.trail.pop(); last.p = this.pos.clone().add(new V3(R(-0.3, 0.3), R(-0.3, 0.3), R(-0.3, 0.3))); this.trail.unshift(last);
    }
    this.trail.forEach((o, i) => { if (!o.p) return; o.s.position.copy(o.p); const sc = this.C.size * (1.1 + i * 0.12); o.s.scale.set(sc, sc, 1); o.s.material.opacity = 0.55 * (1 - i / this.trail.length); });
  } else this.trail.forEach(o => { o.s.material.opacity = 0; });
  return alive;
};
RP.remove = function () { rRemove.call(this); if (this.trail) this.trail.forEach(o => G.scene.remove(o.s)); };

const SC = E.Screech.prototype, scUpdate = SC.update;
SC.update = function (dt) {
  const k = Math.min(1, this.t / 0.25);
  this.sprite.scale.setScalar(G.lerp(0.2, 1.05, k) * (1 + Math.sin(this.t * 40) * 0.04));
  this.sprite.material.rotation = Math.sin(this.t * 23) * 0.08;
  if (this.t > 2.2 && Math.random() < 0.3) this.sprite.material.map = G.glitchTex('screech'); else this.sprite.material.map = G.faceTex('screech');
  return scUpdate.call(this, dt);
};

const GZ = E.Gazer.prototype, gzUpdate = GZ.update;
GZ.update = function (dt) {
  const r = gzUpdate.call(this, dt);
  const base = this.kind === 'eyes' ? 1.9 : 1.4;
  this.sprite.scale.setScalar(base * (1 + Math.sin(this.t * 2.3) * 0.06));
  this.sprite.material.map = Math.random() < 0.04 ? G.glitchTex(this.kind) : G.faceTex(this.kind);
  if (this.warned && !this._stung) { this._stung = true; A.sfx('sting'); }
  return r;
};

const FG = E.Figure.prototype, fgUpdate = FG.update;
FG.update = function (dt) {
  const r = fgUpdate.call(this, dt);
  const h = this.m.userData.head;
  this._tw = (this._tw || 0) - dt;
  if (this._tw <= 0 && Math.random() < dt * 1.5) { this._tw = 0.12; this._twA = R(-0.7, 0.7); }
  if (this._tw > 0) { h.rotation.z = this._twA; h.rotation.x = R(-0.2, 0.2); }
  const d = G.distXZ(this.pos, G.player.pos);
  if (d < 6 && Math.random() < dt * 0.4) A.sfx('groan');
  return r;
};
const SK = E.Seek.prototype, skUpdate = SK.update;
SK.update = function (dt) {
  if (!this._stung) { this._stung = true; A.sfx('sting'); U.flash('#300'); }
  const r = skUpdate.call(this, dt);
  this.m.userData.body.rotation.z = Math.sin(this.t * 7) * 0.08;
  return r;
};
const MN = E.Monument.prototype, mnUpdate = MN.update;
MN.update = function (dt) {
  const before = this.pos.clone(), wasMoving = this.moving;
  const r = mnUpdate.call(this, dt);
  this._moved = (this._moved || 0) + before.distanceTo(this.pos);
  if (wasMoving && !this.moving && this._moved > 2.5) {
    this._moved = 0; A.sfx('sting'); G.player.shake = Math.max(G.player.shake, 0.3);
    this.m.children[2] && (this.m.children[2].rotation.z = R(-0.5, 0.5));
  }
  return r;
};
// Seek's eyes blink and swell as you pass.
const seekEyes = G.SP.seekEyes;
G.SP.seekEyes = (room, count) => {
  const before = room.group.children.length;
  seekEyes(room, count);
  room.eyeMeshes = room.group.children.slice(before).map(m => ({ m, sy: m.scale.y, sx: m.scale.x, blink: 0 }));
};

/* =====================================================================
   Dread: proximity heartbeat, vignette, FOV squeeze, ambient scares
   ===================================================================== */
const fear = G.fear = { level: 0, beatT: 0, ambT: R(18, 35), t: 0, shadow: null };
const NAMED = { Creak: 14, Noise: 14, Haste: 18, Monument: 16, Grumble: 13, Drone: 6, Stem: 5, Alma: 10 };
fear.reset = () => { fear.level = 0; fear.ambT = R(18, 35); if (fear.shadow) { G.scene.remove(fear.shadow.s); fear.shadow = null; } document.body.style.setProperty('--fear', 0); };
fear.update = (dt, g) => {
  fear.t += dt;
  const P = G.player, cam = G.camera.position;
  let target = 0;
  const r = g.rush;
  if (r) {
    if (r.t < 0) target = Math.max(target, 0.35 + 0.55 * (1 + r.t / r.C.wait));
    else if (r.pos) target = Math.max(target, G.clamp(1 - r.pos.distanceTo(cam) / 45, 0.4, 1));
  }
  if (g.seek) target = Math.max(target, 0.65 + 0.35 * G.clamp(1 - G.distXZ(g.seek.pos, P.pos) / 14, 0, 1));
  for (const f of g.figures) target = Math.max(target, G.clamp(1 - G.distXZ(f.pos, P.pos) / 14, 0, 1) * (f.state === 'chase' ? 1 : 0.8));
  for (const e of g.ents) {
    const range = NAMED[e.constructor.name];
    if (range && e.pos) target = Math.max(target, G.clamp(1 - e.pos.distanceTo(cam) / range, 0, 1) * 0.85);
  }
  if (g.a90 || g.giggle || g.screech) target = Math.max(target, 0.8);
  fear.level += (target - fear.level) * Math.min(1, dt * (target > fear.level ? 3 : 0.5));
  const L = fear.level;
  document.body.style.setProperty('--fear', L.toFixed(3));
  // heartbeat speeds up with fear
  if (L > 0.22) {
    fear.beatT -= dt;
    if (fear.beatT <= 0) { fear.beatT = G.lerp(1.2, 0.34, L); A.sfx('heartbeat'); document.body.classList.remove('beat'); void document.body.offsetWidth; document.body.classList.add('beat'); }
  }
  // tunnel vision + subtle shudder
  const fov = G.save.settings.fov - 9 * L + Math.sin(fear.t * (3 + L * 6)) * L * 0.8;
  if (Math.abs(G.camera.fov - fov) > 0.05) { G.camera.fov = fov; G.camera.updateProjectionMatrix(); }
  if (L > 0.55) P.shake = Math.max(P.shake, (L - 0.55) * 0.25);
  if (P.hiding && L > 0.4 && Math.random() < dt * 0.25) A.sfx('breath');
  // Seek's wall eyes
  const cur = g.cur;
  for (const room of g.rooms) if (room.eyeMeshes && Math.abs(room.index - (cur ? cur.index : 0)) <= 1) {
    for (const e of room.eyeMeshes) {
      if (e.blink > 0) e.blink -= dt; else if (Math.random() < dt * 0.25) e.blink = 0.15;
      const near = G.clamp(1 - e.m.getWorldPosition(new V3()).distanceTo(cam) / 6, 0, 1);
      e.m.scale.set(e.sx * (1 + near * 0.35), e.blink > 0 ? e.sy * 0.08 : e.sy * (1 + near * 0.35), 1);
    }
  }
  // shadow figure: vanishes when you look straight at it
  const sh = fear.shadow;
  if (sh) {
    sh.t += dt;
    const seen = G.lookingAt(sh.s.position, 0.93) && G.los(cam, sh.s.position, g.cols);
    if (seen || sh.t > 4.5 || !cur || cur !== sh.room) {
      if (seen) { A.sfx('whoosh'); if (Math.random() < 0.5) A.sfx('whisper'); }
      G.scene.remove(sh.s); fear.shadow = null;
    }
  }
  // ambient scares while things are quiet
  if (L < 0.15 && cur && !cur.safe && !g.escaping) {
    fear.ambT -= dt;
    if (fear.ambT <= 0) { fear.ambT = R(22, 55); ambient(g, cur); }
  }
};
function ambient(g, cur) {
  const ev = G.weighted({ knock: 2, whisper: 2, footsteps: 2, groan: 1.5, bulb: 1.5, shadow: 2.2, flicker: 2, subliminal: 1 });
  const P = G.player;
  if (ev === 'knock') A.sfx('knock');
  else if (ev === 'whisper') { A.sfx('whisper'); if (Math.random() < 0.4) U.caption('...', 1.5); }
  else if (ev === 'footsteps') { A.sfx('footsteps'); }
  else if (ev === 'groan') A.sfx('groan');
  else if (ev === 'bulb') {
    const lamps = cur.lamps.filter(Lp => Lp.on && !Lp.broken && !Lp.unbreakable);
    if (lamps.length > 1) { G.pick(lamps).broken = true; A.sfx('break'); P.shake = 0.3; }
    else A.sfx('knock');
  } else if (ev === 'flicker') { cur.flicker = R(0.8, 1.6); A.sfx('flicker'); A.sfx('groan'); }
  else if (ev === 'shadow' && !fear.shadow && !P.hiding) {
    // somewhere in this room, out of direct view, at distance
    const cam = G.camera.position;
    for (let k = 0; k < 20; k++) {
      const p = cur.l2w(G.rand(cur.xl + 0.6, cur.xr - 0.6), 0, G.rand(0.6, cur.L - 0.6));
      const head = p.clone().add(new V3(0, 1.5, 0));
      if (head.distanceTo(cam) < 6 || G.lookingAt(head, 0.6) || !G.los(cam, head, g.cols)) continue;
      const s = G.faceSprite('shadow', 2.6); s.position.copy(head); G.scene.add(s);
      fear.shadow = { s, t: 0, room: cur };
      A.sfx('footsteps');
      break;
    }
  } else if (ev === 'subliminal') {
    const el = document.getElementById('subliminal');
    const pick = G.pick(['rush', 'figure', 'seek', 'jack', 'screech', 'a60', 'eyes', 'giggle']);
    el.src = G.faceURL(pick); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    A.noise && A.sfx('static');
  }
}
})();
