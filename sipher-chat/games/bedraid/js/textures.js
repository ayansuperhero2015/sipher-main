// Textures: every block face is original 16x16 pixel art painted onto one atlas canvas.
(() => {
'use strict';
const T = 16, COLS = 8;
const cv = document.createElement('canvas'); cv.width = cv.height = T * COLS;
const cx = cv.getContext('2d');
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const tiles = {}; let next = 0;
const hex = (c, k = 1) => { const r = ((c >> 16) & 255) * k, g = ((c >> 8) & 255) * k, b = (c & 255) * k; return `rgb(${G.clamp(r, 0, 255) | 0},${G.clamp(g, 0, 255) | 0},${G.clamp(b, 0, 255) | 0})`; };
function tile(name, paint) {
  const i = next++, x0 = (i % COLS) * T, y0 = Math.floor(i / COLS) * T;
  seed = 1000 + i * 77;
  const px = (x, y, c) => { cx.fillStyle = c; cx.fillRect(x0 + x, y0 + y, 1, 1); };
  paint(px);
  tiles[name] = i;
}
const speck = (base, amt) => px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, hex(base, 1 + (rnd() - 0.5) * amt)); };

tile('grass_top', px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const r = rnd(); px(x, y, hex(r < 0.12 ? 0x6fd14a : r > 0.9 ? 0x3f9a2a : 0x56b83a, 1 + (rnd() - 0.5) * 0.12)); } });
tile('dirt', speck(0x8a5a35, 0.35));
tile('grass_side', px => {
  speck(0x8a5a35, 0.35)(px);
  for (let x = 0; x < T; x++) { const h = 3 + Math.floor(rnd() * 3); for (let y = 0; y < h; y++) px(x, y, hex(0x56b83a, 1 + (rnd() - 0.5) * 0.15)); }
});
tile('stone', px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const r = rnd(); px(x, y, hex(0x8c8f94, r < 0.15 ? 0.82 : r > 0.92 ? 1.12 : 1 + (rnd() - 0.5) * 0.08)); } });
tile('planks', px => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const row = Math.floor(y / 4), seam = y % 4 === 3, joint = (x + row * 5) % 16 === 0;
    px(x, y, seam || joint ? hex(0x7a5126) : hex(0xb98a4e, 1 + (rnd() - 0.5) * 0.12 + Math.sin(x * 0.9 + row) * 0.04));
  }
});
tile('log_side', px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, hex(x % 4 === 0 ? 0x4e3416 : 0x6e4a22, 1 + (rnd() - 0.5) * 0.2)); });
tile('log_top', px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); px(x, y, d > 6.5 ? hex(0x5a3c1a) : hex(Math.floor(d) % 2 ? 0xb08a52 : 0x9a7442, 1 + (rnd() - 0.5) * 0.1)); } });
tile('leaves', px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const r = rnd(); px(x, y, r < 0.18 ? 'rgba(0,0,0,0)' : hex(0x3c9a30, 0.75 + rnd() * 0.45)); } });
tile('chalk', px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const r = rnd(); px(x, y, hex(0xe8e2b0, r < 0.1 ? 0.86 : r > 0.95 ? 0.78 : 1 + (rnd() - 0.5) * 0.06)); } });
tile('obsidian', px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const r = rnd(); px(x, y, r < 0.08 ? hex(0x5b3a8a) : hex(0x1c1626, 1 + (rnd() - 0.5) * 0.5)); } });
tile('glass', px => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const edge = x === 0 || y === 0 || x === 15 || y === 15, shine = (x - y === 3 || x - y === 4) && x > 3 && x < 11;
    px(x, y, edge ? 'rgba(220,240,255,0.95)' : shine ? 'rgba(255,255,255,0.7)' : 'rgba(190,225,255,0.18)');
  }
});
tile('clay', px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, hex(0xb36a4a, 1 + (rnd() - 0.5) * 0.08)); });
for (const t of G.TEAMS) {
  tile('wool' + t.id, px => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const weave = ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) ? 0.9 : 1;
      px(x, y, hex(t.color, weave * (1 + (rnd() - 0.5) * 0.12)));
    }
  });
}
tile('islandstone', px => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const r = rnd(); px(x, y, hex(0x4a4f5c, r < 0.2 ? 0.8 : 1 + (rnd() - 0.5) * 0.12)); } });
tile('pad', px => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const edge = x < 1 || y < 1 || x > 14 || y > 14, inner = x > 3 && x < 12 && y > 3 && y < 12;
    px(x, y, edge ? hex(0x2d3038) : inner ? hex(0x9aa3b5, 1 + (rnd() - 0.5) * 0.08) : hex(0x6e7585, 1 + (rnd() - 0.5) * 0.1));
  }
});
tile('brick', px => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const row = Math.floor(y / 4), mortar = y % 4 === 0 || (x + (row % 2) * 4) % 8 === 0;
    px(x, y, mortar ? hex(0xbdb6a8) : hex(0x9c4a3a, 1 + (rnd() - 0.5) * 0.15));
  }
});
tile('snow', speck(0xf2f6fb, 0.06));
tile('sand', speck(0xdcc98c, 0.12));
tile('bedside', speck(0x7a4b2a, 0.2));
// breaking cracks, 6 stages
for (let s = 0; s < 6; s++) {
  tile('crack' + s, px => {
    seed = 999;
    const n = 8 + s * 10;
    for (let k = 0; k < n; k++) {
      let x = 7 + Math.floor((rnd() - 0.5) * (4 + s * 2)), y = 7 + Math.floor((rnd() - 0.5) * (4 + s * 2));
      for (let j = 0; j < 3 + s; j++) { px(G.clamp(x, 0, 15), G.clamp(y, 0, 15), 'rgba(0,0,0,0.75)'); x += Math.round(rnd() * 2 - 1); y += Math.round(rnd() * 2 - 1); }
    }
  });
}

// Bevel: lighter top/left edge, darker bottom/right edge, so every block reads as a solid toy brick.
function bevel(name, k = 1) {
  const i = tiles[name], x0 = (i % COLS) * T, y0 = Math.floor(i / COLS) * T;
  const img = cx.getImageData(x0, y0, T, T), d = img.data;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let f = 1;
    if (y === 0 || x === 0) f = 1 + 0.16 * k; else if (y === 1 || x === 1) f = 1 + 0.06 * k;
    if (y === T - 1 || x === T - 1) f = 1 - 0.26 * k; else if (y === T - 2 || x === T - 2) f = 1 - 0.1 * k;
    const p = (y * T + x) * 4;
    for (let c = 0; c < 3; c++) d[p + c] = G.clamp(d[p + c] * f, 0, 255);
  }
  cx.putImageData(img, x0, y0);
}
for (const n of ['stone', 'planks', 'chalk', 'obsidian', 'clay', 'islandstone', 'brick', 'pad', 'log_top']) bevel(n);
for (const t of G.TEAMS) bevel('wool' + t.id, 0.8);
bevel('grass_top', 0.35); bevel('grass_side', 0.35); bevel('dirt', 0.35);

const tex = new THREE.CanvasTexture(cv);
tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
tex.colorSpace = THREE.SRGBColorSpace;
G.atlas = { canvas: cv, tex, tiles, COLS, T,
  uv(name) { const i = tiles[name], u = (i % COLS) / COLS, v = 1 - (Math.floor(i / COLS) + 1) / COLS; return [u, v, u + 1 / COLS, v + 1 / COLS]; },
  // A small standalone canvas of one tile (for UI icons).
  icon(name, size = 32) {
    const c = document.createElement('canvas'); c.width = c.height = size; const k = c.getContext('2d'); k.imageSmoothingEnabled = false;
    const i = tiles[name]; k.drawImage(cv, (i % COLS) * T, Math.floor(i / COLS) * T, T, T, 0, 0, size, size); return c;
  }
};
})();
