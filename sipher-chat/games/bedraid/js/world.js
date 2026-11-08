// World: voxel storage, chunk meshing (face culling + baked ambient occlusion), raycasts.
(() => {
'use strict';
const { W, H, D } = G;
const CS = 16, CX = W / CS, CY = H / CS, CZ = D / CS;

// Block registry. hard = seconds to break by hand; tool = which tool speeds it up.
const B = G.BLOCKS = [];
const def = (id, o) => { B[id] = Object.assign({ id, solid: true, trans: false, hard: 1, tool: 'any', blast: false, height: 1, name: '' }, o); };
def(0, { name: 'Air', solid: false, trans: true });
def(1, { name: 'Grass', top: 'grass_top', side: 'grass_side', bottom: 'dirt' });
def(2, { name: 'Dirt', all: 'dirt' });
def(3, { name: 'Stone', all: 'stone' });
def(4, { name: 'Planks', all: 'planks', hard: 2.0, tool: 'axe' });
def(5, { name: 'Log', top: 'log_top', bottom: 'log_top', side: 'log_side', hard: 2.0, tool: 'axe' });
def(6, { name: 'Leaves', all: 'leaves', trans: true, hard: 0.3 });
def(7, { name: 'Chalkstone', all: 'chalk', hard: 2.6, tool: 'pick' });
def(8, { name: 'Obsidian', all: 'obsidian', hard: 24, tool: 'pick', blast: true });
def(9, { name: 'Blast Glass', all: 'glass', trans: true, hard: 0.6, blast: true });
def(10, { name: 'Clay', all: 'clay', hard: 1.4, tool: 'pick' });
for (const t of G.TEAMS) def(11 + t.id, { name: t.name + ' Wool', all: 'wool' + t.id, hard: 0.55, tool: 'shears' });
def(15, { name: 'Island Stone', all: 'islandstone' });
def(16, { name: 'Bed', trans: true, hard: 1.0, height: 0.56, bed: true });
def(17, { name: 'Pad', all: 'pad' });
def(18, { name: 'Brick', all: 'brick' });
def(19, { name: 'Snow', all: 'snow' });
def(20, { name: 'Sand', all: 'sand' });
G.WOOL = t => 11 + t;

const blocks = new Uint8Array(W * H * D);
const placed = new Uint8Array(W * H * D); // 1 = placed by a player, so it may be broken
const bedTeam = new Int8Array(W * H * D).fill(-1);
const idx = (x, y, z) => x + W * (z + D * y);
const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;

const world = G.world = {
  blocks, placed,
  get(x, y, z) { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); return inside(x, y, z) ? blocks[idx(x, y, z)] : 0; },
  isPlaced(x, y, z) { return inside(x, y, z) && placed[idx(x, y, z)] === 1; },
  bedTeamAt(x, y, z) { return inside(x, y, z) ? bedTeam[idx(x, y, z)] : -1; },
  // Raw set used by the map generator (no remesh bookkeeping).
  raw(x, y, z, id, isPlaced = 0) { if (!inside(x, y, z)) return; const i = idx(x, y, z); blocks[i] = id; placed[i] = isPlaced; },
  setBed(x, y, z, team) { this.raw(x, y, z, 16); bedTeam[idx(x, y, z)] = team; },
  set(x, y, z, id, isPlaced = 1) {
    if (!inside(x, y, z)) return false;
    const i = idx(x, y, z); blocks[i] = id; placed[i] = id ? isPlaced : 0;
    if (!id) bedTeam[i] = -1;
    dirty(x, y, z);
    return true;
  },
  clear() { blocks.fill(0); placed.fill(0); bedTeam.fill(-1); },
  inside
};
G.solidH = (x, y, z) => { const b = B[world.get(x, y, z)]; return b && b.solid ? b.height : 0; };

/* ---------- meshing ---------- */
const FACES = [
  { n: [-1, 0, 0], c: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]], uv: [[0, 1], [0, 0], [1, 1], [1, 0]], shade: 0.8, k: 'side' },
  { n: [1, 0, 0], c: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]], uv: [[0, 1], [0, 0], [1, 1], [1, 0]], shade: 0.8, k: 'side' },
  { n: [0, -1, 0], c: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]], uv: [[1, 0], [0, 0], [1, 1], [0, 1]], shade: 0.55, k: 'bottom' },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], uv: [[1, 1], [0, 1], [1, 0], [0, 0]], shade: 1.0, k: 'top' },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [0, 1], [1, 1]], shade: 0.7, k: 'side' },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], uv: [[0, 0], [1, 0], [0, 1], [1, 1]], shade: 0.7, k: 'side' }
];
const AO = [0.45, 0.62, 0.8, 1];
const tileOf = (b, k) => b.all || b[k] || b.side;
const opaqueAt = (x, y, z) => { const id = world.get(x, y, z); return id !== 0 && !B[id].trans; };

const chunks = new Map();
const dirtySet = new Set();
const ckey = (cx, cy, cz) => cx + CX * (cz + CZ * cy);
function dirty(x, y, z) {
  const cx = Math.floor(x / CS), cy = Math.floor(y / CS), cz = Math.floor(z / CS);
  dirtySet.add(ckey(cx, cy, cz));
  const lx = x - cx * CS, ly = y - cy * CS, lz = z - cz * CS;
  if (lx === 0 && cx > 0) dirtySet.add(ckey(cx - 1, cy, cz));
  if (lx === CS - 1 && cx < CX - 1) dirtySet.add(ckey(cx + 1, cy, cz));
  if (ly === 0 && cy > 0) dirtySet.add(ckey(cx, cy - 1, cz));
  if (ly === CS - 1 && cy < CY - 1) dirtySet.add(ckey(cx, cy + 1, cz));
  if (lz === 0 && cz > 0) dirtySet.add(ckey(cx, cy, cz - 1));
  if (lz === CS - 1 && cz < CZ - 1) dirtySet.add(ckey(cx, cy, cz + 1));
}

let matOpaque, matTrans, root;
world.initMeshing = scene => {
  matOpaque = new THREE.MeshLambertMaterial({ map: G.atlas.tex, vertexColors: true });
  matTrans = new THREE.MeshLambertMaterial({ map: G.atlas.tex, vertexColors: true, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
  root = new THREE.Group(); scene.add(root);
};
function buildChunk(cx, cy, cz) {
  const out = [{ p: [], n: [], u: [], c: [], i: [] }, { p: [], n: [], u: [], c: [], i: [] }];
  const x0 = cx * CS, y0 = cy * CS, z0 = cz * CS;
  for (let y = y0; y < y0 + CS; y++) for (let z = z0; z < z0 + CS; z++) for (let x = x0; x < x0 + CS; x++) {
    const id = blocks[idx(x, y, z)];
    if (!id) continue;
    const b = B[id];
    if (b.bed) continue; // beds are drawn by their model
    const buf = out[b.trans ? 1 : 0];
    for (const f of FACES) {
      const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
      const nid = world.get(nx, ny, nz);
      if (nid && (!B[nid].trans || (b.trans && nid === id))) continue;
      const [u0, v0, u1, v1] = G.atlas.uv(tileOf(b, f.k));
      const base = buf.p.length / 3, ao = [];
      for (let k = 0; k < 4; k++) {
        const c = f.c[k];
        buf.p.push(x + c[0], y + c[1], z + c[2]);
        buf.n.push(f.n[0], f.n[1], f.n[2]);
        buf.u.push(f.uv[k][0] ? u1 : u0, f.uv[k][1] ? v1 : v0);
        // ambient occlusion from the three cells around this corner, in front of the face
        let a = 3;
        if (!b.trans) {
          const t = [];
          for (let ax = 0; ax < 3; ax++) if (!f.n[ax]) t.push(ax);
          const s1 = [nx, ny, nz], s2 = [nx, ny, nz];
          s1[t[0]] += c[t[0]] ? 1 : -1; s2[t[1]] += c[t[1]] ? 1 : -1;
          const cc = [s1[0], s1[1], s1[2]]; cc[t[1]] += c[t[1]] ? 1 : -1;
          const o1 = opaqueAt(s1[0], s1[1], s1[2]) ? 1 : 0, o2 = opaqueAt(s2[0], s2[1], s2[2]) ? 1 : 0, o3 = opaqueAt(cc[0], cc[1], cc[2]) ? 1 : 0;
          a = o1 && o2 ? 0 : 3 - (o1 + o2 + o3);
        }
        ao.push(a);
        const l = f.shade * AO[a];
        buf.c.push(l, l, l);
      }
      if (ao[0] + ao[3] > ao[1] + ao[2]) buf.i.push(base, base + 1, base + 3, base, base + 3, base + 2);
      else buf.i.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  const key = ckey(cx, cy, cz);
  let ch = chunks.get(key);
  if (ch) { for (const m of ch) { root.remove(m); m.geometry.dispose(); } }
  ch = [];
  out.forEach((o, k) => {
    if (!o.i.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(o.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(o.c, 3));
    g.setIndex(o.i);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, k ? matTrans : matOpaque);
    if (k) m.renderOrder = 1;
    m.matrixAutoUpdate = false;
    root.add(m); ch.push(m);
  });
  chunks.set(key, ch);
}
world.buildAll = () => {
  for (const ch of chunks.values()) for (const m of ch) { root.remove(m); m.geometry.dispose(); }
  chunks.clear(); dirtySet.clear();
  for (let cy = 0; cy < CY; cy++) for (let cz = 0; cz < CZ; cz++) for (let cx = 0; cx < CX; cx++) buildChunk(cx, cy, cz);
};
world.update = () => {
  let n = 0;
  for (const key of dirtySet) {
    dirtySet.delete(key);
    const cx = key % CX, cz = Math.floor(key / CX) % CZ, cy = Math.floor(key / (CX * CZ));
    buildChunk(cx, cy, cz);
    if (++n >= 6) break;
  }
};

// Voxel DDA raycast. Returns { x,y,z, nx,ny,nz, dist, id } or null.
world.raycast = (o, d, maxDist) => {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = sx ? Math.abs(1 / d.x) : Infinity, tdy = sy ? Math.abs(1 / d.y) : Infinity, tdz = sz ? Math.abs(1 / d.z) : Infinity;
  let tmx = sx > 0 ? (x + 1 - o.x) * tdx : sx < 0 ? (o.x - x) * tdx : Infinity;
  let tmy = sy > 0 ? (y + 1 - o.y) * tdy : sy < 0 ? (o.y - y) * tdy : Infinity;
  let tmz = sz > 0 ? (z + 1 - o.z) * tdz : sz < 0 ? (o.z - z) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  while (t <= maxDist) {
    const id = world.get(x, y, z);
    if (id) {
      const b = B[id];
      // beds are short: only count a hit if the ray is low enough inside the cell
      if (!b.bed || (o.y + d.y * t) - y <= b.height + 0.05 || ny === 1) return { x, y, z, nx, ny, nz, dist: t, id };
    }
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
    else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
  }
  return null;
};

// Does an axis-aligned box overlap any solid block?
world.boxHits = (x0, y0, z0, x1, y1, z1) => {
  for (let y = Math.floor(y0); y <= Math.floor(y1 - 1e-6); y++)
    for (let z = Math.floor(z0); z <= Math.floor(z1 - 1e-6); z++)
      for (let x = Math.floor(x0); x <= Math.floor(x1 - 1e-6); x++) {
        const h = G.solidH(x, y, z);
        if (h && y + h > y0 && y < y1) return true;
      }
  return false;
};
})();
