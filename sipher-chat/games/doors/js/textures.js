// Procedural canvas textures, materials, shared geometry, entity faces and 3D models.
(() => {
'use strict';
const V3 = THREE.Vector3;
const T = G.tex = {}, M = G.mat = {}, GEO = G.geo = {};

function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function toTex(c, rep = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(h, a) { const [r, g, b] = hex2rgb(h); const f = v => G.clamp(Math.round(v + a), 0, 255); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function speckle(x, w, h, amt) {
  const id = x.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(id, 0, 0);
}
function blotch(x, w, h, n, rgb, rmin, rmax, alpha) {
  for (let i = 0; i < n; i++) {
    const r = G.rand(rmin, rmax), px = Math.random() * w, py = Math.random() * h;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(${rgb},${alpha})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
}

/* ---------- surface textures ---------- */
function wallpaper(base, pat, wain) {
  const S = 512, [c, x] = cv(S);
  x.fillStyle = base; x.fillRect(0, 0, S, 384);
  for (let i = 0; i < S; i += 64) { x.fillStyle = 'rgba(255,255,255,0.035)'; x.fillRect(i, 0, 22, 384); x.fillStyle = 'rgba(0,0,0,0.05)'; x.fillRect(i + 22, 0, 4, 384); }
  x.fillStyle = pat;
  for (let gy = 0; gy < 384; gy += 64) for (let gx = 0; gx < S; gx += 64) {
    const ox = gx + ((gy / 64) % 2 ? 32 : 0) + 16, oy = gy + 32;
    x.save(); x.translate(ox % S, oy);
    x.beginPath(); x.moveTo(0, -14); x.quadraticCurveTo(10, -3, 0, 14); x.quadraticCurveTo(-10, -3, 0, -14); x.fill();
    x.beginPath(); x.arc(0, -19, 3, 0, 7); x.arc(0, 19, 2, 0, 7); x.fill();
    x.restore();
  }
  const g = x.createLinearGradient(0, 0, 0, 384);
  g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(0.5, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.15)');
  x.fillStyle = g; x.fillRect(0, 0, S, 384);
  blotch(x, S, 384, 8, '20,12,5', 20, 70, 0.18);
  x.fillStyle = '#2b190d'; x.fillRect(0, 378, S, 12); x.fillStyle = '#6a4528'; x.fillRect(0, 380, S, 3);
  x.fillStyle = wain; x.fillRect(0, 390, S, 122);
  for (let px = 0; px < S; px += 128) {
    x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 4; x.strokeRect(px + 14, 404, 100, 88);
    x.strokeStyle = 'rgba(255,220,180,0.1)'; x.lineWidth = 1.5; x.strokeRect(px + 18, 408, 92, 80);
  }
  x.fillStyle = '#170d06'; x.fillRect(0, 496, S, 16);
  speckle(x, S, S, 16);
  return toTex(c);
}
function planks(c1, rows = 16, S = 512) {
  const [c, x] = cv(S); const h = S / rows;
  for (let r = 0; r < rows; r++) {
    let px = -Math.random() * 200;
    while (px < S) {
      const len = G.rand(150, 320);
      x.fillStyle = shade(c1, G.rand(-20, 16)); x.fillRect(px, r * h, len, h);
      for (let k = 0; k < 5; k++) {
        x.strokeStyle = `rgba(0,0,0,${G.rand(0.05, 0.14)})`; x.lineWidth = 1;
        const yy = r * h + G.rand(2, h - 2);
        x.beginPath(); x.moveTo(px, yy); x.bezierCurveTo(px + len * 0.3, yy + G.rand(-3, 3), px + len * 0.6, yy + G.rand(-3, 3), px + len, yy); x.stroke();
      }
      x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(px, r * h, 2, h);
      px += len;
    }
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(0, r * h, S, 2);
    x.fillStyle = 'rgba(255,230,200,0.05)'; x.fillRect(0, r * h + 2, S, 1);
  }
  speckle(x, S, S, 14);
  return toTex(c);
}
function carpet() {
  const S = 512, [c, x] = cv(S);
  x.fillStyle = '#4c3d3d'; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(160,130,110,0.4)'; x.lineWidth = 3;
  for (let i = 0; i < S; i += 128) for (let j = 0; j < S; j += 128) {
    x.beginPath(); x.moveTo(i + 64, j + 14); x.lineTo(i + 114, j + 64); x.lineTo(i + 64, j + 114); x.lineTo(i + 14, j + 64); x.closePath(); x.stroke();
    x.fillStyle = 'rgba(160,130,110,0.3)'; x.beginPath(); x.arc(i + 64, j + 64, 9, 0, 7); x.fill();
  }
  x.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 0; i < S; i += 4) x.fillRect(0, i, S, 1);
  speckle(x, S, S, 22);
  return toTex(c);
}
function plaster(base, tiles) {
  const S = 512, [c, x] = cv(S);
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  blotch(x, S, S, 30, '60,50,40', 20, 80, 0.12);
  if (tiles) { x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; for (let i = 0; i <= S; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); } }
  speckle(x, S, S, 20);
  return toTex(c);
}
function rock(base, crack = true) {
  const S = 512, [c, x] = cv(S);
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  blotch(x, S, S, 90, '0,0,0', 10, 60, 0.25);
  blotch(x, S, S, 50, '140,120,100', 8, 40, 0.12);
  if (crack) {
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2;
    for (let i = 0; i < 18; i++) { let px = Math.random() * S, py = Math.random() * S; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += G.rand(-30, 30); py += G.rand(-30, 30); x.lineTo(px, py); } x.stroke(); }
  }
  speckle(x, S, S, 40);
  return toTex(c);
}
function concrete(base, stains) {
  const S = 512, [c, x] = cv(S);
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  blotch(x, S, S, 40, '0,0,0', 15, 70, 0.1);
  if (stains) for (let i = 0; i < 10; i++) { const px = Math.random() * S; const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(30,20,10,0.25)'); g.addColorStop(1, 'rgba(30,20,10,0)'); x.fillStyle = g; x.fillRect(px, 0, G.rand(3, 14), G.rand(100, S)); }
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 256); x.lineTo(S, 256); x.moveTo(256, 0); x.lineTo(256, S); x.stroke();
  speckle(x, S, S, 26);
  return toTex(c);
}
function metal(base) {
  const S = 256, [c, x] = cv(S);
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 2) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; x.fillRect(0, i, S, 1); }
  x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 3; x.strokeRect(2, 2, S - 4, S - 4);
  x.fillStyle = 'rgba(0,0,0,0.5)'; [[10, 10], [S - 10, 10], [10, S - 10], [S - 10, S - 10]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 4, 0, 7); x.fill(); });
  blotch(x, S, S, 10, '90,50,20', 10, 40, 0.15);
  speckle(x, S, S, 16);
  return toTex(c);
}
function grate() {
  const S = 256, [c, x] = cv(S);
  x.fillStyle = '#1b1c1e'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#4a4c50';
  for (let i = 0; i < S; i += 16) { x.fillRect(i, 0, 5, S); x.fillRect(0, i, S, 5); }
  speckle(x, S, S, 20);
  return toTex(c);
}
function leaves(base, dense) {
  const S = 512, [c, x] = cv(S);
  x.fillStyle = shade(base, -30); x.fillRect(0, 0, S, S);
  for (let i = 0; i < (dense ? 2600 : 1500); i++) {
    x.fillStyle = shade(base, G.rand(-35, 25));
    x.beginPath(); x.ellipse(Math.random() * S, Math.random() * S, G.rand(3, 9), G.rand(2, 5), Math.random() * 3, 0, 7); x.fill();
  }
  speckle(x, S, S, 20);
  return toTex(c);
}
function grass() {
  const S = 512, [c, x] = cv(S);
  x.fillStyle = '#1f2e16'; x.fillRect(0, 0, S, S);
  blotch(x, S, S, 40, '60,50,20', 20, 60, 0.25);
  for (let i = 0; i < 6000; i++) { x.fillStyle = shade('#3a5426', G.rand(-30, 20)); x.fillRect(Math.random() * S, Math.random() * S, 1.5, G.rand(3, 7)); }
  speckle(x, S, S, 18);
  return toTex(c);
}
function tiles(c1, c2) {
  const S = 512, [c, x] = cv(S);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = shade((i + j) % 2 ? c1 : c2, G.rand(-10, 10)); x.fillRect(i * 64, j * 64, 64, 64); }
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2;
  for (let i = 0; i <= S; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); }
  blotch(x, S, S, 20, '20,30,10', 20, 60, 0.2);
  speckle(x, S, S, 20);
  return toTex(c);
}
function books() {
  const S = 512, [c, x] = cv(S);
  x.fillStyle = '#2a1608'; x.fillRect(0, 0, S, S);
  const cols = ['#5a1a14', '#1e3a24', '#1c2846', '#5a4a1c', '#3a1a3a', '#6a3a1a', '#222', '#4a2a10'];
  for (let row = 0; row < 4; row++) {
    const y0 = row * 128 + 14, y1 = row * 128 + 118;
    let px = 4;
    while (px < S - 6) {
      const w = G.rand(10, 22), h = G.rand(70, 100);
      x.fillStyle = shade(G.pick(cols), G.rand(-15, 15)); x.fillRect(px, y1 - h, w, h);
      x.fillStyle = 'rgba(220,180,90,0.5)'; x.fillRect(px + 2, y1 - h + 10, w - 4, 2); x.fillRect(px + 2, y1 - 16, w - 4, 2);
      px += w + G.rand(0, 2);
      if (Math.random() < 0.04) px += 20;
    }
    x.fillStyle = '#1a0d05'; x.fillRect(0, y1, S, 14);
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, y0 - 14, S, 16);
  }
  speckle(x, S, S, 12);
  return toTex(c);
}
function doorTex(base) {
  const [c, x] = cv(256, 512);
  x.fillStyle = base; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(0,0,0,${G.rand(0.04, 0.12)})`; const px = Math.random() * 256; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + G.rand(-6, 6), 170, px + G.rand(-6, 6), 340, px, 512); x.stroke(); }
  const panel = (px, py, w, h) => {
    x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(px, py, w, h);
    x.fillStyle = 'rgba(255,220,180,0.06)'; x.fillRect(px + 6, py + 6, w - 12, h - 12);
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3; x.strokeRect(px + 6, py + 6, w - 12, h - 12);
  };
  panel(28, 30, 200, 190); panel(28, 260, 90, 220); panel(138, 260, 90, 220);
  speckle(x, 256, 512, 14);
  return toTex(c, false);
}
function gateTex() {
  const [c, x] = cv(256, 512);
  x.clearRect(0, 0, 256, 512);
  x.fillStyle = '#16181a';
  for (let i = 10; i < 256; i += 30) x.fillRect(i, 0, 9, 512);
  x.fillRect(0, 0, 256, 16); x.fillRect(0, 250, 256, 14); x.fillRect(0, 496, 256, 16);
  for (let i = 10; i < 256; i += 30) { x.beginPath(); x.moveTo(i - 4, 0); x.lineTo(i + 4.5, -20); x.lineTo(i + 13, 0); x.fill(); }
  return toTex(c, false);
}
function paper() {
  const [c, x] = cv(256);
  x.fillStyle = '#d9cfb4'; x.fillRect(0, 0, 256, 256);
  blotch(x, 256, 256, 10, '120,90,40', 20, 60, 0.2);
  x.strokeStyle = 'rgba(40,30,20,0.6)'; x.lineWidth = 2;
  for (let i = 40; i < 230; i += 22) { x.beginPath(); x.moveTo(20, i); x.lineTo(G.rand(150, 236), i); x.stroke(); }
  return toTex(c, false);
}
function painting() {
  const [c, x] = cv(128, 160);
  const hues = G.rand(0, 360);
  const g = x.createLinearGradient(0, 0, 0, 160);
  g.addColorStop(0, `hsl(${hues},30%,${G.rand(15, 35)}%)`); g.addColorStop(1, `hsl(${hues + 40},30%,${G.rand(8, 20)}%)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 160);
  const kind = G.randi(0, 2);
  if (kind === 0) { // landscape
    x.fillStyle = `hsl(${hues + 90},25%,18%)`; x.beginPath(); x.moveTo(0, 110); for (let i = 0; i <= 128; i += 16) x.lineTo(i, 90 + Math.random() * 30); x.lineTo(128, 160); x.lineTo(0, 160); x.fill();
    x.fillStyle = 'rgba(255,240,200,0.5)'; x.beginPath(); x.arc(G.rand(20, 108), 40, 10, 0, 7); x.fill();
  } else if (kind === 1) { // portrait silhouette
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.arc(64, 60, 22, 0, 7); x.fill(); x.fillRect(30, 84, 68, 80);
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(55, 56, 4, 3); x.fillRect(69, 56, 4, 3);
  } else { // still life
    x.fillStyle = `hsl(${hues + 180},30%,30%)`; x.beginPath(); x.ellipse(64, 110, 30, 20, 0, 0, 7); x.fill();
    x.fillStyle = `hsl(${hues + 20},50%,40%)`; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(G.rand(44, 84), G.rand(80, 100), 8, 0, 7); x.fill(); }
  }
  speckle(x, 128, 160, 30);
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 128, 160);
  return toTex(c, false);
}
G.plateTex = (() => {
  const cache = {};
  return text => {
    if (cache[text]) return cache[text];
    const [c, x] = cv(256, 96);
    const g = x.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#d9b768'); g.addColorStop(0.5, '#a5813a'); g.addColorStop(1, '#6f5420');
    x.fillStyle = g; x.beginPath(); x.roundRect(4, 4, 248, 88, 14); x.fill();
    x.strokeStyle = '#3a2a0c'; x.lineWidth = 4; x.beginPath(); x.roundRect(12, 12, 232, 72, 9); x.stroke();
    x.fillStyle = '#2a1c06';
    const size = text.length > 6 ? 40 : 56;
    x.font = `700 ${size}px Oswald, Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 50);
    x.fillStyle = 'rgba(255,240,200,0.25)'; x.fillText(text, 127, 48);
    return (cache[text] = toTex(c, false));
  };
})();
G.signTex = (text, sub) => {
  const [c, x] = cv(256, 128);
  x.fillStyle = '#2a2016'; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = '#7a6040'; x.lineWidth = 6; x.strokeRect(5, 5, 246, 118);
  x.fillStyle = '#e8d8b0'; x.font = '700 52px Oswald, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 128, sub ? 52 : 64);
  if (sub) { x.font = '400 22px Oswald, Georgia, serif'; x.fillStyle = '#b0a080'; x.fillText(sub, 128, 98); }
  return toTex(c, false);
};

/* ---------- entity faces (sprites + jumpscares) ---------- */
function smoke(x, S, rgb, n = 60, spread = 0.36) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 7, r = Math.random() * S * spread, px = S / 2 + Math.cos(a) * r, py = S / 2 + Math.sin(a) * r, rr = G.rand(S * 0.08, S * 0.2);
    const g = x.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, `rgba(${rgb},0.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
}
function eyesPair(x, cx, cy, dx, rx, ry, col, pupil, pr, glow) {
  for (const s of [-1, 1]) {
    if (glow) { x.shadowColor = glow; x.shadowBlur = 25; }
    x.fillStyle = col; x.beginPath(); x.ellipse(cx + s * dx, cy, rx, ry, s * 0.15, 0, 7); x.fill();
    x.shadowBlur = 0;
    if (pupil) { x.fillStyle = pupil; x.beginPath(); x.arc(cx + s * dx + G.rand(-2, 2), cy + 2, pr, 0, 7); x.fill(); }
  }
}
function grin(x, cx, cy, w, h, col, teeth, dark = '#000') {
  x.fillStyle = col;
  x.beginPath(); x.moveTo(cx - w / 2, cy - h * 0.2);
  x.quadraticCurveTo(cx, cy + h * 1.3, cx + w / 2, cy - h * 0.2);
  x.quadraticCurveTo(cx, cy + h * 0.35, cx - w / 2, cy - h * 0.2); x.fill();
  if (teeth) { x.strokeStyle = dark; x.lineWidth = 2.5; for (let i = 1; i < teeth; i++) { const tx = cx - w / 2 + (w / teeth) * i; x.beginPath(); x.moveTo(tx, cy - h * 0.3); x.lineTo(tx, cy + h); x.stroke(); } }
}
function openMouth(x, cx, cy, w, h, teethCol) {
  x.fillStyle = '#000'; x.beginPath(); x.ellipse(cx, cy, w / 2, h / 2, 0, 0, 7); x.fill();
  x.fillStyle = teethCol;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i + 0.5) / n * Math.PI, px = cx + Math.cos(a) * w / 2 * 0.95, py = cy + Math.sin(a) * h / 2 * 0.95;
    x.beginPath(); x.moveTo(px - 6, py); x.lineTo(px + 6, py); x.lineTo(cx + Math.cos(a) * w * 0.3, cy + Math.sin(a) * h * 0.25); x.fill();
    const b = (i + 0.5) / n * Math.PI, qx = cx + Math.cos(b) * w / 2 * 0.95, qy = cy + Math.sin(b) * h / 2 * 0.95;
    x.beginPath(); x.moveTo(qx - 6, qy); x.lineTo(qx + 6, qy); x.lineTo(cx + Math.cos(b) * w * 0.3, cy + Math.sin(b) * h * 0.25); x.fill();
  }
}
const FACES = {
  rush(x, S) { smoke(x, S, '10,10,10', 80); smoke(x, S, '0,0,0', 30, 0.2); eyesPair(x, S / 2, S * 0.4, S * 0.15, S * 0.08, S * 0.1, '#e8e8e8', '#000', 6); grin(x, S / 2, S * 0.62, S * 0.5, S * 0.16, '#f2f2f2', 14); },
  ambush(x, S) { smoke(x, S, '40,70,40', 80); eyesPair(x, S / 2, S * 0.38, S * 0.14, S * 0.07, S * 0.12, '#000', null, 0); x.fillStyle = '#d8ffd0'; [-1, 1].forEach(s => { x.beginPath(); x.arc(S / 2 + s * S * 0.14, S * 0.4, 5, 0, 7); x.fill(); }); openMouth(x, S / 2, S * 0.66, S * 0.36, S * 0.28, '#e0f0d0'); },
  screech(x, S) { smoke(x, S, '5,5,5', 70, 0.3); openMouth(x, S / 2, S * 0.58, S * 0.6, S * 0.42, '#f4f4f4'); eyesPair(x, S / 2, S * 0.3, S * 0.12, S * 0.035, S * 0.035, '#fff', null, 0); },
  eyes(x, S) {
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.42); g.addColorStop(0, '#2a0f3a'); g.addColorStop(0.7, '#14061e'); g.addColorStop(1, 'rgba(60,20,90,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * 7 + 0.3, r = i === 0 ? 0 : S * G.rand(0.12, 0.26), px = S / 2 + Math.cos(a) * r, py = S / 2 + Math.sin(a) * r;
      x.shadowColor = '#d58cff'; x.shadowBlur = 20; x.fillStyle = '#f3dcff';
      x.beginPath(); x.ellipse(px, py, S * 0.05, S * 0.035, a, 0, 7); x.fill(); x.shadowBlur = 0;
      x.fillStyle = '#2a0040'; x.beginPath(); x.arc(px, py, S * 0.017, 0, 7); x.fill();
    }
  },
  halt(x, S) {
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.45); g.addColorStop(0, 'rgba(120,220,255,0.9)'); g.addColorStop(0.6, 'rgba(40,120,200,0.5)'); g.addColorStop(1, 'rgba(0,40,120,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    eyesPair(x, S / 2, S * 0.42, S * 0.12, S * 0.06, S * 0.045, '#002040', null, 0);
    x.strokeStyle = '#002040'; x.lineWidth = 6; x.beginPath(); x.arc(S / 2, S * 0.72, S * 0.12, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
  },
  a60(x, S) {
    smoke(x, S, '120,0,0', 60);
    for (let k = 0; k < 3; k++) { const ox = G.rand(-30, 30), oy = G.rand(-20, 20); eyesPair(x, S / 2 + ox, S * 0.42 + oy, S * 0.1, S * 0.05, S * 0.06, k ? 'rgba(255,255,255,0.5)' : '#fff', '#300', 4); grin(x, S / 2 + ox, S * 0.64 + oy, S * 0.4, S * 0.12, k ? 'rgba(255,255,255,0.4)' : '#fff', 10, '#600'); }
  },
  a90(x, S) {
    x.fillStyle = '#000'; x.fillRect(S * 0.15, S * 0.12, S * 0.7, S * 0.76);
    x.fillStyle = '#c00'; x.fillRect(S * 0.27, S * 0.3, S * 0.14, S * 0.14); x.fillRect(S * 0.59, S * 0.3, S * 0.14, S * 0.14);
    x.fillRect(S * 0.3, S * 0.58, S * 0.4, S * 0.18);
    x.fillStyle = '#000'; for (let i = 0; i < 6; i++) x.fillRect(S * 0.31 + i * S * 0.066, S * 0.58, S * 0.02, S * 0.08);
  },
  a120(x, S) { smoke(x, S, '40,10,70', 60); eyesPair(x, S / 2, S * 0.4, S * 0.13, S * 0.06, S * 0.08, '#000', null, 0); x.strokeStyle = '#000'; x.lineWidth = 8; x.beginPath(); x.arc(S / 2, S * 0.55, S * 0.16, 0.2, Math.PI - 0.2); x.stroke(); },
  blitz(x, S) { smoke(x, S, '90,20,90', 70); eyesPair(x, S / 2, S * 0.4, S * 0.14, S * 0.07, S * 0.06, '#ffd0ff', '#200', 5, '#f0f'); grin(x, S / 2, S * 0.62, S * 0.5, S * 0.12, '#ffe0ff', 18); },
  lookman(x, S) {
    x.fillStyle = '#2e2e30'; x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.3, S * 0.4, 0, 0, 7); x.fill();
    eyesPair(x, S / 2, S * 0.4, S * 0.11, S * 0.07, S * 0.07, '#f0f0f0', '#000', 10, '#fff');
  },
  haste(x, S) { smoke(x, S, '70,0,0', 70); x.fillStyle = '#000'; x.beginPath(); x.arc(S / 2, S * 0.45, S * 0.22, 0, 7); x.fill(); eyesPair(x, S / 2, S * 0.42, S * 0.09, S * 0.045, S * 0.05, '#ff3030', null, 0, '#f00'); grin(x, S / 2, S * 0.57, S * 0.26, S * 0.08, '#ff6060', 9); },
  jack(x, S) { x.fillStyle = '#100'; x.fillRect(0, 0, S, S); x.fillStyle = '#c11'; x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.3, S * 0.4, 0, 0, 7); x.fill(); eyesPair(x, S / 2, S * 0.4, S * 0.12, S * 0.08, S * 0.08, '#000', '#fff', 5); openMouth(x, S / 2, S * 0.68, S * 0.25, S * 0.2, '#fff'); },
  timothy(x, S) {
    x.strokeStyle = '#1a1010'; x.lineWidth = 7;
    for (let i = 0; i < 8; i++) { const a = (i < 4 ? Math.PI : 0) + (i % 4 - 1.5) * 0.4; x.beginPath(); x.moveTo(S / 2, S / 2); x.quadraticCurveTo(S / 2 + Math.cos(a) * S * 0.25, S / 2 - S * 0.2, S / 2 + Math.cos(a) * S * 0.42, S / 2 + Math.sin(a) * S * 0.2 + S * 0.15); x.stroke(); }
    x.fillStyle = '#2a1512'; x.beginPath(); x.ellipse(S / 2, S * 0.55, S * 0.16, S * 0.2, 0, 0, 7); x.fill();
    x.beginPath(); x.arc(S / 2, S * 0.38, S * 0.1, 0, 7); x.fill();
    x.fillStyle = '#f33'; [-1, 1].forEach(s => { x.beginPath(); x.arc(S / 2 + s * 10, S * 0.36, 5, 0, 7); x.fill(); });
  },
  dupe(x, S) { x.fillStyle = '#2a170c'; x.fillRect(S * 0.25, S * 0.08, S * 0.5, S * 0.84); openMouth(x, S / 2, S * 0.5, S * 0.42, S * 0.5, '#e8e0d0'); eyesPair(x, S / 2, S * 0.2, S * 0.09, S * 0.03, S * 0.03, '#fff', null, 0, '#fff'); },
  seekeye(x, S) {
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.fillStyle = '#f0f0f0'; x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.26, S * 0.16, 0, 0, 7); x.fill();
    x.fillStyle = '#000'; x.beginPath(); x.arc(S / 2, S / 2, S * 0.09, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.9)'; x.lineWidth = 3;
    for (let i = 0; i < 10; i++) { const a = Math.random() * 7; x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * S * 0.2, S / 2 + Math.sin(a) * S * 0.12); x.lineTo(S / 2 + Math.cos(a) * S * 0.45, S / 2 + Math.sin(a) * S * 0.4); x.stroke(); }
  },
  seek(x, S) { x.fillStyle = '#000'; x.fillRect(0, 0, S, S); const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5); g.addColorStop(0, '#222'); g.addColorStop(1, '#000'); x.fillStyle = g; x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.4, S * 0.48, 0, 0, 7); x.fill(); FACES.seekeye(x, S); },
  figure(x, S) {
    x.fillStyle = '#1a0605'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#6a1c14'; x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.34, S * 0.46, 0, 0, 7); x.fill();
    x.fillStyle = '#000'; x.beginPath(); x.ellipse(S / 2, S * 0.56, S * 0.22, S * 0.3, 0, 0, 7); x.fill();
    x.strokeStyle = '#e8dcc8'; x.lineWidth = 7;
    for (let i = 0; i < 7; i++) { const yy = S * 0.32 + i * S * 0.07; x.beginPath(); x.moveTo(S * 0.3, yy); x.quadraticCurveTo(S / 2, yy + 14, S * 0.7, yy); x.stroke(); }
  },
  grumble(x, S) { x.fillStyle = '#121010'; x.fillRect(0, 0, S, S); x.fillStyle = '#3c3530'; x.beginPath(); x.arc(S / 2, S / 2, S * 0.42, 0, 7); x.fill(); openMouth(x, S / 2, S * 0.58, S * 0.62, S * 0.5, '#e8d890'); eyesPair(x, S / 2, S * 0.24, S * 0.2, S * 0.04, S * 0.03, '#ffd040', null, 0, '#fc0'); },
  giggle(x, S) { smoke(x, S, '0,0,0', 50, 0.3); grin(x, S / 2, S * 0.5, S * 0.7, S * 0.25, '#fff', 20); eyesPair(x, S / 2, S * 0.3, S * 0.18, S * 0.03, S * 0.03, '#fff', null, 0); },
  monument(x, S) { x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, S, S); x.fillStyle = '#d8d6d0'; x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.32, S * 0.44, 0, 0, 7); x.fill(); x.fillStyle = '#000'; [-1, 1].forEach(s => { x.beginPath(); x.ellipse(S / 2 + s * S * 0.12, S * 0.42, S * 0.05, S * 0.08, 0, 0, 7); x.fill(); }); x.fillRect(S * 0.42, S * 0.62, S * 0.16, S * 0.12); },
  gloombat(x, S) { x.fillStyle = '#000'; x.beginPath(); x.moveTo(S / 2, S * 0.4); x.quadraticCurveTo(S * 0.2, S * 0.2, S * 0.02, S * 0.5); x.quadraticCurveTo(S * 0.25, S * 0.45, S / 2, S * 0.62); x.quadraticCurveTo(S * 0.75, S * 0.45, S * 0.98, S * 0.5); x.quadraticCurveTo(S * 0.8, S * 0.2, S / 2, S * 0.4); x.fill(); x.fillStyle = '#ff5'; [-1, 1].forEach(s => { x.beginPath(); x.arc(S / 2 + s * 8, S * 0.45, 4, 0, 7); x.fill(); }); },
  hands(x, S) { x.fillStyle = '#000'; x.fillRect(0, 0, S, S); for (let i = 0; i < 12; i++) { x.fillStyle = '#111'; x.save(); x.translate(G.rand(0, S), S); x.rotate(G.rand(-0.5, 0.5)); x.fillRect(-10, -S * G.rand(0.5, 0.9), 20, S); x.restore(); } FACES.seekeye(x, S); },
  vacuum(x, S) { const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5); g.addColorStop(0, '#000'); g.addColorStop(0.5, '#111'); g.addColorStop(1, '#555'); x.fillStyle = g; x.fillRect(0, 0, S, S); },
  hide(x, S) { x.fillStyle = '#000'; x.fillRect(0, 0, S, S); eyesPair(x, S / 2, S / 2, S * 0.15, S * 0.06, S * 0.025, '#fff', null, 0, '#fff'); },
  snare(x, S) { x.fillStyle = '#100'; x.fillRect(0, 0, S, S); openMouth(x, S / 2, S / 2, S * 0.8, S * 0.6, '#ccc'); },
  hp(x, S) { x.fillStyle = '#300'; x.fillRect(0, 0, S, S); },
};
G.FACES = FACES;
G.faceKit = { smoke, eyesPair, grin, openMouth };
G.texKit = { cv, toTex, speckle, blotch, shade, std: (map, rough, extra) => std(map, rough, extra) };
const faceCache = {};
G.faceCanvas = name => {
  if (faceCache[name]) return faceCache[name];
  const S = 512, [c, x] = cv(S);
  (FACES[name] || FACES.rush)(x, S);
  if (G.horrify) G.horrify(x, S, name);
  return (faceCache[name] = c);
};
G.faceTex = (() => { const cache = {}; return name => cache[name] || (cache[name] = toTex(G.faceCanvas(name), false)); })();
G.faceURL = (() => { const cache = {}; return name => cache[name] || (cache[name] = G.faceCanvas(name).toDataURL()); })();
G.faceSprite = (name, scale = 2) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.faceTex(name), transparent: true, depthWrite: false, fog: false }));
  s.scale.set(scale, scale, 1);
  return s;
};

/* ---------- materials + shared geometry ---------- */
const std = (map, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ map, roughness: rough, metalness: 0 }, extra));
G.makeMats = () => {
  // Palette sampled from the real DOORS lobby export (Wall1 #3f5347, Wallstrip #76625e, Wood #493328).
  M.wallA = std(wallpaper('#3f5347', 'rgba(150,175,150,0.18)', '#4a3a30'));
  M.wallB = std(wallpaper('#4e4238', 'rgba(170,140,110,0.2)', '#3e2c22'));
  M.wallC = std(wallpaper('#523437', 'rgba(190,130,120,0.2)', '#3e2a22'));
  M.wallD = std(wallpaper('#3f4a52', 'rgba(150,165,185,0.18)', '#3a2c24'));
  M.floor = std(planks('#5f5250'), 0.7);
  M.floor2 = std(planks('#493328'), 0.7);
  M.carpet = std(carpet(), 0.95);
  M.ceil = std(plaster('#bfb39e', false), 0.95);
  M.trim = std(planks('#3a2414', 6, 256), 0.6);
  M.wood = std(planks('#6b4a2c', 8, 256), 0.7);
  M.darkwood = std(planks('#3e2715', 8, 256), 0.65);
  M.door = std(doorTex('#4a2c18'), 0.6);
  M.doorDark = std(doorTex('#2c2a28'), 0.5, { metalness: 0.3 });
  M.gate = new THREE.MeshStandardMaterial({ map: gateTex(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
  M.rock = std(rock('#6a5a4c'), 0.95);
  M.rockDark = std(rock('#4a3e34'), 0.95);
  M.dirt = std(rock('#4e3e2e', false), 1);
  M.beam = std(planks('#5a3c22', 4, 256), 0.8);
  M.concrete = std(concrete('#5a5854', true), 0.9);
  M.concreteDark = std(concrete('#34312e', true), 0.9);
  M.roomsWall = std(concrete('#4a4e52', false), 0.85);
  M.roomsFloor = std(concrete('#2c2e30', true), 0.8);
  M.roomsCeil = std(plaster('#6a6e72', true), 0.9);
  M.metal = std(metal('#4a4d52'), 0.45, { metalness: 0.6 });
  M.rust = std(metal('#5a3a26'), 0.7, { metalness: 0.4 });
  M.locker = std(metal('#3a4a58'), 0.5, { metalness: 0.5 });
  M.grate = std(grate(), 0.6, { metalness: 0.5 });
  M.hedge = std(leaves('#2f4a22', true), 1);
  M.leaf = std(leaves('#35602a', false), 1);
  M.grass = std(grass(), 1);
  M.tile = std(tiles('#3a4a3a', '#2c382c'), 0.6);
  M.stone = std(concrete('#6a665e', false), 0.9);
  M.books = std(books(), 0.9);
  M.paper = std(paper(), 0.9);
  M.fabric = std(plaster('#6a2a2a', false), 1);
  M.sheet = std(plaster('#d8d0c0', false), 1);
  M.black = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.6 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.3, metalness: 0.9 });
  M.gold = new THREE.MeshStandardMaterial({ color: 0xffcc44, roughness: 0.25, metalness: 1, emissive: 0x332200 });
  M.shade = new THREE.MeshStandardMaterial({ color: 0x7a5a30, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x2a1a08 });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x223322, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35 });
  M.pot = new THREE.MeshStandardMaterial({ color: 0x6a3a22, roughness: 0.8 });
  M.white = new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.6 });
  M.water = new THREE.MeshStandardMaterial({ color: 0x0c2a34, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 });
  M.fire = new THREE.MeshBasicMaterial({ color: 0xff7a20 });
  M.blueGlow = new THREE.MeshBasicMaterial({ color: 0x66c8ff });
  M.bookGlow = new THREE.MeshBasicMaterial({ color: 0xe8c070 });
  M.seekEye = new THREE.MeshBasicMaterial({ map: G.faceTex('seekeye'), transparent: true, depthWrite: false });
  M.painting = [0, 1, 2, 3, 4, 5].map(() => std(painting(), 0.8));

  GEO.doorPanel = new THREE.BoxGeometry(G.DW - 0.04, G.DH - 0.03, 0.07);
  GEO.knob = new THREE.SphereGeometry(0.045, 10, 8);
  GEO.plate = new THREE.PlaneGeometry(0.42, 0.16);
  GEO.padlock = new THREE.BoxGeometry(0.12, 0.14, 0.05);
  GEO.bulb = new THREE.SphereGeometry(0.09, 12, 8);
  GEO.shade = new THREE.ConeGeometry(0.32, 0.28, 16, 1, true);
  GEO.cord = new THREE.CylinderGeometry(0.01, 0.01, 1, 4);
  GEO.coin = new THREE.CylinderGeometry(0.05, 0.05, 0.012, 10);
  GEO.sphere = new THREE.SphereGeometry(1, 14, 10);
  GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
  GEO.box = new THREE.BoxGeometry(1, 1, 1);
  GEO.plane = new THREE.PlaneGeometry(1, 1);
};

/* ---------- 3D entity models ---------- */
const part = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (parent) parent.add(m); return m;
};
G.models = {
  seek() {
    const g = new THREE.Group();
    const goo = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.15, metalness: 0.2 });
    const eyeW = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), eyeB = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const body = new THREE.Group(); g.add(body);
    part(GEO.sphere, goo, 0, 1.55, 0, 0.36, 0.62, 0.3, body);
    part(GEO.sphere, goo, 0, 2.3, 0, 0.3, 0.36, 0.3, body);
    part(GEO.sphere, eyeW, 0, 2.32, 0.24, 0.15, 0.1, 0.08, body);
    part(GEO.sphere, eyeB, 0, 2.32, 0.31, 0.055, 0.055, 0.03, body);
    const limbs = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(s * 0.38, 1.95, 0); body.add(arm);
      part(GEO.sphere, goo, 0, -0.55, 0, 0.09, 0.6, 0.09, arm);
      const leg = new THREE.Group(); leg.position.set(s * 0.17, 1.0, 0); g.add(leg);
      part(GEO.sphere, goo, 0, -0.5, 0, 0.11, 0.55, 0.11, leg);
      limbs.push(arm, leg);
    }
    for (let i = 0; i < 6; i++) part(GEO.sphere, goo, G.rand(-0.3, 0.3), G.rand(0.6, 2), G.rand(-0.2, 0.2), 0.06, 0.18, 0.06, body);
    g.userData = { body, limbs };
    return g;
  },
  figure() {
    const g = new THREE.Group();
    const flesh = new THREE.MeshStandardMaterial({ color: 0x7a2a1e, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a0e0a, roughness: 0.6 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xe0d4bc, roughness: 0.5 });
    const body = new THREE.Group(); g.add(body);
    part(GEO.sphere, flesh, 0, 1.95, 0, 0.34, 0.6, 0.22, body);
    part(GEO.sphere, dark, 0, 1.4, 0, 0.26, 0.25, 0.18, body);
    const head = new THREE.Group(); head.position.set(0, 2.75, 0.05); body.add(head);
    part(GEO.sphere, flesh, 0, 0, 0, 0.28, 0.42, 0.26, head);
    part(GEO.sphere, dark, 0, -0.04, 0.12, 0.18, 0.3, 0.16, head);
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.17 - Math.abs(i - 2.5) * 0.015, 0.016, 4, 12, Math.PI), bone);
      t.position.set(0, 0.2 - i * 0.075, 0.16); t.rotation.set(0, 0, Math.PI); head.add(t);
    }
    const limbs = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(s * 0.4, 2.35, 0); body.add(arm);
      part(GEO.sphere, flesh, 0, -0.65, 0, 0.08, 0.7, 0.08, arm);
      part(GEO.sphere, dark, 0, -1.35, 0.03, 0.09, 0.14, 0.05, arm);
      const leg = new THREE.Group(); leg.position.set(s * 0.18, 1.3, 0); g.add(leg);
      part(GEO.sphere, flesh, 0, -0.65, 0, 0.1, 0.68, 0.1, leg);
      limbs.push(arm, leg);
    }
    g.userData = { body, limbs, head };
    return g;
  },
  grumble() {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 0.7 });
    const belly = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.8 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd040 });
    const tooth = new THREE.MeshStandardMaterial({ color: 0xe8dca0 });
    const segs = [];
    for (let i = 0; i < 5; i++) { const s = part(GEO.sphere, i ? skin : belly, 0, 1.2 - i * 0.05, -i * 0.9, 1.0 - i * 0.12, 0.95 - i * 0.12, 0.7, g); segs.push(s); }
    part(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0x080404 }), 0, 1.0, 0.55, 0.6, 0.45, 0.2, g);
    for (let i = 0; i < 8; i++) { const a = Math.PI + i / 7 * Math.PI; const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 5), tooth); t.position.set(Math.cos(a) * 0.5, 1.0 + 0.3 + Math.sin(a) * 0.05, 0.62); t.rotation.z = Math.PI; g.add(t); }
    for (const s of [-1, 1]) part(GEO.sphere, glow, s * 0.45, 1.75, 0.45, 0.08, 0.06, 0.05, g);
    g.userData = { segs };
    return g;
  },
  monument() {
    const g = new THREE.Group();
    const st = new THREE.MeshStandardMaterial({ color: 0xcfcbc2, roughness: 0.75 });
    part(GEO.box, st, 0, 0.15, 0, 0.9, 0.3, 0.9, g);
    part(GEO.sphere, st, 0, 1.2, 0, 0.35, 0.8, 0.25, g);
    part(GEO.sphere, st, 0, 2.25, 0, 0.24, 0.3, 0.24, g);
    const blk = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (const s of [-1, 1]) {
      part(GEO.sphere, blk, s * 0.09, 2.3, 0.2, 0.05, 0.08, 0.03, g);
      const arm = part(GEO.sphere, st, s * 0.4, 1.3, 0.15, 0.08, 0.6, 0.08, g); arm.rotation.x = -0.6;
    }
    return g;
  },
  giggle() {
    const g = new THREE.Group();
    const blk = new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.3 });
    part(GEO.sphere, blk, 0, 0, 0, 0.32, 0.26, 0.32, g);
    const teeth = new THREE.MeshBasicMaterial({ color: 0xffffff });
    part(GEO.box, teeth, 0, -0.14, 0.2, 0.36, 0.06, 0.08, g);
    for (let i = 0; i < 6; i++) { const l = part(GEO.sphere, blk, Math.cos(i) * 0.3, -0.05, Math.sin(i) * 0.3, 0.03, 0.3, 0.03, g); l.rotation.z = Math.cos(i) * 0.8; l.rotation.x = Math.sin(i) * 0.8; }
    return g;
  },
};
})();
