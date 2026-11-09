// Textures: small procedural canvas textures (studs, bricks, ice, lava...) and cached materials.
(() => {
'use strict';
const texCache = {}, matCache = {};
function canvas(n = 64) { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d')]; }
function rgb(n) { return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(n, f) {
  let [r, g, b] = rgb(n);
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function speckle(k, n, amt, count) {
  for (let i = 0; i < (count || n * n / 6); i++) {
    k.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${Math.random() * amt})` : `rgba(255,255,255,${Math.random() * amt})`;
    k.fillRect(Math.random() * n | 0, Math.random() * n | 0, 2, 2);
  }
}
const PAINT = {
  studs(k, n, c) {
    k.fillStyle = shade(c, 0); k.fillRect(0, 0, n, n); speckle(k, n, 0.06);
    for (const [x, y] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      k.fillStyle = shade(c, -0.18); k.beginPath(); k.arc(x * n + 1.5, y * n + 2, n * 0.14, 0, 7); k.fill();
      k.fillStyle = shade(c, 0.1); k.beginPath(); k.arc(x * n, y * n, n * 0.14, 0, 7); k.fill();
      k.fillStyle = shade(c, 0.28); k.beginPath(); k.arc(x * n - 2, y * n - 2, n * 0.05, 0, 7); k.fill();
    }
    k.strokeStyle = shade(c, -0.12); k.lineWidth = 2; k.strokeRect(1, 1, n - 2, n - 2);
  },
  plain(k, n, c) { k.fillStyle = shade(c, 0); k.fillRect(0, 0, n, n); speckle(k, n, 0.1, n * n / 3); },
  brick(k, n, c) {
    k.fillStyle = shade(c, -0.4); k.fillRect(0, 0, n, n);
    const rows = 4, h = n / rows;
    for (let r = 0; r < rows; r++) for (let i = -1; i < 3; i++) {
      const x = i * n / 2 + (r % 2 ? n / 4 : 0);
      k.fillStyle = shade(c, G.rand(-0.1, 0.1)); k.fillRect(x + 2, r * h + 2, n / 2 - 4, h - 4);
    }
    speckle(k, n, 0.08);
  },
  plank(k, n, c) {
    for (let i = 0; i < 4; i++) {
      k.fillStyle = shade(c, G.rand(-0.1, 0.08)); k.fillRect(0, i * n / 4, n, n / 4);
      k.fillStyle = shade(c, -0.35); k.fillRect(0, i * n / 4, n, 2);
      k.fillStyle = shade(c, -0.15);
      for (let j = 0; j < 3; j++) k.fillRect(Math.random() * n, i * n / 4 + 4 + Math.random() * (n / 4 - 8), G.rand(8, 22), 1);
    }
  },
  stripe(k, n, c, c2) {
    k.fillStyle = shade(c, 0); k.fillRect(0, 0, n, n);
    k.fillStyle = shade(c2, 0);
    for (let i = -2; i < 4; i++) { k.beginPath(); k.moveTo(i * n / 2, 0); k.lineTo(i * n / 2 + n / 4, 0); k.lineTo(i * n / 2 + n / 4 + n, n); k.lineTo(i * n / 2 + n, n); k.fill(); }
    speckle(k, n, 0.05);
  },
  tile(k, n, c) {
    k.fillStyle = shade(c, -0.2); k.fillRect(0, 0, n, n);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { k.fillStyle = shade(c, G.rand(-0.04, 0.06)); k.fillRect(x * n / 2 + 1, y * n / 2 + 1, n / 2 - 2, n / 2 - 2); }
    speckle(k, n, 0.04);
  },
  grass(k, n, c) {
    k.fillStyle = shade(c, 0); k.fillRect(0, 0, n, n);
    for (let i = 0; i < 160; i++) { k.fillStyle = shade(c, G.rand(-0.22, 0.18)); k.fillRect(Math.random() * n, Math.random() * n, 2, G.rand(2, 5)); }
  },
  snow(k, n, c) {
    k.fillStyle = shade(c, 0); k.fillRect(0, 0, n, n);
    for (let i = 0; i < 90; i++) { k.fillStyle = `rgba(120,160,220,${Math.random() * 0.18})`; k.fillRect(Math.random() * n, Math.random() * n, 3, 3); }
  },
  ice(k, n, c) {
    const g = k.createLinearGradient(0, 0, n, n); g.addColorStop(0, shade(c, 0.25)); g.addColorStop(1, shade(c, -0.05));
    k.fillStyle = g; k.fillRect(0, 0, n, n);
    k.strokeStyle = 'rgba(255,255,255,0.55)'; k.lineWidth = 1;
    for (let i = 0; i < 5; i++) { k.beginPath(); let x = Math.random() * n, y = Math.random() * n; k.moveTo(x, y); for (let j = 0; j < 3; j++) { x += G.rand(-14, 14); y += G.rand(-14, 14); k.lineTo(x, y); } k.stroke(); }
  },
  lava(k, n) {
    k.fillStyle = '#c22a06'; k.fillRect(0, 0, n, n);
    for (let i = 0; i < 26; i++) { const r = G.rand(3, 9); const g = k.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, '#ffe066'); g.addColorStop(0.5, '#ff8a1c'); g.addColorStop(1, 'rgba(255,90,0,0)');
      const x = Math.random() * n, y = Math.random() * n;
      for (const [ox, oy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) { k.save(); k.translate(x + ox, y + oy); k.fillStyle = g; k.beginPath(); k.arc(0, 0, r, 0, 7); k.fill(); k.restore(); } }
  },
  stone(k, n, c) {
    k.fillStyle = shade(c, -0.35); k.fillRect(0, 0, n, n);
    const s = n / 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      if ((x + y) % 3 === 0 && Math.random() < 0.5) continue;
      k.fillStyle = shade(c, G.rand(-0.12, 0.1));
      const ox = G.rand(1, 3), oy = G.rand(1, 3);
      k.beginPath(); k.roundRect ? k.roundRect(x * s + ox, y * s + oy, s - 3, s - 3, 3) : k.rect(x * s + ox, y * s + oy, s - 3, s - 3); k.fill();
    }
    speckle(k, n, 0.08);
  },
  hedge(k, n, c) {
    k.fillStyle = shade(c, -0.2); k.fillRect(0, 0, n, n);
    for (let i = 0; i < 140; i++) { k.fillStyle = shade(c, G.rand(-0.3, 0.25)); k.beginPath(); k.arc(Math.random() * n, Math.random() * n, G.rand(1.5, 4), 0, 7); k.fill(); }
  },
  metal(k, n, c) {
    k.fillStyle = shade(c, 0); k.fillRect(0, 0, n, n); speckle(k, n, 0.05);
    k.strokeStyle = shade(c, -0.3); k.lineWidth = 2; k.strokeRect(2, 2, n - 4, n - 4);
    k.fillStyle = shade(c, 0.3); for (const [x, y] of [[7, 7], [n - 7, 7], [7, n - 7], [n - 7, n - 7]]) { k.beginPath(); k.arc(x, y, 2.5, 0, 7); k.fill(); }
  }
};
G.tex = (kind, c = 0xffffff, c2 = 0x000000) => {
  const key = kind + c + '|' + c2;
  if (texCache[key]) return texCache[key];
  const [cv, k] = canvas(64);
  PAINT[kind](k, 64, c, c2);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[key] = t);
};
G.mat = (kind, c, o = {}) => {
  const key = kind + c + '|' + (o.c2 || 0) + '|' + (o.emissive || 0);
  if (matCache[key]) return matCache[key];
  let m;
  if (kind === 'lava') {
    const t = G.tex('lava').clone(); t.needsUpdate = true;
    m = new THREE.MeshBasicMaterial({ map: t, color: 0xffffff });
    m.userData.flow = t;
  } else {
    m = new THREE.MeshLambertMaterial({ map: G.tex(kind, c, o.c2) });
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei || 0.6; }
  }
  return (matCache[key] = m);
};
G.lavaMats = () => Object.values(matCache).filter(m => m.userData.flow);

// Box geometry whose UVs tile once every `tile` units on every face.
G.boxGeo = (w, h, d, tile = 2) => {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i; uv.setXY(k, uv.getX(k) * spans[f][0] / tile, uv.getY(k) * spans[f][1] / tile);
  }
  return g;
};
G.skyTex = (top, bottom) => {
  const [c, k] = canvas(8); c.height = 256;
  const g = k.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#' + top.toString(16).padStart(6, '0')); g.addColorStop(0.55, '#' + bottom.toString(16).padStart(6, '0')); g.addColorStop(1, '#' + bottom.toString(16).padStart(6, '0'));
  k.fillStyle = g; k.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
G.glowTex = (() => { let t = null; return () => {
  if (t) return t;
  const [c, k] = canvas(64); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  k.fillStyle = g; k.fillRect(0, 0, 64, 64);
  t = new THREE.CanvasTexture(c); return t;
}; })();
G.emojiTex = (emoji, bg) => {
  const key = 'emoji' + emoji + bg; if (texCache[key]) return texCache[key];
  const [c, k] = canvas(128);
  k.fillStyle = bg; k.beginPath(); k.roundRect ? k.roundRect(4, 4, 120, 120, 22) : k.rect(4, 4, 120, 120); k.fill();
  k.strokeStyle = 'rgba(255,255,255,0.8)'; k.lineWidth = 6; k.stroke();
  k.font = '76px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle';
  k.fillText(emoji, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[key] = t);
};
})();
