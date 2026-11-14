// Building: the piece grid (walls, floors, ramps, cones), placement rules, structural support,
// build-up health, edits (tile masks / ramp direction) and the collision and ray queries every system uses.
// Edit grids follow Fortnite: walls 3x3, floors / cones / ramps 2x2. Tile i: wall c = i % 3, r = floor(i / 3)
// (r = 0 is the bottom row); 2x2 pieces c = i % 2 along x, r = i >> 1 along z.
(() => {
'use strict';
const C = G.CELL, H = G.LH, TH = 0.2, CH = 1.6, V3 = THREE.Vector3;
G.CONE_H = CH; G.TH = TH;
G.pieces = [];
const byKey = new Map(), edges = new Map();
let group, geo, baseMat, ghost, ghostMat, ghostLine;
const RAMP_ANG = Math.atan2(H, C), RAMP_L = Math.hypot(C, H);
G.RAMP_ANG = RAMP_ANG; G.RAMP_L = RAMP_L;
G.FULL = { wall: 511, floor: 15, ramp: 15, cone: 15 };
G.TILE_N = { wall: 9, floor: 4, ramp: 4, cone: 4 };

// ---------------------------------------------------------------- geometry
const tileGeos = {};
function tileBox(w, h, d, c, r, n) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (c + uv.getX(i)) / n, (r + uv.getY(i)) / n);
  return g;
}
function tileGeo(type, c, r) {
  const k = type + c + r;
  if (!tileGeos[k]) tileGeos[k] = type === 'wall' ? tileBox(C / 3, H / 3, TH, c, r, 3) : tileBox(C / 2, TH, C / 2, c, 1 - r, 2);
  return tileGeos[k];
}
// local offset of a tile from the piece mesh centre
G.tileLocal = (p, c, r, out) => {
  if (p.type === 'wall') return out.set((p.d === 0 ? 1 : -1) * (-C / 2 + (c + 0.5) * C / 3), -H / 2 + (r + 0.5) * H / 3, 0);
  return out.set(-C / 2 + (c + 0.5) * C / 2, 0, -C / 2 + (r + 0.5) * C / 2);
};
// one cone quadrant = two flat triangles from the apex down to its outer corner
function coneQuad(c, r, pos, uvs) {
  const sx = c ? 1 : -1, sz = r ? 1 : -1, h = C / 2;
  const A = [0, CH, 0], E1 = [sx * h, 0, 0], K = [sx * h, 0, sz * h], E2 = [0, 0, sz * h];
  for (const v of [A, E1, K, A, K, E2]) { pos.push(v[0], v[1], v[2]); uvs.push(v[0] / C + 0.5, v[2] / C + 0.5); }
}
const coneGeos = {};
function bufGeo(pos, uvs) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals(); return g;
}
function coneGeo(mask) {
  if (coneGeos[mask]) return coneGeos[mask];
  const pos = [], uvs = [];
  for (let i = 0; i < 4; i++) if (!(mask & (1 << i))) coneQuad(i % 2, i >> 1, pos, uvs);
  return (coneGeos[mask] = bufGeo(pos, uvs));
}
G.coneQuadGeo = (c, r) => { const pos = [], uvs = []; coneQuad(c, r, pos, uvs); return bufGeo(pos, uvs); };

G.initBuild = () => {
  group = new THREE.Group(); G.scene.add(group);
  geo = { wall: new THREE.BoxGeometry(C, H, TH), floor: new THREE.BoxGeometry(C, TH, C), ramp: new THREE.BoxGeometry(RAMP_L, TH, C) };
  baseMat = {};
  for (const m of ['wood', 'brick', 'metal', 'steel']) baseMat[m] = new THREE.MeshLambertMaterial({ map: G.tex[m] });
  // blueprint ghost: translucent blue with bright edges
  ghostMat = new THREE.MeshBasicMaterial({ color: 0x3aa8ff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  ghostLine = new THREE.LineBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.9 });
  ghost = {};
  const gGeo = { wall: geo.wall, floor: geo.floor, ramp: geo.ramp, cone: coneGeo(0) };
  for (const t of G.PIECES) {
    const holder = new THREE.Group(), m = new THREE.Mesh(gGeo[t], ghostMat);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(gGeo[t], 1), ghostLine));
    if (t === 'ramp') m.rotation.z = RAMP_ANG;
    if (t === 'wall' || t === 'floor') { // grid lines show where the edit tiles are
      const n = t === 'wall' ? 3 : 2, pts = [];
      for (let i = 1; i < n; i++) {
        if (t === 'wall') { const x = -C / 2 + i * C / 3, y = -H / 2 + i * H / 3; pts.push(x, -H / 2, 0, x, H / 2, 0, -C / 2, y, 0, C / 2, y, 0); }
        else { const o = -C / 2 + i * C / 2; pts.push(o, TH / 2, -C / 2, o, TH / 2, C / 2, -C / 2, TH / 2, o, C / 2, TH / 2, o); }
      }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      m.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.35 })));
    }
    holder.add(m); holder.visible = false; holder.renderOrder = 4; G.scene.add(holder); ghost[t] = holder;
  }
};

const keyOf = (t, ix, iy, iz, d) => t === 'wall' ? `w${ix},${iy},${iz},${d}` : t[0] + `${ix},${iy},${iz}`;
G.pieceAt = (t, ix, iy, iz, d) => byKey.get(keyOf(t, ix, iy, iz, d));
function edgeKeys(t, ix, iy, iz, d) {
  const x = (a, b, c) => `x${a},${b},${c}`, z = (a, b, c) => `z${a},${b},${c}`, y = (a, b, c) => `y${a},${b},${c}`;
  if (t === 'wall') return d === 0 ? [x(ix, iy, iz), x(ix, iy + 1, iz), y(ix, iy, iz), y(ix + 1, iy, iz)] : [z(ix, iy, iz), z(ix, iy + 1, iz), y(ix, iy, iz), y(ix, iy, iz + 1)];
  const e = [x(ix, iy, iz), x(ix, iy, iz + 1), z(ix, iy, iz), z(ix + 1, iy, iz)];
  if (t === 'ramp') e.push(d === 0 ? z(ix + 1, iy + 1, iz) : d === 1 ? x(ix, iy + 1, iz + 1) : d === 2 ? z(ix, iy + 1, iz) : x(ix, iy + 1, iz));
  return e;
}
const link = p => { for (const e of p.edges) { let set = edges.get(e); if (!set) edges.set(e, set = new Set()); set.add(p); } };
const unlink = p => { for (const e of p.edges) { const set = edges.get(e); if (set) { set.delete(p); if (!set.size) edges.delete(e); } } };
// 180-degree rotation about the arena centre, used to keep maps fair
G.mirrorSpec = s => {
  const o = { type: s.type, iy: s.iy, mat: s.mat, d: s.d };
  if (s.type === 'wall') { if (s.d === 0) { o.ix = -s.ix - 1; o.iz = -s.iz; } else { o.ix = -s.ix; o.iz = -s.iz - 1; } }
  else { o.ix = -s.ix - 1; o.iz = -s.iz - 1; if (s.type === 'ramp') o.d = (s.d + 2) % 4; }
  return o;
};

G.placeMesh = (mesh, s) => {
  const { type: t, ix, iy, iz, d } = s;
  mesh.rotation.set(0, 0, 0);
  if (t === 'wall') { if (d === 0) mesh.position.set(ix * C + C / 2, iy * H + H / 2, iz * C); else { mesh.position.set(ix * C, iy * H + H / 2, iz * C + C / 2); mesh.rotation.y = Math.PI / 2; } }
  else if (t === 'floor') mesh.position.set(ix * C + C / 2, iy * H - TH / 2 + 0.05, iz * C + C / 2);
  else if (t === 'cone') mesh.position.set(ix * C + C / 2, iy * H + 0.02, iz * C + C / 2);
  else { mesh.position.set(ix * C + C / 2, iy * H + H / 2 - 0.1, iz * C + C / 2); mesh.rotation.y = -d * Math.PI / 2; }
};
const _v = new V3();
function buildMesh(p) {
  const mat = p.material; let mesh;
  if (p.type === 'ramp') { mesh = new THREE.Group(); const m = new THREE.Mesh(geo.ramp, mat); m.rotation.z = RAMP_ANG; mesh.add(m); }
  else if (p.type === 'cone') mesh = new THREE.Mesh(coneGeo(p.mask), mat);
  else if (!p.mask) mesh = new THREE.Mesh(geo[p.type], mat);
  else {
    mesh = new THREE.Group();
    const n = p.type === 'wall' ? 3 : 2;
    for (let i = 0; i < n * n; i++) if (!(p.mask & (1 << i))) {
      const c = i % n, r = Math.floor(i / n), m = new THREE.Mesh(tileGeo(p.type, c, r), mat);
      G.tileLocal(p, c, r, m.position); mesh.add(m);
    }
  }
  mesh.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  G.placeMesh(mesh, p);
  return mesh;
}
// solid sub-boxes for walls and floors (one per remaining tile)
function computeBoxes(p) {
  p.boxes = [];
  if (p.type === 'wall') {
    for (let i = 0; i < 9; i++) {
      if (p.mask & (1 << i)) continue;
      const c = i % 3, r = (i / 3) | 0, a = c * C / 3, b = (c + 1) * C / 3, y0 = p.y0 + r * H / 3, y1 = p.y0 + (r + 1) * H / 3;
      if (p.d === 0) p.boxes.push({ min: new V3(p.x0 + a, y0, p.z0 - TH / 2), max: new V3(p.x0 + b, y1, p.z0 + TH / 2) });
      else p.boxes.push({ min: new V3(p.x0 - TH / 2, y0, p.z0 + a), max: new V3(p.x0 + TH / 2, y1, p.z0 + b) });
    }
  } else if (p.type === 'floor') {
    for (let i = 0; i < 4; i++) {
      if (p.mask & (1 << i)) continue;
      const c = i % 2, r = i >> 1;
      p.boxes.push({ min: new V3(p.x0 + c * C / 2, p.y0 - 0.15, p.z0 + r * C / 2), max: new V3(p.x0 + (c + 1) * C / 2, p.y0 + 0.05, p.z0 + (r + 1) * C / 2) });
    }
  }
}

G.addPiece = (s, owner, o = {}) => {
  const key = keyOf(s.type, s.ix, s.iy, s.iz, s.d);
  if (byKey.has(key)) return null;
  const mat = baseMat[s.mat].clone();
  if (s.type === 'cone') mat.side = THREE.DoubleSide;
  const x0 = s.ix * C, y0 = s.iy * H, z0 = s.iz * C;
  let min, max;
  if (s.type === 'wall') { if (s.d === 0) { min = new V3(x0, y0, z0 - TH / 2); max = new V3(x0 + C, y0 + H, z0 + TH / 2); } else { min = new V3(x0 - TH / 2, y0, z0); max = new V3(x0 + TH / 2, y0 + H, z0 + C); } }
  else if (s.type === 'floor') { min = new V3(x0, y0 - 0.15, z0); max = new V3(x0 + C, y0 + 0.05, z0 + C); }
  else if (s.type === 'cone') { min = new V3(x0, y0 - 0.05, z0); max = new V3(x0 + C, y0 + CH, z0 + C); }
  else { min = new V3(x0, y0 - 0.2, z0); max = new V3(x0 + C, y0 + H, z0 + C); }
  const M = G.MATS[s.mat], full = o.static ? Infinity : M.hp;
  const p = { type: s.type, ix: s.ix, iy: s.iy, iz: s.iz, d: s.d || 0, d0: s.d || 0, mat: s.mat, mask: s.mask || 0, key, material: mat, min, max, x0, y0, z0,
    hp: o.static || o.quiet ? full : M.start, maxHp: full, growT: o.static || o.quiet ? 0 : M.time,
    owner, static: !!o.static, alive: true, pop: o.quiet || o.static ? 0 : 0.14, flash: 0, fall: -1, editing: false,
    center: new V3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2) };
  p.mesh = buildMesh(p); group.add(p.mesh); computeBoxes(p);
  p.edges = edgeKeys(p.type, p.ix, p.iy, p.iz, p.d); link(p);
  byKey.set(key, p); G.pieces.push(p);
  if (p.pop > 0) p.mesh.scale.setScalar(0.7);
  tint(p);
  return p;
};
G.removePiece = (p, fx) => {
  if (!p.alive) return;
  p.alive = false; byKey.delete(p.key); unlink(p);
  const i = G.pieces.indexOf(p); if (i >= 0) G.pieces.splice(i, 1);
  group.remove(p.mesh); p.material.dispose();
  if (fx) { G.spawnDebris(p.center, G.MATS[p.mat] ? G.MATS[p.mat].color : '#667', 12, 5, 1.6); G.audio.breakPiece(p.center); checkSupport(); }
};
G.clearPieces = all => { for (const p of G.pieces.slice()) if (all || !p.static) G.removePiece(p, false); };

// Apply an edit: a tile mask for walls / floors / cones, or a new direction for ramps. Health is kept.
G.applyEdit = (p, mask, dir) => {
  if (!p || !p.alive) return false;
  mask &= G.FULL[p.type];
  if (mask === G.FULL[p.type]) return false;
  if (p.type === 'ramp') {
    mask = 0;
    if (dir !== undefined && dir !== p.d) { unlink(p); p.d = dir; p.edges = edgeKeys(p.type, p.ix, p.iy, p.iz, p.d); link(p); }
  }
  p.mask = mask;
  const vis = p.mesh.visible;
  group.remove(p.mesh); p.mesh = buildMesh(p); p.mesh.visible = vis; group.add(p.mesh); computeBoxes(p);
  pushOut(p);
  return true;
};

function checkSupport() {
  const seen = new Set(), q = [];
  for (const p of G.pieces) if (p.iy === 0 || p.static) { seen.add(p); q.push(p); }
  while (q.length) {
    const p = q.pop();
    for (const e of p.edges) { const set = edges.get(e); if (set) for (const n of set) if (!seen.has(n)) { seen.add(n); q.push(n); } }
  }
  let i = 0;
  for (const p of G.pieces) if (!seen.has(p) && p.fall < 0) p.fall = 0.1 + (i++) * 0.035;
}
function tint(p) {
  if (p.static) return;
  const k = 0.5 + 0.5 * G.clamp(p.hp / p.maxHp, 0, 1);
  p.material.color.setRGB(k, k, k);
  const fl = p.flash > 0 ? 0.35 : 0, gr = p.growT > 0 ? 0.16 * p.growT / G.MATS[p.mat].time + 0.04 : 0;
  p.material.emissive.setRGB(fl + gr * 0.25, fl + gr * 0.6, fl + gr);
}
G.damagePiece = (p, dmg, by) => {
  if (!p.alive || p.static) return;
  p.hp -= dmg; p.flash = 0.12;
  if (by && by.isPlayer && G.match) G.match.stats.buildDmg += dmg;
  if (p.hp <= 0) G.removePiece(p, true);
  else { tint(p); G.audio.thud(p.center); }
};
G.buildUpdate = dt => {
  for (let i = G.pieces.length - 1; i >= 0; i--) {
    const p = G.pieces[i];
    if (p.pop > 0) { p.pop -= dt; p.mesh.scale.setScalar(p.pop <= 0 ? 1 : 1 - (p.pop / 0.14) * 0.3); }
    let dirty = false;
    if (p.growT > 0) { const M = G.MATS[p.mat]; p.growT -= dt; p.hp = Math.min(p.maxHp, p.hp + (M.hp - M.start) / M.time * dt); dirty = true; }
    if (p.flash > 0) { p.flash -= dt; dirty = true; }
    if (dirty) tint(p);
    if (p.fall >= 0) { p.fall -= dt; if (p.fall < 0) G.removePiece(p, true); }
  }
};

// ---------------------------------------------------------------- collision queries
const rampY = (p, x, z) => {
  const u = p.d === 0 ? (x - p.x0) / C : p.d === 1 ? (z - p.z0) / C : p.d === 2 ? 1 - (x - p.x0) / C : 1 - (z - p.z0) / C;
  return p.y0 + G.clamp(u, 0, 1) * H;
};
G.rampY = rampY;
// cone surface height, or null over an edited-out quadrant / outside
const coneY = (p, x, z) => {
  const u = (x - p.x0 - C / 2) / (C / 2), v = (z - p.z0 - C / 2) / (C / 2);
  if (u < -1 || u > 1 || v < -1 || v > 1) return null;
  if (p.mask & (1 << ((v >= 0 ? 2 : 0) + (u >= 0 ? 1 : 0)))) return null;
  return p.y0 + CH * (1 - Math.max(Math.abs(u), Math.abs(v)));
};
G.coneY = coneY;
const inXZ = (b, x, z, e) => x >= b.min.x - e && x <= b.max.x + e && z >= b.min.z - e && z <= b.max.z + e;
// highest surface at (x, z) that is no more than `step` above y
G.floorY = (x, z, y, step) => {
  let best = 0; const lim = y + step, e = 0.1;
  for (const b of G.boxes) if (inXZ(b, x, z, e) && b.max.y <= lim && b.max.y > best) best = b.max.y;
  for (const p of G.pieces) {
    if (!inXZ(p, x, z, e)) continue;
    if (p.type === 'ramp') { const s = rampY(p, x, z); if (s <= lim && s > best) best = s; }
    else if (p.type === 'cone') { const s = coneY(p, G.clamp(x, p.min.x, p.max.x), G.clamp(z, p.min.z, p.max.z)); if (s !== null && s <= lim && s > best) best = s; }
    else for (const b of p.boxes) if (inXZ(b, x, z, e) && b.max.y <= lim && b.max.y > best) best = b.max.y;
  }
  return best;
};
const circleRect = (x, z, r, mn, mx) => { const dx = x - G.clamp(x, mn.x, mx.x), dz = z - G.clamp(z, mn.z, mx.z); return dx * dx + dz * dz < r * r; };
// is a standing cylinder at (x, y, z) inside something solid? returns the blocker
G.blocked = (x, z, y, r, h) => {
  const y0 = y + G.STEP, y1 = y + h;
  for (const b of G.boxes) if (b.max.y > y0 && b.min.y < y1 && circleRect(x, z, r, b.min, b.max)) return b;
  for (const p of G.pieces) {
    if (p.max.y <= y0 || p.min.y >= y1) continue;
    if (x + r <= p.min.x || x - r >= p.max.x || z + r <= p.min.z || z - r >= p.max.z) continue;
    if (p.type === 'ramp' || p.type === 'cone') {
      if (x < p.min.x || x > p.max.x || z < p.min.z || z > p.max.z) continue;
      const s = p.type === 'ramp' ? rampY(p, x, z) : coneY(p, x, z);
      if (s !== null && s > y0 && s - 0.3 < y1) return p;
    } else for (const b of p.boxes) if (b.max.y > y0 && b.min.y < y1 && circleRect(x, z, r, b.min, b.max)) return p;
  }
  return null;
};
G.rayBox = (o, d, mn, mx) => {
  let t0 = 0, t1 = Infinity;
  for (const ax of ['x', 'y', 'z']) {
    const dv = d[ax];
    if (Math.abs(dv) < 1e-8) { if (o[ax] < mn[ax] || o[ax] > mx[ax]) return Infinity; continue; }
    let a = (mn[ax] - o[ax]) / dv, b = (mx[ax] - o[ax]) / dv;
    if (a > b) { const s = a; a = b; b = s; }
    if (a > t0) t0 = a; if (b < t1) t1 = b;
    if (t0 > t1) return Infinity;
  }
  return t0;
};
const _e1 = new V3(), _e2 = new V3(), _pv = new V3(), _tv = new V3(), _qv = new V3(), _A = new V3(), _B = new V3(), _K = new V3(), _E = new V3();
function triT(o, d, a, b, c) {
  _e1.subVectors(b, a); _e2.subVectors(c, a); _pv.crossVectors(d, _e2);
  const det = _e1.dot(_pv); if (Math.abs(det) < 1e-9) return Infinity;
  const inv = 1 / det; _tv.subVectors(o, a);
  const u = _tv.dot(_pv) * inv; if (u < 0 || u > 1) return Infinity;
  _qv.crossVectors(_tv, _e1);
  const v = d.dot(_qv) * inv; if (v < 0 || u + v > 1) return Infinity;
  const t = _e2.dot(_qv) * inv; return t >= 0 ? t : Infinity;
}
// distance along a ray to a piece; `full` ignores edits (used to aim edits at holes)
G.rayPiece = (p, o, d, full) => {
  const tb = G.rayBox(o, d, p.min, p.max);
  if (tb === Infinity) return Infinity;
  if (p.type === 'wall' || p.type === 'floor') {
    if (full || !p.mask) return tb;
    let best = Infinity; for (const b of p.boxes) { const t = G.rayBox(o, d, b.min, b.max); if (t < best) best = t; }
    return best;
  }
  if (p.type === 'ramp') {
    const u0 = p.d === 0 ? (o.x - p.x0) / C : p.d === 1 ? (o.z - p.z0) / C : p.d === 2 ? 1 - (o.x - p.x0) / C : 1 - (o.z - p.z0) / C;
    const du = (p.d === 0 ? d.x : p.d === 1 ? d.z : p.d === 2 ? -d.x : -d.z) / C;
    const f0 = p.y0 + u0 * H - o.y, df = du * H - d.y;
    if (Math.abs(df) < 1e-8) return Infinity;
    const t = -f0 / df; if (t < 0) return Infinity;
    const hx = o.x + d.x * t, hz = o.z + d.z * t;
    if (hx < p.min.x - 0.01 || hx > p.max.x + 0.01 || hz < p.min.z - 0.01 || hz > p.max.z + 0.01) return Infinity;
    return t;
  }
  const cx = p.x0 + C / 2, cz = p.z0 + C / 2, h = C / 2; let best = Infinity;
  _A.set(cx, p.y0 + CH, cz);
  for (let i = 0; i < 4; i++) {
    if (!full && p.mask & (1 << i)) continue;
    const sx = i % 2 ? 1 : -1, sz = i >> 1 ? 1 : -1;
    _B.set(cx + sx * h, p.y0, cz); _K.set(cx + sx * h, p.y0, cz + sz * h); _E.set(cx, p.y0, cz + sz * h);
    best = Math.min(best, triT(o, d, _A, _B, _K), triT(o, d, _A, _K, _E));
  }
  return best;
};
// first solid thing along a ray: { t, piece, hit }
G.rayWorld = (o, d, maxT, skip) => {
  let best = maxT, hit = null;
  if (d.y < 0) { const t = -o.y / d.y; if (t >= 0 && t < best) { best = t; hit = 'ground'; } }
  for (const b of G.boxes) { const t = G.rayBox(o, d, b.min, b.max); if (t < best) { best = t; hit = b; } }
  for (const p of G.pieces) {
    if (p === skip) continue;
    const t = G.rayPiece(p, o, d, false);
    if (t < best) { best = t; hit = p; }
  }
  return { t: best, hit, piece: hit && hit.type ? hit : null };
};
const _d = new V3();
// what blocks the straight line from a to b (null when clear)
G.lineBlock = (a, b) => {
  _d.subVectors(b, a); const len = _d.length(); if (len < 0.001) return null; _d.multiplyScalar(1 / len);
  return G.rayWorld(a, _d, len - 0.05).hit;
};

// ---------------------------------------------------------------- placement
const DX = [1, 0, -1, 0], DZ = [0, 1, 0, -1];
G.buildTarget = (a, type, yaw, pitch) => {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), px = a.pos.x, pz = a.pos.z;
  const L = Math.floor((a.pos.y + 0.4) / H);
  const s = { type, ix: 0, iy: L, iz: 0, d: 0, mat: a.matSel };
  const cell = reach => { s.ix = Math.floor((px + fx * reach) / C); s.iz = Math.floor((pz + fz * reach) / C); };
  if (type === 'wall') {
    if (Math.abs(fz) >= Math.abs(fx)) { s.d = 0; s.ix = Math.floor(px / C); s.iz = fz > 0 ? Math.ceil((pz + 0.3) / C) : Math.floor((pz - 0.3) / C); }
    else { s.d = 1; s.iz = Math.floor(pz / C); s.ix = fx > 0 ? Math.ceil((px + 0.3) / C) : Math.floor((px - 0.3) / C); }
    const has = iy => G.pieceAt('wall', s.ix, iy, s.iz, s.d);
    if (pitch > 0.8) s.iy = L + 1; else if (pitch < -0.95 && L > 0) s.iy = L - 1;
    if (has(s.iy)) { if (pitch > 0.25 && !has(L + 1)) s.iy = L + 1; else if (pitch < -0.5 && L > 0 && !has(L - 1)) s.iy = L - 1; }
  } else if (type === 'floor') {
    if (pitch > 0.6) { s.iy = L + 1; cell(0); if (G.pieceAt('floor', s.ix, s.iy, s.iz)) cell(2.6); }
    else {
      cell(pitch < -1.0 ? 0 : 2.4);
      if (G.pieceAt('floor', s.ix, s.iy, s.iz)) { cell(pitch < -1.0 ? 2.4 : 0); if (G.pieceAt('floor', s.ix, s.iy, s.iz)) cell(4.6); }
    }
  } else if (type === 'cone') {
    // cones sit on top of the level you're on, over your head or the tile in front
    s.iy = L + 1;
    if (pitch > 0.45) cell(0); else if (pitch < -0.75) { s.iy = L; cell(pitch < -1.1 ? 0 : 2.4); } else cell(2.4);
    if (G.pieceAt('cone', s.ix, s.iy, s.iz)) cell(pitch > 0.45 ? 2.6 : 0);
  } else {
    s.d = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3);
    s.ix = Math.floor((px + DX[s.d] * 1.2) / C); s.iz = Math.floor((pz + DZ[s.d] * 1.2) / C);
    s.iy = Math.floor((a.pos.y + 0.5) / H);
    if (G.pieceAt('ramp', s.ix, s.iy, s.iz)) { s.ix += DX[s.d]; s.iz += DZ[s.d]; s.iy += 1; }
  }
  s.valid = G.canBuild(a, s);
  return s;
};
G.canBuild = (a, s) => {
  const A = G.arena;
  if (!G.match || !G.match.mode.build) return false;
  if (s.iy < 0 || s.iy >= A.maxLv) return false;
  if (s.type === 'wall') { if (s.d === 0 ? (s.ix < A.cx0 || s.ix >= A.cx1 || s.iz < A.cz0 || s.iz > A.cz1) : (s.ix < A.cx0 || s.ix > A.cx1 || s.iz < A.cz0 || s.iz >= A.cz1)) return false; }
  else if (s.ix < A.cx0 || s.ix >= A.cx1 || s.iz < A.cz0 || s.iz >= A.cz1) return false;
  if (G.pieceAt(s.type, s.ix, s.iy, s.iz, s.d)) return false;
  if (a && a.mats[s.mat] < G.COST) return false;
  if (s.iy === 0) return true;
  for (const e of edgeKeys(s.type, s.ix, s.iy, s.iz, s.d)) if (edges.has(e)) return true;
  return false;
};
// nobody gets stuck inside a fresh (or freshly reset) piece: ramps, cones and floors lift you, walls push you out
function pushOut(p) {
  for (const b of G.actors) {
    if (!b.alive || G.blocked(b.pos.x, b.pos.z, b.pos.y, G.RAD, b.h || G.HEIGHT) !== p) continue;
    if (p.type === 'wall') {
      if (p.d === 0) b.pos.z = p.z0 + (b.pos.z >= p.z0 ? 1 : -1) * (TH / 2 + G.RAD + 0.02);
      else b.pos.x = p.x0 + (b.pos.x >= p.x0 ? 1 : -1) * (TH / 2 + G.RAD + 0.02);
    } else if (p.type === 'floor' && b.pos.y + G.HEIGHT * 0.5 < p.min.y) { b.pos.y = p.min.y - G.HEIGHT - 0.02; if (b.vel.y > 0) b.vel.y = 0; }
    else {
      const s = p.type === 'ramp' ? rampY(p, b.pos.x, b.pos.z) : p.type === 'cone' ? coneY(p, b.pos.x, b.pos.z) : p.max.y;
      if (s !== null) { b.pos.y = s; b.vel.y = 0; b.grounded = true; b.peakY = b.pos.y; }
    }
  }
}
G.pushOut = pushOut;
G.tryBuild = (a, s) => {
  if (!G.canBuild(a, s)) return null;
  const p = G.addPiece(s, a); if (!p) return null;
  a.mats[s.mat] -= G.COST;
  if (a.isPlayer) G.match.stats.builds++;
  G.audio.build(p.center);
  pushOut(p);
  return p;
};
G.showGhost = s => {
  for (const t in ghost) ghost[t].visible = false;
  if (!s) return;
  const g = ghost[s.type]; g.visible = true; G.placeMesh(g, s);
  ghostMat.color.set(s.valid ? 0x3aa8ff : 0xff5148); ghostLine.color.set(s.valid ? 0xcfeeff : 0xffc2bd);
};
})();
