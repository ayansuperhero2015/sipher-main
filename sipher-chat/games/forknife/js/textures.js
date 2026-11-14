// Textures: everything is painted on canvases at boot.
(() => {
'use strict';
const mk = (w, h, fn, rep) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const speck = (k, w, h, n, col, s = 2) => { k.fillStyle = col; for (let i = 0; i < n; i++) k.fillRect(Math.random() * w, Math.random() * h, s, s); };
G.tex = {};
G.initTextures = () => {
  const T = G.tex;
  T.wood = mk(128, 128, (k, w, h) => {
    const cols = ['#c9975a', '#bf8c50', '#d0a064', '#b98548'];
    for (let i = 0; i < 4; i++) { k.fillStyle = cols[i]; k.fillRect(i * 32, 0, 32, h); k.fillStyle = 'rgba(70,40,10,0.45)'; k.fillRect(i * 32, 0, 2, h); }
    speck(k, w, h, 220, 'rgba(90,55,20,0.18)', 3);
    k.strokeStyle = '#8a5a2b'; k.lineWidth = 12; k.strokeRect(6, 6, w - 12, h - 12);
    k.lineWidth = 9; k.beginPath(); k.moveTo(8, h - 8); k.lineTo(w - 8, 8); k.stroke();
    k.fillStyle = '#5b3a18'; for (const [x, y] of [[10, 10], [w - 14, 10], [10, h - 14], [w - 14, h - 14]]) k.fillRect(x, y, 4, 4);
  });
  T.brick = mk(128, 128, (k, w, h) => {
    k.fillStyle = '#d9c9b8'; k.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
      const x = c * 32 + (r % 2) * 16, y = r * 16;
      k.fillStyle = ['#b9513d', '#c45c46', '#ad4936', '#cc6650'][(r * 3 + c + 8) % 4]; k.fillRect(x + 1, y + 1, 30, 14);
    }
    speck(k, w, h, 160, 'rgba(60,20,10,0.15)', 2);
    k.strokeStyle = '#8f8478'; k.lineWidth = 8; k.strokeRect(4, 4, w - 8, h - 8);
  });
  T.metal = mk(128, 128, (k, w, h) => {
    const g = k.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#b7c6d1'); g.addColorStop(0.5, '#8fa1ae'); g.addColorStop(1, '#a9b9c5');
    k.fillStyle = g; k.fillRect(0, 0, w, h);
    k.strokeStyle = 'rgba(40,55,70,0.5)'; k.lineWidth = 2; k.strokeRect(1, 1, 62, 62); k.strokeRect(65, 1, 62, 62); k.strokeRect(1, 65, 62, 62); k.strokeRect(65, 65, 62, 62);
    k.strokeStyle = '#5f6f7c'; k.lineWidth = 10; k.strokeRect(5, 5, w - 10, h - 10);
    k.fillStyle = '#e8f1f7'; for (const [x, y] of [[9, 9], [w - 13, 9], [9, h - 13], [w - 13, h - 13], [62, 9], [62, h - 13], [9, 62], [w - 13, 62]]) k.fillRect(x, y, 4, 4);
  });
  T.steel = mk(128, 128, (k, w, h) => {
    k.fillStyle = '#47525e'; k.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { k.fillStyle = i % 2 ? '#3d4853' : '#515d6a'; k.fillRect(i * 16, 0, 14, h); }
    k.strokeStyle = '#ffc928'; k.lineWidth = 6; k.strokeRect(3, 3, w - 6, h - 6);
  });
  T.crate = mk(64, 64, (k, w, h) => {
    k.fillStyle = '#a9773c'; k.fillRect(0, 0, w, h);
    k.strokeStyle = '#6e4a22'; k.lineWidth = 6; k.strokeRect(3, 3, w - 6, h - 6);
    k.lineWidth = 5; k.beginPath(); k.moveTo(5, 5); k.lineTo(w - 5, h - 5); k.moveTo(w - 5, 5); k.lineTo(5, h - 5); k.stroke();
  });
  T.container = mk(64, 64, (k, w, h) => {
    k.fillStyle = '#ffffff'; k.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { k.fillStyle = i % 2 ? '#d5d5d5' : '#f4f4f4'; k.fillRect(i * 8, 0, 8, h); }
    k.strokeStyle = '#9a9a9a'; k.lineWidth = 4; k.strokeRect(2, 2, w - 4, h - 4);
  });
  T.concrete = mk(64, 64, (k, w, h) => { k.fillStyle = '#9aa0a6'; k.fillRect(0, 0, w, h); speck(k, w, h, 200, 'rgba(0,0,0,0.08)', 2); k.strokeStyle = '#7d8389'; k.lineWidth = 4; k.strokeRect(2, 2, w - 4, h - 4); });
  // arena floor: one tile = one build cell
  T.grid = mk(128, 128, (k, w, h) => {
    k.fillStyle = '#ffffff'; k.fillRect(0, 0, w, h);
    speck(k, w, h, 260, 'rgba(0,0,0,0.05)', 3);
    k.strokeStyle = 'rgba(0,0,0,0.16)'; k.lineWidth = 3; k.strokeRect(0, 0, w, h);
  }, true);
  T.barrier = mk(64, 64, (k, w, h) => {
    k.clearRect(0, 0, w, h); k.strokeStyle = 'rgba(120,200,255,0.9)'; k.lineWidth = 2;
    k.beginPath(); k.moveTo(32, 2); k.lineTo(60, 17); k.lineTo(60, 47); k.lineTo(32, 62); k.lineTo(4, 47); k.lineTo(4, 17); k.closePath(); k.stroke();
  }, true);
  T.storm = mk(128, 128, (k, w, h) => {
    k.fillStyle = 'rgba(150,70,255,0.55)'; k.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { k.fillStyle = `rgba(${200 + Math.random() * 55},${120 + Math.random() * 80},255,${0.1 + Math.random() * 0.25})`; k.fillRect(Math.random() * w, 0, 2 + Math.random() * 6, h); }
  }, true);
  T.glow = mk(64, 64, (k, w, h) => {
    const g = k.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    k.fillStyle = g; k.fillRect(0, 0, w, h);
  });
};
G.skyTex = (top, bot) => mk(8, 256, (k, w, h) => {
  const g = k.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(0.5, bot); g.addColorStop(1, bot);
  k.fillStyle = g; k.fillRect(0, 0, w, h);
});
})();
