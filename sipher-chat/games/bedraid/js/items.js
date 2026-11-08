// Items: definitions, the item shop, team upgrades, item meshes and rendered icons.
(() => {
'use strict';
const I = G.ITEMS = {};
const it = (id, o) => { I[id] = Object.assign({ id, name: id, stack: 64, kind: 'misc' }, o); };
// blocks: `block` is the block id (wool resolves to the owner's team colour)
it('wool', { name: 'Wool', kind: 'block', block: 'team', stack: 128 });
it('clay', { name: 'Clay', kind: 'block', block: 10, stack: 128 });
it('planks', { name: 'Planks', kind: 'block', block: 4, stack: 64 });
it('glass', { name: 'Blast Glass', kind: 'block', block: 9, stack: 64 });
it('chalk', { name: 'Chalkstone', kind: 'block', block: 7, stack: 64 });
it('obsidian', { name: 'Obsidian', kind: 'block', block: 8, stack: 64 });
// weapons
it('sword_wood', { name: 'Wood Sword', kind: 'sword', dmg: 18, tier: 0, stack: 1 });
it('sword_stone', { name: 'Stone Sword', kind: 'sword', dmg: 24, tier: 1, stack: 1 });
it('sword_iron', { name: 'Iron Sword', kind: 'sword', dmg: 30, tier: 2, stack: 1 });
it('sword_diamond', { name: 'Diamond Sword', kind: 'sword', dmg: 38, tier: 3, stack: 1 });
it('bow', { name: 'Bow', kind: 'bow', stack: 1 });
it('arrow', { name: 'Arrow', kind: 'ammo', stack: 64 });
// tools (tier 1..4)
const TN = ['', 'Wood', 'Stone', 'Iron', 'Diamond'];
for (let t = 1; t <= 4; t++) {
  it('pick' + t, { name: TN[t] + ' Pickaxe', kind: 'pick', tier: t, stack: 1, speed: [1, 2, 3.2, 5, 7.5][t] });
  it('axe' + t, { name: TN[t] + ' Axe', kind: 'axe', tier: t, stack: 1, speed: [1, 2, 3.2, 5, 7.5][t] });
}
it('shears', { name: 'Shears', kind: 'shears', stack: 1, speed: 4 });
// utility
it('gapple', { name: 'Golden Apple', kind: 'use', stack: 16 });
it('fireball', { name: 'Fireball', kind: 'throw', stack: 16 });
it('tnt', { name: 'TNT', kind: 'tnt', stack: 16 });
it('pearl', { name: 'Warp Pearl', kind: 'throw', stack: 16 });
it('egg', { name: 'Bridge Egg', kind: 'throw', stack: 16 });
it('speed', { name: 'Speed Tonic', kind: 'use', stack: 16 });
it('tower', { name: 'Pop-up Tower', kind: 'use', stack: 16 });

G.RES = ['iron', 'gold', 'diamond', 'emerald'];
G.RES_COLOR = { iron: '#e6e6e6', gold: '#ffd23f', diamond: '#4fe3e0', emerald: '#3be36b' };

// Item shop. `perm` items are kept on death; `armor` sets armour tier.
G.SHOP = [
  { cat: 'Blocks', id: 'wool', n: 16, cost: { iron: 4 }, desc: 'Cheap and fast. Great for bridging.' },
  { cat: 'Blocks', id: 'clay', n: 16, cost: { iron: 12 }, desc: 'Sturdier. Faster to break with a pickaxe.' },
  { cat: 'Blocks', id: 'planks', n: 16, cost: { gold: 4 }, desc: 'Good bed defence. Weak to axes.' },
  { cat: 'Blocks', id: 'glass', n: 4, cost: { iron: 12 }, desc: 'Immune to explosions.' },
  { cat: 'Blocks', id: 'chalk', n: 12, cost: { iron: 24 }, desc: 'Strong. Resists hand mining.' },
  { cat: 'Blocks', id: 'obsidian', n: 4, cost: { emerald: 4 }, desc: 'The toughest block. Blast-proof.' },
  { cat: 'Melee', id: 'sword_stone', n: 1, cost: { iron: 10 }, desc: '24 damage.' },
  { cat: 'Melee', id: 'sword_iron', n: 1, cost: { gold: 7 }, desc: '30 damage.' },
  { cat: 'Melee', id: 'sword_diamond', n: 1, cost: { emerald: 4 }, desc: '38 damage.' },
  { cat: 'Armor', armor: 'chain', name: 'Chain Armor', cost: { iron: 24 }, desc: 'Permanent. 20% less damage.' },
  { cat: 'Armor', armor: 'iron', name: 'Iron Armor', cost: { gold: 12 }, desc: 'Permanent. 35% less damage.' },
  { cat: 'Armor', armor: 'diamond', name: 'Diamond Armor', cost: { emerald: 6 }, desc: 'Permanent. 50% less damage.' },
  { cat: 'Tools', tool: 'pick', desc: 'Breaks clay, chalkstone and obsidian faster. Drops a tier on death.' },
  { cat: 'Tools', tool: 'axe', desc: 'Breaks planks faster. Drops a tier on death.' },
  { cat: 'Tools', id: 'shears', n: 1, cost: { iron: 20 }, desc: 'Permanent. Cuts wool instantly-ish.' },
  { cat: 'Ranged', id: 'bow', n: 1, cost: { gold: 12 }, desc: 'Hold to draw, release to fire.' },
  { cat: 'Ranged', id: 'arrow', n: 8, cost: { gold: 2 }, desc: 'Ammo for the bow.' },
  { cat: 'Utility', id: 'gapple', n: 1, cost: { gold: 3 }, desc: 'Heals 40 health over a few seconds.' },
  { cat: 'Utility', id: 'fireball', n: 1, cost: { iron: 40 }, desc: 'Throw it. Blasts blocks and players away.' },
  { cat: 'Utility', id: 'tnt', n: 1, cost: { gold: 4 }, desc: 'Place it, run. Explodes after 3 seconds.' },
  { cat: 'Utility', id: 'egg', n: 1, cost: { emerald: 1 }, desc: 'Lays a wool bridge where it flies.' },
  { cat: 'Utility', id: 'tower', n: 1, cost: { iron: 24 }, desc: 'Builds a wool tower around you.' },
  { cat: 'Utility', id: 'pearl', n: 1, cost: { emerald: 4 }, desc: 'Teleports you where it lands.' },
  { cat: 'Utility', id: 'speed', n: 1, cost: { emerald: 1 }, desc: '30 seconds of extra speed and jump.' }
];
G.TOOL_COST = { 1: { iron: 10 }, 2: { iron: 10 }, 3: { gold: 3 }, 4: { gold: 6 } };

// Team upgrades, paid in diamonds.
G.UPGRADES = [
  { id: 'sharp', name: 'Sharpened Swords', max: 1, cost: [4], desc: 'Every sword on your team deals +5 damage.' },
  { id: 'prot', name: 'Reinforced Armor', max: 4, cost: [2, 4, 8, 16], desc: 'Each level: 6% less damage for your team.' },
  { id: 'forge', name: 'Island Forge', max: 4, cost: [2, 4, 6, 8], desc: '+50% generator speed per level. Level 3 adds emeralds.' },
  { id: 'haste', name: 'Miner Rush', max: 2, cost: [2, 4], desc: 'Break blocks 25% faster per level.' },
  { id: 'heal', name: 'Healing Aura', max: 1, cost: [1], desc: 'Regenerate health while on your island.' },
  { id: 'trap', name: 'Bed Alarm', max: 1, cost: [1], desc: 'Warns you and slows the first enemy who comes near your bed.' }
];

/* ---------- meshes ---------- */
const boxGeoCache = {};
// A textured cube for a block id (used for held blocks, drops and icons).
G.blockMesh = (blockId, size = 1) => {
  const key = blockId + ':' + size;
  if (!boxGeoCache[key]) {
    const b = G.BLOCKS[blockId], g = new THREE.BoxGeometry(size, size, size);
    const uv = g.attributes.uv;
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each)
    const faces = ['side', 'side', 'top', 'bottom', 'side', 'side'];
    for (let f = 0; f < 6; f++) {
      const [u0, v0, u1, v1] = G.atlas.uv(b.all || b[faces[f]] || b.side);
      for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0); }
    }
    boxGeoCache[key] = g;
  }
  const b = G.BLOCKS[blockId];
  return new THREE.Mesh(boxGeoCache[key], new THREE.MeshLambertMaterial({ map: G.atlas.tex, transparent: b.trans, alphaTest: 0.1 }));
};
const TIER_COL = [0x9a6b3a, 0x8c8f94, 0xe6e6e6, 0x4fe3e0];
const TOOL_COL = [0, 0x9a6b3a, 0x8c8f94, 0xe6e6e6, 0x4fe3e0];
const lam = c => new THREE.MeshLambertMaterial({ color: c });
function voxShape(rows, colors, px = 0.06) {
  // rows: strings, top row first; each char is a colour key
  const g = new THREE.Group();
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.') return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(px, px, px), lam(colors[ch]));
    m.position.set((x - r.length / 2) * px, (rows.length - y) * px, 0); g.add(m);
  }));
  return g;
}
// Build a mesh for an item. Models from Sketchfab where we have them, voxel art otherwise.
G.itemMesh = (id, team = 0) => {
  const d = I[id]; if (!d) return null;
  let m = null;
  if (d.kind === 'block') { m = G.blockMesh(d.block === 'team' ? G.WOOL(team) : d.block, 0.32); m.position.y = 0.16; const g = new THREE.Group(); g.add(m); return g; }
  if (d.kind === 'sword') {
    const col = TIER_COL[d.tier];
    m = G.model('sword', 0.9, { rotX: Math.PI / 2, tint: (mesh, mat) => (/Grip/i.test(mat.name) ? null : col) });
    if (m) return m;
    return voxShape(['..c', '.c.', 'h..'], { c: col, h: 0x5a3c1a }, 0.2);
  }
  if (d.kind === 'pick') {
    const col = TOOL_COL[d.tier];
    m = G.model('pickaxe', 0.7, { tint: (mesh, mat) => (mat.name === 'Material' ? col : null) });
    if (m) return m;
  }
  if (d.kind === 'axe' || d.kind === 'pick') {
    const col = TOOL_COL[d.tier];
    return voxShape(['.cc', '.hc', '.h.', '.h.', '.h.'], { c: col, h: 0x7a5126 }, 0.12);
  }
  if (d.kind === 'shears') return voxShape(['c.c', '.c.', 'r.r'], { c: 0xdddddd, r: 0xb33a3a }, 0.1);
  if (id === 'bow') { m = G.model('bow', 0.8, { rotZ: 0 }); if (m) return m; }
  if (id === 'arrow') return voxShape(['..w', '.s.', 'f..'], { w: 0xdddddd, s: 0x8a6a3a, f: 0xffffff }, 0.12);
  if (id === 'tnt') { m = G.model('tnt', 0.34); if (m) return m; }
  if (id === 'fireball') { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshBasicMaterial({ color: 0xff7a1a })); s.position.y = 0.16; const g = new THREE.Group(); g.add(s); return g; }
  if (id === 'pearl') { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), lam(0x1f8f7a)); s.position.y = 0.12; const g = new THREE.Group(); g.add(s); return g; }
  if (id === 'egg') { const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lam(0xf4ecd8)); s.scale.y = 1.3; s.position.y = 0.15; const g = new THREE.Group(); g.add(s); return g; }
  if (id === 'gapple') return voxShape(['.s.', 'ggg', 'ggg', '.g.'], { g: 0xffcf2e, s: 0x5a3c1a }, 0.1);
  if (id === 'speed') return voxShape(['.c.', '.n.', 'bbb', 'bbb'], { c: 0x7a5126, n: 0xbfe6ff, b: 0x4fd0ff }, 0.1);
  if (id === 'tower') { m = G.blockMesh(G.WOOL(team), 0.32); m.position.y = 0.16; const g = new THREE.Group(); g.add(m); const t = G.blockMesh(G.WOOL(team), 0.2); t.position.y = 0.42; g.add(t); return g; }
  return voxShape(['x'], { x: 0xff00ff }, 0.2);
};
G.resMesh = (kind) => {
  let m = null;
  if (kind === 'iron') m = G.model('ingot', 0, { fit: [0.45, 0.25, 0.45], tint: 0xe9ecef });
  else if (kind === 'gold') m = G.model('ingot', 0, { fit: [0.45, 0.25, 0.45], tint: 0xffc93a });
  else if (kind === 'diamond') m = G.model('gem', 0.42, { tint: 0x4fe3e0 });
  else if (kind === 'emerald') m = G.model('emerald', 0.42, { tint: 0x2fd35f });
  if (!m) { m = new THREE.Group(); const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), lam(+('0x' + G.RES_COLOR[kind].slice(1)))); c.position.y = 0.2; m.add(c); }
  return m;
};

/* ---------- icons: render each item once to a small image ---------- */
G.icons = {};
G.buildIcons = (team) => {
  const size = 72;
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(size, size); r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.AmbientLight(0xffffff, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(2, 3, 4); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
  const shot = (obj, key, o = {}) => {
    const holder = new THREE.Group(); holder.add(obj); sc.add(holder);
    holder.rotation.set(o.rx !== undefined ? o.rx : 0.45, o.ry !== undefined ? o.ry : 0.75, o.rz || 0);
    holder.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(holder), c = b.getCenter(new G.V3()), s = b.getSize(new G.V3()).length();
    cam.position.set(c.x, c.y, c.z + s * 1.75); cam.lookAt(c);
    r.render(sc, cam);
    G.icons[key] = r.domElement.toDataURL();
    sc.remove(holder);
  };
  for (const id of Object.keys(I)) {
    const d = I[id], m = G.itemMesh(id, team);
    if (!m) continue;
    const flat = ['sword', 'pick', 'axe', 'shears', 'ammo'].includes(d.kind) || id === 'bow';
    shot(m, id, flat ? { rx: 0, ry: d.kind === 'pick' ? Math.PI / 2 : 0.2, rz: 0 } : {});
  }
  for (const k of G.RES) shot(G.resMesh(k), 'res_' + k, { rx: 0.5, ry: 0.6 });
  for (const t of ['chain', 'iron', 'diamond']) {
    const c = { chain: 0x9aa0a8, iron: 0xe6e6e6, diamond: 0x4fe3e0 }[t];
    shot(voxShape(['cc.cc', 'ccccc', 'ccccc', '.ccc.', '.ccc.'], { c }, 0.1), 'armor_' + t, { rx: 0, ry: 0 });
  }
  for (const u of G.UPGRADES) {
    const map = { sharp: 'sword_diamond', prot: 'armor_diamond', forge: 'res_gold', haste: 'pick4', heal: 'gapple', trap: 'tnt' };
    G.icons['upg_' + u.id] = G.icons[map[u.id]];
  }
  r.dispose(); r.forceContextLoss && r.forceContextLoss();
};
})();
