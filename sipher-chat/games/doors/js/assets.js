// Assets: Sketchfab GLB models (embedded as base64 in models/*.js so file:// works),
// normalised to game scale, animated, and swapped in for the procedural stand-ins.
(() => {
'use strict';
const V3 = THREE.Vector3;
const AS = G.assets = { models: {}, mixers: [] };

AS.loadAll = async () => {
  const loader = new window.GLTFLoader();
  const names = Object.keys(G.GLB || {});
  await Promise.all(names.map(name => new Promise(res => {
    try {
      const bin = atob(G.GLB[name]), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      loader.parse(buf.buffer, '', gltf => { AS.models[name] = gltf; res(); }, err => { console.warn('model failed', name, err); res(); });
    } catch (e) { console.warn('model failed', name, e); res(); }
  })));
  G.GLB = null; // free the base64 strings
};

// A ready-to-place copy of a model: feet on y=0, centred, scaled to `height` (or fitted to a box).
G.assetModel = (name, height, o = {}) => {
  const a = AS.models[name];
  if (!a) return null;
  const clone = window.SkeletonUtils.clone(a.scene);
  if (o.rotY) clone.rotation.y = o.rotY;
  if (o.rotX) clone.rotation.x = o.rotX;
  clone.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(clone), size = box.getSize(new V3());
  const s = o.fit ? Math.min(o.fit[0] / size.x, o.fit[1] / size.y, o.fit[2] / size.z) : height / Math.max(size.y, 1e-4);
  clone.scale.multiplyScalar(s);
  clone.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(clone);
  const c = box.getCenter(new V3());
  clone.position.x -= c.x; clone.position.z -= c.z; clone.position.y -= box.min.y;
  clone.traverse(m => { if (m.isMesh) { m.frustumCulled = false; if (m.material && o.rough !== undefined) m.material.roughness = o.rough; } });
  const g = new THREE.Group(); g.add(clone);
  if (a.animations && a.animations.length && o.anim !== false) {
    const mixer = new THREE.AnimationMixer(clone);
    const clip = (o.clip && a.animations.find(c2 => o.clip.test(c2.name))) || a.animations[0];
    const act = mixer.clipAction(clip); act.play();
    g.userData.mixer = mixer; g.userData.action = act;
    AS.mixers.push({ mixer, root: g });
  }
  // Dummies so entity code written for the procedural rigs keeps working.
  const dummy = new THREE.Object3D();
  g.userData.limbs = []; g.userData.head = dummy; g.userData.body = new THREE.Object3D(); g.userData.drips = [];
  g.userData.face = { material: { rotation: 0 } };
  g.userData.asset = true;
  return g;
};
const inScene = o => { while (o) { if (o === G.scene) return true; o = o.parent; } return false; };
AS.update = dt => {
  AS.mixers = AS.mixers.filter(m => {
    if (!inScene(m.root)) { if (m.root.parent === null && m._seen) return false; return true; }
    m._seen = true; m.mixer.update(dt * (m.root.userData.speed || 1)); return true;
  });
  viewmodel(dt);
};

/* ---------- swap in the models ---------- */
// Only props and the Cobbler use downloaded models. The entity downloads were tested and rejected:
// the Figure's Mixamo rig renders at the wrong scale, Seek's materials import purple,
// Honcho and Creak are frozen T-poses, and Screech imports lying on its side.

// Closets use the real DOORS wardrobe.
const F = G.furn, closet0 = F.closet;
F.closet = (room, g) => {
  const m = G.assetModel('closet', 0, { fit: [1.3, 2.4, 0.95], rotY: -Math.PI / 2 }); // doors face into the room
  if (!m) return closet0(room, g);
  m.position.set(0, 0, 0.47); g.add(m);
  room.addCol(0, 1.2, 0.45, 1.3, 2.4, 0.9, g);
  const fwd = g.localToWorld(new V3(0, 0, 1)).sub(g.localToWorld(new V3(0, 0, 0)));
  const spot = { kind: 'closet', room, doors: [m], in: g.localToWorld(new V3(0, 0, 0.45)), out: g.localToWorld(new V3(0, 0, 1.4)), yaw: G.yawFromDir(fwd.x, fwd.z), jack: G.chance(0.025) };
  room.hides.push(spot);
  room.addInter(g.localToWorld(new V3(0, 1.3, 1.0)), () => (G.player.hiding ? null : 'Hide'), () => G.game.hide(spot), 2.1);
};
F.closet.w = closet0.w; F.closet.d = closet0.d;

// Keys use the DOORS key model.
const kp0 = F.keyPickup;
F.keyPickup = (room, parent, x, y, z) => {
  const it = kp0(room, parent, x, y, z);
  const m = G.assetModel('key', 0, { fit: [0.22, 0.22, 0.22] });
  if (m && it.obj) { it.obj.clear(); m.rotation.x = -Math.PI / 2; it.obj.add(m); }
  return it;
};

/* ---------- the real DOORS lobby as room 0 ---------- */
// Turn a static model into blocking boxes: sample its triangles at body height into a grid
// (room-local), then merge each row's filled cells into one collider.
function rasterColliders(room, root, o = {}) {
  const cs = 0.35, { xl, xr, L, H } = room;
  const x0 = xl - 4, z0 = -4, nx = Math.ceil((xr - xl + 8) / cs), nz = Math.ceil((L + 8) / cs);
  const grid = new Uint8Array(nx * nz);
  root.updateMatrixWorld(true); room.group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(room.group.matrixWorld).invert(), m = new THREE.Matrix4();
  const a = new V3(), b = new V3(), c = new V3();
  root.traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible || (o.skip && o.skip.test(mesh.material.name))) return;
    m.multiplyMatrices(inv, mesh.matrixWorld);
    const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index, n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      a.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m);
      b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(m);
      c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(m);
      if (Math.max(a.y, b.y, c.y) < 0.35 || Math.min(a.y, b.y, c.y) > 1.7) continue;
      const steps = Math.min(50, Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), a.distanceTo(c)) / 0.15)));
      for (let u = 0; u <= steps; u++) for (let v = 0; v <= steps - u; v++) {
        const w = steps - u - v, py = (a.y * u + b.y * v + c.y * w) / steps;
        if (py < 0.35 || py > 1.7) continue;
        const gi = Math.floor(((a.x * u + b.x * v + c.x * w) / steps - x0) / cs), gj = Math.floor(((a.z * u + b.z * v + c.z * w) / steps - z0) / cs);
        if (gi >= 0 && gj >= 0 && gi < nx && gj < nz) grid[gj * nx + gi] = 1;
      }
    }
  });
  for (const [ax0, ax1, az0, az1] of o.clear || []) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const cx = x0 + (i + 0.5) * cs, cz = z0 + (j + 0.5) * cs;
      if (cx > ax0 && cx < ax1 && cz > az0 && cz < az1) grid[j * nx + i] = 0;
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      if (!grid[j * nx + i]) continue;
      let e = i; while (e + 1 < nx && grid[j * nx + e + 1]) e++;
      room.addCol(x0 + (i + e + 1) / 2 * cs, H / 2, z0 + (j + 0.5) * cs, (e - i + 1) * cs, H, cs);
      i = e;
    }
  }
}
const rec0 = G.SP.reception;
G.SP.reception = (game, at) => {
  const gl = AS.models.lobby;
  if (!gl) return rec0(game, at);
  // Model units -> metres: the real lobby door is 7.8 units tall, ours is G.DH.
  const s = G.DH / 7.8, ox = 16.3 * s, oz = 22.6 * s;
  const xl = -18 * s, xr = 38 * s, L = 53.6 * s, H = 16 * s;
  const th = G.THEMES.hotel();
  const r = new G.Room(game, { index: 0, origin: at.origin, dir: at.dir, xl, xr, L, H, theme: th });
  r.exits = [{ side: 'front', pos: 0, real: true }];
  const before = r.group.children.length;
  r.shell({ noBackGap: true });
  r.group.children.slice(before).forEach(o => { o.visible = false; }); // the model provides the visuals
  r.makeExit(r.exits[0], { number: 1, locked: true });
  const holder = new THREE.Group();
  holder.rotation.y = -Math.PI / 2; holder.scale.setScalar(s); holder.position.set(ox, 25.4 * s, oz);
  const model = gl.scene.clone(true);
  model.traverse(o => {
    if (!o.isMesh) return;
    if (o.material.name === 'Door1Mtl') o.visible = false; // our working door replaces it
    if (o.material.name === 'Floor4Mtl') { o.material = o.material.clone(); o.material.color.setHex(0x3a2a2a); r.mats.push(o.material); }
  });
  holder.add(model); r.group.add(holder);
  // keep the exit, the spawn by the elevator and the walkway clear
  rasterColliders(r, holder, { skip: /Door1Mtl|Lightfixture|Neon|Lines|Web|Ink|Sticker|Carpet|Floor/, clear: [[-1.2, 1.2, L - 2, L + 1], [3.2, 6.2, 0.2, 2.6]] });
  for (const [x, z] of [[-1, 4.5], [7, 4.5], [-1, 11.5], [7, 11.5]]) r.lamp(x, H - 0.8, z, { type: 'none', intensity: 26, dist: 17 });
  // door 1's key hangs on the key holder beside the exit, like the real lobby
  G.furn.keyPickup(r, r.group, 8.66, 1.55, L - 0.2);
  r.spawnLocal = [4.65, 1.4];
  return r.finish();
};

/* ---------- held crucifix ---------- */
let vm = null;
function viewmodel(dt) {
  const g = G.game, sel = g.inv && g.inv.selected();
  const want = g.state === 'play' && sel && sel.id === 'crucifix' && !G.player.hiding;
  if (want && !vm) {
    vm = G.assetModel('crucifix', 0.32);
    if (!vm) return;
    vm.position.set(0.3, -0.34, -0.62); vm.rotation.set(0.15, -0.4, 0.1);
    vm.traverse(m => { if (m.isMesh) { m.renderOrder = 10; } });
    G.camera.add(vm);
  }
  if (vm) {
    vm.visible = !!want;
    const t = performance.now() / 1000, P = G.player;
    vm.position.y = -0.34 + Math.sin(P.bob) * 0.01 + Math.sin(t * 1.3) * 0.005;
  }
}
})();
