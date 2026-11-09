// World: axis-aligned box colliders in a spatial hash, character physics, raycasts,
// and the builder API that map definitions use.
(() => {
'use strict';
const W = G.world = { boxes: [], group: null, pads: [], teles: [], updaters: [], bounds: null, killY: -20, def: null, time: 0 };
const CELL = 4;
const hash = new Map();
let stamp = 0;
const key = (ix, iz) => (ix + 1000) * 4000 + (iz + 1000);

W.clear = () => {
  if (W.group) {
    G.scene.remove(W.group);
    W.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  W.group = new THREE.Group(); G.scene.add(W.group);
  W.boxes = []; hash.clear(); W.pads = []; W.teles = []; W.updaters = []; W.time = 0;
};
W.addCollider = b => {
  b.q = 0; W.boxes.push(b);
  for (let ix = Math.floor(b.minX / CELL); ix <= Math.floor(b.maxX / CELL); ix++)
    for (let iz = Math.floor(b.minZ / CELL); iz <= Math.floor(b.maxZ / CELL); iz++) {
      const k = key(ix, iz); let l = hash.get(k); if (!l) hash.set(k, l = []); l.push(b);
    }
};
// Candidate boxes overlapping an XZ rectangle. `out` is reused by the caller.
W.query = (minX, minZ, maxX, maxZ, out) => {
  stamp++; out.length = 0;
  for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++)
    for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) {
      const l = hash.get(key(ix, iz)); if (!l) continue;
      for (let i = 0; i < l.length; i++) { const b = l[i]; if (b.q !== stamp) { b.q = stamp; out.push(b); } }
    }
  return out;
};
const HB = [];
W.boxHit = (minX, minY, minZ, maxX, maxY, maxZ) => {
  const l = W.query(minX, minZ, maxX, maxZ, HB);
  for (let i = 0; i < l.length; i++) {
    const b = l[i];
    if (b.minX < maxX && b.maxX > minX && b.minY < maxY && b.maxY > minY && b.minZ < maxZ && b.maxZ > minZ) return b;
  }
  return null;
};

// ---------- character physics ----------
// A body is { pos, vel, r, h, grounded, ground }. pos is the feet centre.
const QA = [], QV = [];
function overlaps(p, r, h, b) {
  return p.x - r < b.maxX && p.x + r > b.minX && p.z - r < b.maxZ && p.z + r > b.minZ && p.y < b.maxY && p.y + h > b.minY;
}
function moveH(a, ax, d) {
  if (d === 0) return;
  const p = a.pos, r = a.r;
  p[ax] += d;
  const l = W.query(p.x - r, p.z - r, p.x + r, p.z + r, QA);
  for (let i = 0; i < l.length; i++) {
    const b = l[i];
    if (!overlaps(p, r, a.h, b)) continue;
    const rise = b.maxY - p.y;
    if (rise <= G.STEP && (a.grounded || rise < 0.3) && !W.boxHit(p.x - r, b.maxY + 0.001, p.z - r, p.x + r, b.maxY + a.h, p.z + r)) {
      p.y = b.maxY; continue;
    }
    if (ax === 'x') p.x = d > 0 ? b.minX - r - 1e-4 : b.maxX + r + 1e-4;
    else p.z = d > 0 ? b.minZ - r - 1e-4 : b.maxZ + r + 1e-4;
    a.vel[ax] = 0; a.hitWall = true;
  }
}
function moveV(a, d) {
  const p = a.pos, r = a.r;
  p.y += d; a.grounded = false; a.ground = null;
  const l = W.query(p.x - r, p.z - r, p.x + r, p.z + r, QV);
  for (let i = 0; i < l.length; i++) {
    const b = l[i];
    if (!overlaps(p, r, a.h, b)) continue;
    if (d <= 0) {
      if (b.maxY - p.y > 1.2) continue; // deep overlap from the side, let horizontal resolve it
      p.y = b.maxY; a.grounded = true; a.ground = b; if (a.vel.y < 0) a.vel.y = 0;
    } else { p.y = b.minY - a.h - 1e-4; if (a.vel.y > 0) a.vel.y = 0; }
  }
}
G.moveBody = (a, dt) => {
  const v = a.vel;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v.x), Math.abs(v.z), Math.abs(v.y)) * dt / 0.25));
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    v.y -= G.GRAV * G.mod.grav * sdt; if (v.y < -45) v.y = -45;
    moveH(a, 'x', v.x * sdt); moveH(a, 'z', v.z * sdt); moveV(a, v.y * sdt);
  }
};
G.bodyStuck = a => W.boxHit(a.pos.x - a.r, a.pos.y + 0.02, a.pos.z - a.r, a.pos.x + a.r, a.pos.y + a.h, a.pos.z + a.r);

// Ray vs boxes. Returns the hit distance or maxD.
const QR = [];
G.raycast = (o, d, maxD) => {
  const ex = o.x + d.x * maxD, ez = o.z + d.z * maxD;
  const l = W.query(Math.min(o.x, ex), Math.min(o.z, ez), Math.max(o.x, ex), Math.max(o.z, ez), QR);
  let best = maxD;
  for (let i = 0; i < l.length; i++) {
    const b = l[i]; if (b.noRay) continue;
    let tmin = 0, tmax = best, miss = false;
    for (const ax of ['x', 'y', 'z']) {
      const mn = ax === 'x' ? b.minX : ax === 'y' ? b.minY : b.minZ, mx = ax === 'x' ? b.maxX : ax === 'y' ? b.maxY : b.maxZ;
      if (Math.abs(d[ax]) < 1e-8) { if (o[ax] < mn || o[ax] > mx) { miss = true; break; } continue; }
      let t1 = (mn - o[ax]) / d[ax], t2 = (mx - o[ax]) / d[ax];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
      if (tmin > tmax) { miss = true; break; }
    }
    if (!miss && tmin < best) best = tmin;
  }
  return best;
};
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
G.los = (a, b, ha = 1.3, hb = 1.3) => {
  _o.set(a.x, a.y + ha, a.z); _d.set(b.x - a.x, b.y + hb - a.y - ha, b.z - a.z);
  const len = _d.length(); if (len < 0.01) return true; _d.divideScalar(len);
  return G.raycast(_o, _d, len) >= len - 0.05;
};

// ---------- builder ----------
const B = G.B = {};
B.box = (cx, y0, cz, w, h, d, mat, o = {}) => {
  let mesh = null, col = null;
  if (mat) {
    mesh = new THREE.Mesh(G.boxGeo(w, h, d, o.tile || 2), mat);
    mesh.position.set(cx, y0 + h / 2, cz);
    mesh.castShadow = o.shadow !== false; mesh.receiveShadow = true;
    W.group.add(mesh);
  }
  if (o.collide !== false) {
    col = { minX: cx - w / 2, maxX: cx + w / 2, minY: y0, maxY: y0 + h, minZ: cz - d / 2, maxZ: cz + d / 2, type: o.type || 'solid', launch: o.launch || null, noRay: !!o.noRay };
    W.addCollider(col);
  }
  return { mesh, col };
};
B.deco = obj => { W.group.add(obj); return obj; };
B.mesh = (geo, mat, x, y, z, shadow = true) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; W.group.add(m); return m;
};
B.update = fn => W.updaters.push(fn);
// Jump pad: launches anyone who lands on it.
B.pad = (x, y, z, dx, dz, up = 18, fwd = 8, color = 0x5cff8a) => {
  const launch = new THREE.Vector3(dx * fwd, up, dz * fwd);
  const { col } = B.box(x, y, z, 2.2, 0.3, 2.2, G.mat('metal', 0x50586a), { type: 'pad', launch });
  const discMat = new THREE.MeshBasicMaterial({ color });
  const disc = B.mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 24), discMat, x, y + 0.33, z, false);
  // arrow showing the launch direction
  if (dx || dz) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0.55); sh.lineTo(0.4, 0.05); sh.lineTo(0.15, 0.05); sh.lineTo(0.15, -0.5); sh.lineTo(-0.15, -0.5); sh.lineTo(-0.15, 0.05); sh.lineTo(-0.4, 0.05);
    const ar = B.mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0x1b3a26 }), x, y + 0.37, z, false);
    ar.rotation.set(-Math.PI / 2, 0, Math.atan2(-dx, -dz));
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
  glow.scale.set(2.6, 2.6, 1); glow.position.set(x, y + 0.6, z); W.group.add(glow);
  const ph = Math.random() * 6;
  B.update(t => { const s = 0.5 + Math.sin(t * 5 + ph) * 0.2; glow.material.opacity = s; });
  W.pads.push({ x, y: y + 0.3, z, launch, col });
};
// Teleporter pair.
B.tele = (ax, ay, az, bx, by, bz, color = 0xb36bff) => {
  for (const [x, y, z] of [[ax, ay, az], [bx, by, bz]]) {
    B.box(x, y, z, 2.4, 0.15, 2.4, G.mat('metal', 0x2a2440), { shadow: false });
    const ring = B.mesh(new THREE.TorusGeometry(0.95, 0.12, 8, 28), new THREE.MeshBasicMaterial({ color }), x, y + 0.25, z, false);
    ring.rotation.x = Math.PI / 2;
    const swirl = B.mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }), x, y + 0.2, z, false);
    swirl.rotation.x = -Math.PI / 2;
    const beam = B.mesh(new THREE.CylinderGeometry(0.9, 0.9, 3, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), x, y + 1.6, z, false);
    B.update(t => { ring.position.y = y + 0.25 + Math.sin(t * 3) * 0.08; beam.material.opacity = 0.12 + Math.sin(t * 4) * 0.05; swirl.rotation.z = t * 2; });
  }
  W.teles.push({ a: new THREE.Vector3(ax, ay + 0.15, az), b: new THREE.Vector3(bx, by + 0.15, bz) });
};

G.buildMap = def => {
  W.clear();
  W.def = def; W.bounds = def.bounds; W.killY = def.killY !== undefined ? def.killY : -20;
  const g = W.group;
  const hemi = new THREE.HemisphereLight(def.hemi[0], def.hemi[1], def.hemi[2]); g.add(hemi);
  const sun = new THREE.DirectionalLight(def.sun[0], def.sun[1]);
  sun.position.set(28, 55, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = -42; c.right = 42; c.top = 42; c.bottom = -42; c.near = 1; c.far = 160;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  g.add(sun); g.add(sun.target);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 12), new THREE.MeshBasicMaterial({ map: G.skyTex(def.sky[0], def.sky[1]), side: THREE.BackSide, fog: false, depthWrite: false }));
  g.add(sky);
  G.scene.fog = new THREE.Fog(def.fog[0], def.fog[1], def.fog[2]);
  G.scene.background = new THREE.Color(def.sky[1]);
  def.build(B, W);
  if (def.walls !== false) {
    const b = def.bounds, h = 60;
    B.box((b.minX + b.maxX) / 2, -5, b.minZ - 1, b.maxX - b.minX + 4, h, 2, null, { noRay: true });
    B.box((b.minX + b.maxX) / 2, -5, b.maxZ + 1, b.maxX - b.minX + 4, h, 2, null, { noRay: true });
    B.box(b.minX - 1, -5, (b.minZ + b.maxZ) / 2, 2, h, b.maxZ - b.minZ + 4, null, { noRay: true });
    B.box(b.maxX + 1, -5, (b.minZ + b.maxZ) / 2, 2, h, b.maxZ - b.minZ + 4, null, { noRay: true });
  }
  W.lava = G.lavaMats();
};
W.update = dt => {
  W.time += dt;
  for (const fn of W.updaters) fn(W.time, dt);
  for (const m of W.lava || []) { m.userData.flow.offset.x = W.time * 0.04; m.userData.flow.offset.y = Math.sin(W.time * 0.5) * 0.05; }
};
})();
