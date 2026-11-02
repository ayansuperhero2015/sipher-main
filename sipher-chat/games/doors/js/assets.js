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
  const m = G.assetModel('closet', 0, { fit: [1.3, 2.4, 0.95], rotY: Math.PI / 2 });
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
