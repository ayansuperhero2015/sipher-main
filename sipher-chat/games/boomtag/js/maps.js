// Maps: five arenas, each with its own look, layout and gimmick.
(() => {
'use strict';
const lam = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
const basic = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o));

// ---------- shared props ----------
function tree(B, x, y, z, s = 1, leaf = 0x58b947) {
  B.box(x, y, z, 0.8 * s, 2.4 * s, 0.8 * s, G.mat('plank', 0x7a4f2c));
  B.box(x, y + 2.4 * s, z, 3.2 * s, 2 * s, 3.2 * s, G.mat('grass', leaf));
  B.box(x, y + 4.4 * s, z, 1.8 * s, 1 * s, 1.8 * s, G.mat('grass', leaf), { collide: false });
}
function pine(B, x, y, z, s = 1) {
  B.box(x, y, z, 0.7 * s, 1.6 * s, 0.7 * s, G.mat('plank', 0x6b4426));
  const g = lam(0x2f7a4a), snow = lam(0xf4f8ff);
  for (let i = 0; i < 3; i++) {
    const r = (1.9 - i * 0.5) * s, h = 1.9 * s, yy = y + 1.5 * s + i * 1.15 * s;
    B.mesh(new THREE.ConeGeometry(r, h, 7), g, x, yy + h / 2, z);
    B.mesh(new THREE.ConeGeometry(r * 0.45, h * 0.35, 7), snow, x, yy + h * 0.9, z);
  }
}
function lollipop(B, x, y, z, color) {
  B.box(x, y, z, 0.3, 3.2, 0.3, G.mat('plain', 0xffffff));
  const disc = B.mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.35, 28), lam(0xffffff, { map: G.tex('stripe', 0xffffff, color) }), x, y + 3.9, z);
  disc.rotation.x = Math.PI / 2;
  const ph = Math.random() * 6;
  B.update(t => { disc.rotation.y = Math.sin(t * 0.8 + ph) * 0.4; });
}
function torch(B, x, y, z) {
  B.box(x, y, z, 0.45, 2.2, 0.45, G.mat('stone', 0x5a5450));
  const flame = B.mesh(new THREE.ConeGeometry(0.28, 0.7, 6), basic(0xffa020), x, y + 2.55, z, false);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex(), color: 0xff7a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(2.4, 2.4, 1); glow.position.set(x, y + 2.6, z); B.deco(glow);
  const ph = Math.random() * 6;
  B.update(t => { const f = 1 + Math.sin(t * 13 + ph) * 0.12 + Math.sin(t * 7.3 + ph) * 0.08; flame.scale.set(f, f * 1.1, f); glow.material.opacity = 0.6 + (f - 1) * 2; });
}
function pumpkin(B, x, y, z, s = 1) {
  B.box(x, y, z, 1.2 * s, 0.9 * s, 1.2 * s, null);
  const p = B.mesh(new THREE.SphereGeometry(0.65 * s, 12, 8), lam(0xff7a1a, { emissive: 0x401000 }), x, y + 0.45 * s, z);
  p.scale.y = 0.75;
  B.mesh(new THREE.CylinderGeometry(0.07 * s, 0.09 * s, 0.25 * s, 6), lam(0x3d6b22), x, y + 0.95 * s, z);
  const face = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex(), color: 0xffb030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  face.scale.set(1.8 * s, 1.8 * s, 1); face.position.set(x, y + 0.5 * s, z); B.deco(face);
  const ph = Math.random() * 6;
  B.update(t => { face.material.opacity = 0.55 + Math.sin(t * 6 + ph) * 0.15; });
}
function crate(B, x, y, z, s = 1.2) { B.box(x, y, z, s, s, s, G.mat('plank', 0xb5834a), { tile: s }); }
function grave(B, x, y, z) {
  B.box(x, y, z, 1.1, 1.2, 0.35, G.mat('stone', 0x8a8a96));
  B.mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12, 1, false, 0, Math.PI), G.mat('stone', 0x8a8a96), x, y + 1.2, z).rotation.set(Math.PI / 2, 0, Math.PI / 2);
}

G.MAPS = [
// ===================================================================== CANDY PLAZA
{ id: 'candy', name: 'Candy Plaza', desc: 'Open plaza. Jump pads launch you onto the tower bridges.',
  thumb: [[26, 15, 30], [0, 1, 0]],
  sky: [0x6cc4ff, 0xffd9ee], fog: [0xffd9ee, 50, 150], sun: [0xffffff, 2.2], hemi: [0xffffff, 0xffb3d1, 1.4],
  bounds: { minX: -31, maxX: 31, minZ: -31, maxZ: 31 },
  build(B) {
    const pink = G.mat('studs', 0xffb3d1), mint = G.mat('studs', 0x9ff0cf), cream = G.mat('tile', 0xfff2d6), choc = G.mat('brick', 0x7a4528),
      stripe = G.mat('stripe', 0xffffff, { c2: 0xff5c8a }), lemon = G.mat('studs', 0xfff07a), berry = G.mat('studs', 0xc38bff), sky = G.mat('studs', 0x8fd3ff);
    B.box(0, -1, 0, 64, 1, 64, pink, { tile: 4 });
    for (const s of [-1, 1]) { B.box(0, 0, s * 31.5, 64, 3, 1, stripe); B.box(s * 31.5, 0, 0, 1, 3, 62, stripe); }
    // centre mound and fountain
    B.box(0, 0, 0, 16, 0.5, 16, mint); B.box(0, 0, 0, 13, 1, 13, mint); B.box(0, 0, 0, 10, 1.5, 10, cream);
    B.box(0, 1.5, 0, 4, 0.8, 4, berry);
    B.mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 12), lam(0xffffff), 0, 3.4, 0);
    const water = B.mesh(new THREE.SphereGeometry(0.9, 16, 10), lam(0x7fd8ff, { transparent: true, opacity: 0.8, emissive: 0x1a4a6a }), 0, 4.8, 0);
    B.update(t => { water.scale.setScalar(1 + Math.sin(t * 3) * 0.08); water.position.y = 4.8 + Math.sin(t * 2) * 0.15; });
    // corner towers with stairs
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const tx = sx * 20, tz = sz * 20;
      B.box(tx, 0, tz, 7, 4, 7, choc);
      const inner = tx - sx * 3.5;
      for (let k = 1; k <= 7; k++) B.box(inner - sx * (8 - k - 0.5), 0, tz - sz * 2.5, 1, 0.5 * k, 2, cream);
      lollipop(B, tx + sx * 2, 4, tz + sz * 2, [0xff4f7b, 0x4fa8ff, 0x5ad66b, 0xffb020][(sx + 1) + (sz + 1) / 2]);
    }
    // sky bridges joining the towers
    for (const s of [-1, 1]) { B.box(0, 3.6, s * 20, 33, 0.4, 2.4, lemon); B.box(s * 20, 3.6, 0, 2.4, 0.4, 33, sky); }
    // gumdrop blocks
    const blocks = [[-10, -22, 2, 2, 2, lemon], [10, 22, 2, 2, 2, berry], [-25, 0, 3, 1, 3, sky], [25, 0, 3, 1, 3, lemon], [0, -25, 3, 1.5, 3, mint],
      [0, 25, 3, 1.5, 3, berry], [-12, 12, 2, 1, 2, sky], [12, -12, 2, 1, 2, mint], [13, 9, 1.5, 2.5, 1.5, lemon], [-13, -9, 1.5, 2.5, 1.5, berry],
      [-26, -12, 2, 2, 2, mint], [26, 12, 2, 2, 2, sky], [-7, -15, 4, 1, 1, lemon], [7, 15, 4, 1, 1, sky], [-26, 14, 2, 1.2, 2, berry], [26, -14, 2, 1.2, 2, lemon]];
    for (const [x, z, w, h, d, m] of blocks) B.box(x, 0, z, w, h, d, m);
    // jump pads that fling you onto the sky bridges
    B.pad(0, 0, -12, 0, -1, 19, 10, 0xff5c8a); B.pad(0, 0, 12, 0, 1, 19, 10, 0xff5c8a);
    B.pad(-12, 0, 0, -1, 0, 19, 10, 0xff5c8a); B.pad(12, 0, 0, 1, 0, 19, 10, 0xff5c8a);
    for (const [x, z, c] of [[-16, 6, 0x4fa8ff], [16, -6, 0xff4f7b], [6, 27, 0x5ad66b], [-6, -27, 0xffb020], [-27, -24, 0xc38bff], [27, 24, 0xff4f7b]]) lollipop(B, x, 0, z, c);
  } },

// ===================================================================== LAVA RUINS
{ id: 'lava', name: 'Lava Ruins', desc: 'Temple inside a lava moat. Touching lava throws you upward.',
  thumb: [[20, 14, 22], [0, 1, 0]],
  sky: [0x2a0e0a, 0xa8421c], fog: [0x6a2a14, 30, 110], sun: [0xffb070, 2.0], hemi: [0xffa070, 0x301010, 1.2],
  bounds: { minX: -31, maxX: 31, minZ: -31, maxZ: 31 },
  build(B) {
    const stone = G.mat('stone', 0x7a726c), dark = G.mat('brick', 0x544a46), sand = G.mat('plain', 0x9a8064), lava = G.mat('lava'),
      gold = G.mat('studs', 0xd9a441), obsid = G.mat('studs', 0x2e2638);
    B.box(0, -1, -22, 62, 1, 18, stone, { tile: 3 }); B.box(0, -1, 22, 62, 1, 18, stone, { tile: 3 });
    B.box(-22, -1, 0, 18, 1, 26, stone, { tile: 3 }); B.box(22, -1, 0, 18, 1, 26, stone, { tile: 3 });
    B.box(0, -2, 0, 26, 1.4, 26, lava, { type: 'lava', shadow: false, tile: 4 });
    B.box(0, -1, 0, 18, 1, 18, sand, { tile: 3 });
    for (const s of [-1, 1]) { B.box(0, -0.4, s * 11, 3, 0.4, 4.2, dark); B.box(s * 11, -0.4, 0, 4.2, 0.4, 3, dark); }
    for (const s of [-1, 1]) { B.box(s * 31.5, 0, 0, 1, 3.5, 64, dark); B.box(0, 0, s * 31.5, 64, 3.5, 1, dark); }
    // stepped temple
    B.box(0, 0, 0, 14, 0.5, 14, dark); B.box(0, 0, 0, 11, 1, 11, dark); B.box(0, 0, 0, 8, 1.5, 8, stone); B.box(0, 0, 0, 5, 2, 5, gold);
    for (const [x, z] of [[3.4, 3.4], [-3.4, 3.4], [3.4, -3.4], [-3.4, -3.4]]) B.box(x, 1.5, z, 0.8, 3.2, 0.8, stone);
    B.box(0, 4.7, 0, 8, 0.5, 8, obsid);
    for (const [x, z] of [[8.3, 8.3], [-8.3, 8.3], [8.3, -8.3], [-8.3, -8.3]]) torch(B, x, 0, z);
    // broken pillars and ruined walls
    for (const [x, z, h] of [[-20, -20, 4], [-16, -25, 2], [-25, -16, 3], [20, 20, 5], [25, 16, 2], [16, 25, 3], [20, -20, 1.5], [25, -25, 3.5], [-20, 20, 2.5], [-25, 25, 4], [-17, 17, 1], [17, -17, 1]])
      B.box(x, 0, z, 1.6, h, 1.6, G.chance(0.5) ? stone : dark);
    for (const [x, z, w, d, h] of [[-22, -7, 6, 1, 2.4], [22, 7, 6, 1, 2.4], [-7, -22, 1, 6, 2.2], [7, 22, 1, 6, 2.2], [-26, 6, 1, 5, 1.6], [26, -6, 1, 5, 1.6], [6, -26, 5, 1, 1.6], [-6, 26, 5, 1, 1.6]])
      B.box(x, 0, z, w, h, d, dark);
    for (const [x, z] of [[-22, 22], [22, -22], [-24, -2], [24, 2], [2, -24], [-2, 24]]) B.box(x, -0.02, z, 3, 0.08, 3, lava, { type: 'lava', shadow: false });
    for (const [x, z] of [[-14, -26], [14, 26], [-26, 13], [26, -13]]) { B.box(x, 0, z, 2, 1, 2, obsid); B.box(x, 1, z, 1, 1, 1, gold); }
    // rising embers
    const N = 120, pos = new Float32Array(N * 3), sp = [];
    for (let i = 0; i < N; i++) { pos[i * 3] = G.rand(-13, 13); pos[i * 3 + 1] = G.rand(-1, 8); pos[i * 3 + 2] = G.rand(-13, 13); sp.push(G.rand(0.6, 1.8)); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    B.deco(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffa040, size: 0.18, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    B.update((t, dt) => { for (let i = 0; i < N; i++) { pos[i * 3 + 1] += sp[i] * dt; if (pos[i * 3 + 1] > 9) pos[i * 3 + 1] = -0.8; } geo.attributes.position.needsUpdate = true; });
  } },

// ===================================================================== FROZEN RINK
{ id: 'frozen', name: 'Frozen Rink', desc: 'Ice rink in the middle. You keep sliding after you let go.',
  thumb: [[22, 13, 26], [0, 0, 0]],
  sky: [0x7fb4e8, 0xe8f4ff], fog: [0xe8f4ff, 35, 120], sun: [0xffffff, 2.0], hemi: [0xdfefff, 0x9ab4cc, 1.5],
  bounds: { minX: -31, maxX: 31, minZ: -31, maxZ: 31 },
  build(B) {
    const snow = G.mat('snow', 0xf2f7ff), ice = G.mat('ice', 0x9fd6ff), brick = G.mat('brick', 0xd6e4f2), red = G.mat('studs', 0xff5a5a), blue = G.mat('studs', 0x5aa8ff), wood = G.mat('plank', 0x8a5a34);
    B.box(0, -1, 0, 64, 1, 64, snow, { tile: 4 });
    for (const s of [-1, 1]) { B.box(0, 0, s * 31.5, 64, 3, 1, brick); B.box(s * 31.5, 0, 0, 1, 3, 62, brick); }
    // ice rink with low boards
    B.box(0, -0.02, 0, 30, 0.07, 20, ice, { type: 'ice', shadow: false, tile: 4 });
    for (const s of [-1, 1]) {
      B.box(-9.5, 0, s * 10.4, 11, 0.9, 0.5, s < 0 ? red : blue); B.box(9.5, 0, s * 10.4, 11, 0.9, 0.5, s < 0 ? red : blue);
      B.box(s * 15.25, 0, -6.5, 0.5, 0.9, 7, s < 0 ? red : blue); B.box(s * 15.25, 0, 6.5, 0.5, 0.9, 7, s < 0 ? red : blue);
    }
    // goal frames (deco)
    for (const s of [-1, 1]) {
      const f = lam(0xff3b3b);
      B.mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), f, s * 12.5, 0.6, -1.4); B.mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), f, s * 12.5, 0.6, 1.4);
      B.mesh(new THREE.BoxGeometry(0.15, 0.15, 2.95), f, s * 12.5, 1.2, 0);
    }
    // snow castles with stairs, north and south
    for (const s of [-1, 1]) {
      const cz = s * 21;
      B.box(0, 0, cz, 9, 3, 5, brick);
      for (const x of [-4, -1.5, 1, 3.5]) B.box(x + 0.25, 3, cz + s * 2.2, 1, 0.8, 0.6, brick);
      for (let k = 1; k <= 5; k++) { B.box(-4.5 - (6 - k) + 0.5, 0, cz, 1, 0.5 * k, 2.4, snow); B.box(4.5 + (6 - k) - 0.5, 0, cz, 1, 0.5 * k, 2.4, snow); }
      B.box(0, 0, cz - s * 3.2, 9, 0.4, 1.4, ice, { type: 'ice' });
    }
    // igloos
    for (const [x, z] of [[-22, -22], [22, 22], [-22, 22], [22, -22]]) {
      B.box(x, 0, z, 4.4, 2.2, 4.4, null);
      B.mesh(new THREE.SphereGeometry(2.7, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xf4f8ff, { map: G.tex('brick', 0xeaf2fb) }), x, 0, z);
      B.mesh(new THREE.BoxGeometry(1.4, 1.3, 1.4), lam(0x1d2a3a), x + (x < 0 ? 2.3 : -2.3), 0.65, z);
    }
    for (const [x, z] of [[-26, -8], [-26, 8], [26, -8], [26, 8], [-8, -27], [8, -27], [-8, 27], [8, 27], [-18, -13], [18, 13], [13, -17], [-13, 17], [-27, 0], [27, 0]])
      pine(B, x, 0, z, G.rand(0.9, 1.2));
    // snow forts
    for (const [x, z, w, d] of [[-20, -4, 4, 0.8], [20, 4, 4, 0.8], [-17, 6, 0.8, 4], [17, -6, 0.8, 4]]) B.box(x, 0, z, w, 1.4, d, snow);
    for (const [x, z] of [[-11, -15], [11, 15], [-24, -14], [24, 14]]) { B.box(x, 0, z, 2, 1, 2, wood); B.box(x, 1, z, 1.2, 0.6, 1.2, ice); }
    // falling snow
    const N = 700, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = G.rand(-35, 35); pos[i * 3 + 1] = G.rand(0, 30); pos[i * 3 + 2] = G.rand(-35, 35); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    B.deco(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.85, depthWrite: false })));
    B.update((t, dt) => { for (let i = 0; i < N; i++) { pos[i * 3 + 1] -= dt * 2.2; pos[i * 3] += Math.sin(t + i) * dt * 0.4; if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 30; } geo.attributes.position.needsUpdate = true; });
  } },

// ===================================================================== SKY ISLANDS
{ id: 'sky', name: 'Sky Islands', desc: 'Nine islands and narrow bridges. Fall and you respawn, still holding.',
  thumb: [[30, 9, 30], [0, -1, 0]],
  sky: [0x3d9cff, 0xcde9ff], fog: [0xcde9ff, 60, 180], sun: [0xfff4e0, 2.3], hemi: [0xffffff, 0x7a9ab0, 1.4],
  bounds: { minX: -32, maxX: 32, minZ: -32, maxZ: 32 }, walls: false, killY: -22,
  build(B) {
    const grass = G.mat('grass', 0x6fcf4f), dirt = G.mat('plain', 0x8a5a34), plank = G.mat('plank', 0xc89a5a), cloud = G.mat('plain', 0xffffff), stoneM = G.mat('stone', 0x9a9aa6);
    const rock = lam(0x7a6a5a);
    const island = (cx, cz, w, d) => {
      B.box(cx, -1, cz, w, 1, d, grass, { tile: 3 });
      B.box(cx, -3, cz, w - 0.6, 2, d - 0.6, dirt, { collide: false });
      const cone = B.mesh(new THREE.ConeGeometry(Math.min(w, d) * 0.62, 7, 7), rock, cx, -6.5, cz);
      cone.rotation.x = Math.PI;
    };
    island(0, 0, 18, 18);
    for (const [x, z] of [[24, 0], [-24, 0], [0, 24], [0, -24]]) island(x, z, 12, 12);
    for (const [x, z] of [[24, 24], [-24, 24], [24, -24], [-24, -24]]) island(x, z, 10, 10);
    const rail = lam(0x6b4426);
    const bridge = (cx, cz, w, d) => {
      B.box(cx, -0.4, cz, w, 0.4, d, plank, { tile: 1.5 });
      const along = w > d;
      for (const s of [-1, 1]) {
        const px = along ? 0 : s * (w / 2 - 0.1), pz = along ? s * (d / 2 - 0.1) : 0;
        B.mesh(new THREE.BoxGeometry(along ? w : 0.08, 0.08, along ? 0.08 : d), rail, cx + px, 0.9, cz + pz, false);
        const len = along ? w : d;
        for (let i = 0; i <= Math.floor(len / 3); i++) {
          const o = -len / 2 + i * (len / Math.floor(len / 3));
          B.mesh(new THREE.BoxGeometry(0.12, 1, 0.12), rail, cx + px + (along ? o : 0), 0.45, cz + pz + (along ? 0 : o), false);
        }
      }
    };
    bridge(13.5, 0, 9, 3); bridge(-13.5, 0, 9, 3); bridge(0, 13.5, 3, 9); bridge(0, -13.5, 3, 9);
    bridge(24, 12.5, 3, 13); bridge(24, -12.5, 3, 13); bridge(-24, 12.5, 3, 13); bridge(-24, -12.5, 3, 13);
    bridge(12.5, 24, 13, 3); bridge(-12.5, 24, 13, 3); bridge(12.5, -24, 13, 3); bridge(-12.5, -24, 13, 3);
    // centre hill, tree and the cloud platform above it
    B.box(0, 0, 0, 8, 0.5, 8, grass); B.box(0, 0, 0, 6, 1, 6, grass); B.box(0, 0, 0, 4, 1.5, 4, grass);
    tree(B, 0, 1.5, 0, 0.9, 0x4fb84a);
    B.box(0, 7.6, 0, 7, 0.4, 7, cloud);
    B.pad(0, 0, -6.6, 0, 1, 24, 7, 0x5cd6ff); B.pad(0, 0, 6.6, 0, -1, 24, 7, 0x5cd6ff);
    // props on the outer islands
    for (const [x, z] of [[26, 3], [-26, -3], [3, 26], [-3, -26]]) tree(B, x, 0, z, 0.8, G.pick([0x58b947, 0x7ccf4a, 0x4aa86a]));
    for (const [x, z] of [[21, -3], [-21, 3], [-3, 21], [3, -21], [26, 26], [-26, -26]]) crate(B, x, 0, z);
    for (const [x, z] of [[-26, 26], [26, -26]]) { B.box(x, 0, z, 2.5, 1, 2.5, stoneM); B.box(x, 1, z, 1.2, 1, 1.2, stoneM); }
    for (const [x, z] of [[22, 22], [-22, -22], [22, -22], [-22, 22]]) B.box(x, 0, z, 1.2, 1.8, 1.2, stoneM);
    // drifting clouds
    const cm = lam(0xffffff, { transparent: true, opacity: 0.9 });
    const clouds = [];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) { const m = new THREE.Mesh(new THREE.BoxGeometry(G.rand(3, 6), G.rand(1, 2), G.rand(3, 5)), cm); m.position.set(G.rand(-3, 3), G.rand(-0.5, 0.5), G.rand(-2, 2)); g.add(m); }
      g.position.set(G.rand(-70, 70), G.rand(-18, -8) + (i % 3 === 0 ? 30 : 0), G.rand(-70, 70)); B.deco(g); clouds.push(g);
    }
    B.update((t, dt) => { for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 80) c.position.x = -80; } });
  } },

// ===================================================================== HAUNTED MAZE
{ id: 'maze', name: 'Haunted Maze', desc: 'Hedge maze in fog. Corner teleporters swap you across the map.',
  thumb: [[9, 15, 13], [0, 0, 0]],
  sky: [0x0b0618, 0x2c1a4a], fog: [0x22143a, 10, 60], sun: [0xa8b8ff, 1.6], hemi: [0x7a6ab8, 0x2a1830, 1.5],
  bounds: { minX: -28.5, maxX: 28.5, minZ: -28.5, maxZ: 28.5 },
  build(B) {
    const N = 11, CS = 5, half = N * CS / 2, H = 3.2, T = 0.8;
    const rng = G.mulberry(4242);
    const hedge = G.mat('hedge', 0x34502e), dirt = G.mat('grass', 0x3a3a2a), stone = G.mat('stone', 0x6a6478);
    B.box(0, -1, 0, half * 2 + 4, 1, half * 2 + 4, dirt, { tile: 3 });
    // walls: h[j][i] = wall on z-line j above cell i; v[j][i] = wall on x-line i beside cell row j
    const h = [], v = [];
    for (let j = 0; j <= N; j++) { h.push(new Array(N).fill(true)); }
    for (let j = 0; j < N; j++) { v.push(new Array(N + 1).fill(true)); }
    const seen = new Array(N * N).fill(false), stack = [[0, 0]]; seen[0] = true;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => { const a = i + di, b = j + dj; return a >= 0 && b >= 0 && a < N && b < N && !seen[a + b * N]; });
      if (!opts.length) { stack.pop(); continue; }
      const [di, dj] = opts[Math.floor(rng() * opts.length)];
      const a = i + di, b = j + dj;
      if (di === 1) v[j][i + 1] = false; else if (di === -1) v[j][i] = false; else if (dj === 1) h[j + 1][i] = false; else h[j][i] = false;
      seen[a + b * N] = true; stack.push([a, b]);
    }
    // extra openings so there are loops to run around
    for (let j = 1; j < N; j++) for (let i = 0; i < N; i++) if (rng() < 0.28) h[j][i] = false;
    for (let j = 0; j < N; j++) for (let i = 1; i < N; i++) if (rng() < 0.28) v[j][i] = false;
    // open centre courtyard (3x3 cells)
    for (let j = 4; j <= 6; j++) for (let i = 4; i <= 6; i++) { if (j > 4) h[j][i] = false; if (i > 4) v[j][i] = false; }
    // build merged wall runs
    for (let j = 0; j <= N; j++) {
      let i = 0;
      while (i < N) {
        if (!h[j][i]) { i++; continue; }
        let k = i; while (k < N && h[j][k]) k++;
        const x0 = -half + i * CS, x1 = -half + k * CS;
        B.box((x0 + x1) / 2, 0, -half + j * CS, x1 - x0 + T, H, T, hedge);
        i = k;
      }
    }
    for (let i = 0; i <= N; i++) {
      let j = 0;
      while (j < N) {
        if (!v[j][i]) { j++; continue; }
        let k = j; while (k < N && v[k][i]) k++;
        const z0 = -half + j * CS, z1 = -half + k * CS;
        B.box(-half + i * CS, 0, (z0 + z1) / 2, T, H, z1 - z0 + T, hedge);
        j = k;
      }
    }
    const cc = (i) => -half + (i + 0.5) * CS;
    B.tele(cc(0), 0, cc(0), cc(N - 1), 0, cc(N - 1), 0xb36bff);
    B.tele(cc(N - 1), 0, cc(0), cc(0), 0, cc(N - 1), 0x4fffc0);
    // courtyard: cauldron on a stone dais
    B.box(0, 0, 0, 6, 0.5, 6, stone); B.box(0, 0.5, 0, 2, 1, 2, null);
    B.mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.1, 14), lam(0x1a1a22), 0, 1.05, 0);
    const brew = B.mesh(new THREE.CircleGeometry(0.95, 16), basic(0x6aff4a), 0, 1.58, 0, false); brew.rotation.x = -Math.PI / 2;
    const bglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex(), color: 0x6aff4a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    bglow.scale.set(4, 4, 1); bglow.position.set(0, 2, 0); B.deco(bglow);
    B.update(t => { bglow.material.opacity = 0.5 + Math.sin(t * 4) * 0.2; });
    // pumpkins, graves, floating ghosts
    for (let n = 0; n < 14; n++) {
      const i = Math.floor(rng() * N), j = Math.floor(rng() * N);
      if (i >= 4 && i <= 6 && j >= 4 && j <= 6) continue;
      if ((i === 0 || i === N - 1) && (j === 0 || j === N - 1)) continue;
      const x = cc(i) + (rng() - 0.5) * 2.4, z = cc(j) + (rng() - 0.5) * 2.4;
      if (n % 2) pumpkin(B, x, 0, z, 0.8 + rng() * 0.4); else grave(B, x, 0, z);
    }
    const gm = lam(0xffffff, { transparent: true, opacity: 0.55, emissive: 0x8888aa });
    for (let n = 0; n < 6; n++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), gm); g.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1, 12, 1, true), gm); tail.rotation.x = Math.PI; tail.position.y = -0.5; g.add(tail);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), basic(0x111111)); e.position.set(s * 0.2, 0.2, 0.52); g.add(e); }
      B.deco(g);
      const r = G.rand(8, 24), sp = G.rand(0.15, 0.35) * (n % 2 ? 1 : -1), ph = n;
      B.update(t => { const a = t * sp + ph; g.position.set(Math.cos(a) * r, 4.5 + Math.sin(t * 2 + ph) * 0.4, Math.sin(a) * r); g.rotation.y = -a + (sp > 0 ? 0 : Math.PI); });
    }
  } }
];
})();
