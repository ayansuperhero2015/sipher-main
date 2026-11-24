'use strict';
// Sketchfab assets (all CC BY, see CREDITS.md): weapon GLBs normalised to the game's gun frame
// (barrel along -z, grip near the origin, muzzle marker at the front), and a rigged android for every runner.
G.assets = {
  guns: {}, android: null, ready: false,
  // len: overall length in metres. flip: barrel points +z in the source. axis: source long axis.
  // keep: which half of a two-gun source to keep. my: muzzle height as a fraction of half-height. z: grip offset.
  GUNS: {
    ar: { file: 'ar', len: 0.78, pitch: 0.245, flip: true, axis: 'z', my: 0.2, z: 0.12 },
    br: { file: 'br', len: 0.88, flip: true, axis: 'z', my: 0.15, z: 0.12 },
    smg: { file: 'smg', len: 0.52, flip: true, axis: 'z', keep: 'neg', my: 0.25, z: 0.06 },
    sidearm: { file: 'sidearm', len: 0.27, flip: true, axis: 'z', my: 0.45, z: 0.02 },
    scatter: { file: 'scatter', len: 0.74, flip: true, axis: 'z', my: 0.25, z: 0.14 },
    rail: { file: 'rail', len: 1.02, flip: true, axis: 'x', my: 0.1, z: 0.18 },
    rocket: { file: 'rocket', len: 1.0, flip: true, axis: 'z', my: 0.1, z: 0.12 },
  },
  async load(progress) {
    const L = new TA.GLTFLoader(), ids = Object.keys(this.GUNS), total = ids.length + 1;
    let done = 0;
    const tick = () => progress && progress(++done / total);
    await Promise.all(ids.map(async id => {
      try { const g = await L.loadAsync('models/' + this.GUNS[id].file + '.glb'); this.guns[id] = this.prepGun(g.scene, this.GUNS[id]); }
      catch (e) { console.warn('gun model failed', id, e); }
      tick();
    }));
    try { const a = await L.loadAsync('models/android.glb'); this.android = this.prepAndroid(a.scene); }
    catch (e) { console.warn('android model failed', e); }
    tick();
    this.ready = true;
  },
  fixMats(root) {
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.metalness !== undefined) { m.metalness = Math.min(m.metalness, 0.65); m.roughness = Math.max(m.roughness ?? 0.5, 0.32); }
      }
    });
  },
  prepGun(scene, S) {
    scene.updateMatrixWorld(true);
    if (S.keep) {
      // source ships two guns side by side: keep the meshes on one side of the centre
      const b = new THREE.Box3().setFromObject(scene), cx = (b.min.x + b.max.x) / 2, kill = [];
      scene.traverse(o => { if (o.isMesh) { const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); if ((c.x < cx) !== (S.keep === 'neg')) kill.push(o); } });
      kill.forEach(o => o.parent.remove(o));
      scene.updateMatrixWorld(true);
    }
    const inner = new THREE.Group(); inner.add(scene);
    if (S.axis === 'x') inner.rotation.y = Math.PI / 2;
    if (S.flip) inner.rotation.y += Math.PI;
    inner.updateMatrixWorld(true);
    let b = new THREE.Box3().setFromObject(inner);
    const size = b.getSize(new THREE.Vector3());
    const k = S.len / size.z;
    inner.scale.setScalar(k); inner.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(inner);
    // the barrel is the slim end: if the -z end is taller than the back end, turn the gun around
    const ends = this.endHeights(inner, b);
    S.autoFlip = false; // orientation is set per gun in GUNS (checked by eye); ends kept for debugging
    if (S.autoFlip) { inner.rotation.y += Math.PI; inner.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(inner); }
    const c = b.getCenter(new THREE.Vector3());
    inner.position.sub(c); inner.position.z += S.z;
    const root = new THREE.Group(), piv = new THREE.Group(); piv.rotation.x = S.pitch || 0; piv.add(inner); root.add(piv);
    this.fixMats(root);
    const h = (b.max.y - b.min.y) / 2;
    root.userData.muzzleAt = new THREE.Vector3(0, h * S.my, -S.len / 2 + S.z - 0.02);
    return root;
  },
  endHeights(root, b) {
    const L = b.max.z - b.min.z, f0 = b.min.z + L * 0.18, b0 = b.max.z - L * 0.18, v = new THREE.Vector3();
    let fy0 = 1e9, fy1 = -1e9, by0 = 1e9, by1 = -1e9;
    root.traverse(o => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 4000));
      for (let i = 0; i < p.count; i += step) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        if (v.z < f0) { fy0 = Math.min(fy0, v.y); fy1 = Math.max(fy1, v.y); }
        else if (v.z > b0) { by0 = Math.min(by0, v.y); by1 = Math.max(by1, v.y); }
      }
    });
    return { front: Math.max(0, fy1 - fy0), back: Math.max(0, by1 - by0) };
  },
  // fresh copy of a normalised gun with a muzzle marker; accent tint goes on emissive bits only
  gun(id) {
    const src = this.guns[id]; if (!src) return null;
    const g = TA.SkeletonUtils.clone(src);
    const mz = new THREE.Object3D(); mz.position.copy(src.userData.muzzleAt); g.add(mz);
    g.userData.muzzle = mz;
    return g;
  },

  // ---------------------------------------------------------------- android
  // rest-pose data per bone (in the model's own frame, which faces +z): local rotation, parent world rotation, position
  prepAndroid(scene) {
    this.fixMats(scene);
    scene.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(scene);
    scene.userData.h = b.max.y - b.min.y;
    const rest = {};
    scene.traverse(o => {
      if (!o.isBone) return;
      const qp = new THREE.Quaternion(); if (o.parent) o.parent.getWorldQuaternion(qp);
      rest[o.name] = { q0: o.quaternion.clone(), qp, p: o.getWorldPosition(new THREE.Vector3()) };
    });
    scene.userData.rest = rest;
    return scene;
  },
};
