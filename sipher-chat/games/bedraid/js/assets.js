// Assets: Sketchfab GLB models (embedded as base64 in models/*.js so file:// works).
(() => {
'use strict';
const V3 = G.V3;
const AS = G.assets = { models: {} };
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
  G.GLB = null;
};
// A ready-to-place copy: feet on y=0, centred, scaled to `height` (or fitted inside a box).
G.model = (name, height, o = {}) => {
  const a = AS.models[name];
  if (!a) return null;
  const inner = window.SkeletonUtils.clone(a.scene);
  const clone = new THREE.Group(); clone.add(inner);
  if (o.rotY) inner.rotation.y = o.rotY;
  if (o.rotX) inner.rotation.x = o.rotX;
  if (o.rotZ) inner.rotation.z = o.rotZ;
  clone.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(clone), size = box.getSize(new V3());
  const s = o.fit ? Math.min(o.fit[0] / size.x, o.fit[1] / size.y, o.fit[2] / size.z) : height / Math.max(size.y, 1e-4);
  clone.scale.multiplyScalar(s);
  clone.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(clone);
  const c = box.getCenter(new V3());
  clone.position.x -= c.x; clone.position.z -= c.z; clone.position.y -= o.center ? c.y : box.min.y;
  clone.traverse(m => {
    if (!m.isMesh) return;
    m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    // there is no environment map, so metallic Sketchfab materials would render black
    if (m.material && m.material.metalness > 0.2) { m.material = m.material.clone(); m.material.metalness = 0.1; m.material.roughness = Math.max(0.5, m.material.roughness); }
    if (o.tint || o.lambert) {
      const old = m.material;
      m.material = old.clone();
      if (o.tint) { const f = typeof o.tint === 'function' ? o.tint(m, old) : o.tint; if (f !== undefined && f !== null) { m.material.color = new THREE.Color(f); if (m.material.map && o.dropMap) m.material.map = null; } }
    }
  });
  const g = new THREE.Group(); g.add(clone);
  if (a.animations && a.animations.length && o.anim) {
    const mixer = new THREE.AnimationMixer(inner);
    const act = mixer.clipAction(a.animations[0]); act.play(); act.paused = !!o.paused;
    g.userData.mixer = mixer; g.userData.action = act; g.userData.clip = a.animations[0];
  }
  return g;
};
})();
