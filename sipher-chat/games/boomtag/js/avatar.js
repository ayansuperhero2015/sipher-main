// Avatar: a blocky six-part character with a hat, name tag, held-bomb slot,
// shield bubble, ice block and simple procedural animation.
(() => {
'use strict';
const U = 0.35;
const SKINS = [0xf5c99b, 0xe0a878, 0xc68642, 0x8d5524, 0xffdbac, 0xf1c27d, 0xffcc4d];
const PANTS = [0x2b2f3a, 0x3d5a80, 0x4a3b2a, 0x1f1f1f, 0x5b4b8a, 0x2f4f3f, 0x6b2b2b];
const FACES = {};
function faceTex(kind) {
  if (FACES[kind]) return FACES[kind];
  const c = document.createElement('canvas'); c.width = c.height = 32; const k = c.getContext('2d');
  k.fillStyle = '#000';
  if (kind === 0) { k.fillRect(9, 11, 4, 5); k.fillRect(19, 11, 4, 5); k.fillRect(10, 21, 12, 2); k.fillRect(8, 19, 2, 2); k.fillRect(22, 19, 2, 2); }
  else if (kind === 1) { k.fillRect(9, 12, 5, 3); k.fillRect(18, 12, 5, 3); k.fillRect(11, 21, 10, 3); }
  else if (kind === 2) { k.fillRect(10, 11, 3, 6); k.fillRect(19, 11, 3, 6); k.beginPath(); k.arc(16, 20, 5, 0, Math.PI); k.fill(); }
  else { k.fillRect(8, 13, 6, 2); k.fillRect(18, 13, 6, 2); k.fillRect(12, 22, 8, 2); k.fillRect(20, 20, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return (FACES[kind] = t);
}
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
function limb(w, h, d, mat, x, y) {
  const piv = new THREE.Group(); piv.position.set(x, y, 0);
  const m = box(w, h, d, mat); m.position.y = -h / 2; m.castShadow = true; piv.add(m);
  piv.userData.mesh = m; return piv;
}
const lam = c => new THREE.MeshLambertMaterial({ color: c });

G.makeHat = (kind, hs) => {
  const g = new THREE.Group(); let spin = null;
  const M = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  if (kind === 'cone') {
    const o = lam(0xff7a1a), w = lam(0xffffff);
    M(new THREE.BoxGeometry(0.52, 0.05, 0.52), o, 0, hs + 0.025, 0);
    M(new THREE.ConeGeometry(0.24, 0.6, 16), o, 0, hs + 0.33, 0);
    M(new THREE.CylinderGeometry(0.135, 0.17, 0.09, 16), w, 0, hs + 0.3, 0);
  } else if (kind === 'tophat') {
    const b = lam(0x16161c);
    M(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 24), b, 0, hs + 0.015, 0);
    M(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 20), b, 0, hs + 0.23, 0);
    M(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 20), lam(0xd23a3a), 0, hs + 0.08, 0);
  } else if (kind === 'horns') {
    const r = lam(0xd8222a);
    for (const s of [-1, 1]) { const m = M(new THREE.ConeGeometry(0.07, 0.26, 8), r, s * 0.15, hs + 0.1, 0.02); m.rotation.z = -s * 0.45; }
  } else if (kind === 'halo') {
    const m = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    spin = M(new THREE.TorusGeometry(0.2, 0.035, 8, 24), m, 0, hs + 0.3, 0); spin.rotation.x = Math.PI / 2; spin.userData.bob = true;
  } else if (kind === 'propeller') {
    const cap = M(new THREE.SphereGeometry(0.235, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0x3c8cff), 0, hs - 0.02, 0);
    cap.scale.y = 0.8;
    M(new THREE.BoxGeometry(0.3, 0.03, 0.18), lam(0xff4b42), 0, hs, 0.25);
    M(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6), lam(0x888888), 0, hs + 0.22, 0);
    spin = new THREE.Group(); spin.position.y = hs + 0.3; g.add(spin);
    for (const [c, r] of [[0xffd23f, 0], [0x4fd65a, Math.PI]]) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.015, 0.08), lam(c)); bl.position.x = Math.cos(r) * 0.2; spin.add(bl); }
    spin.userData.spinY = 18;
  } else if (kind === 'crown') {
    const gold = new THREE.MeshLambertMaterial({ color: 0xffc928, emissive: 0x403000, side: THREE.DoubleSide });
    M(new THREE.CylinderGeometry(0.23, 0.23, 0.14, 8, 1, true), gold, 0, hs + 0.07, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; M(new THREE.ConeGeometry(0.05, 0.14, 4), gold, Math.cos(a) * 0.21, hs + 0.2, Math.sin(a) * 0.21); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; M(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: [0xff3355, 0x33aaff, 0x44ff66, 0xaa55ff][i] }), Math.cos(a) * 0.235, hs + 0.07, Math.sin(a) * 0.235); }
  }
  g.userData.spin = spin;
  return g;
};

G.makeBombMesh = () => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), new THREE.MeshStandardMaterial({ color: 0x1c1c24, roughness: 0.3, metalness: 0.35, emissive: 0xff2200, emissiveIntensity: 0 }));
  body.castShadow = true; g.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0x8a8a96, metalness: 0.7, roughness: 0.3 }));
  cap.position.y = 0.36; g.add(cap);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.26, 6), lam(0xc8a46a));
  fuse.position.set(0.04, 0.52, 0); fuse.rotation.z = -0.3; g.add(fuse);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex(), color: 0xffc94a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  spark.scale.set(0.5, 0.5, 1); spark.position.set(0.09, 0.66, 0); g.add(spark);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
  shine.position.set(-0.14, 0.16, 0.26); g.add(shine);
  g.userData = { body, spark };
  return g;
};

G.makeAvatar = (o) => {
  const skin = lam(o.skin || G.pick(SKINS));
  const shirt = lam(o.shirt);
  const pants = lam(o.pants || G.pick(PANTS));
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const legY = 2 * U;
  const torso = box(2 * U, 2 * U, U, shirt); torso.position.y = legY + U; torso.castShadow = true; body.add(torso);
  const headG = new THREE.Group(); headG.position.y = legY + 2 * U; body.add(headG);
  const hs = 1.2 * U;
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTex(o.face !== undefined ? o.face : G.randi(0, 3)), transparent: true });
  const head = box(hs, hs, hs, skin); head.position.y = hs / 2; head.castShadow = true; headG.add(head);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(hs * 0.98, hs * 0.98), faceMat); face.position.set(0, hs / 2, hs / 2 + 0.002); headG.add(face);
  const armL = limb(U, 2 * U, U, skin, -1.5 * U, legY + 2 * U), armR = limb(U, 2 * U, U, skin, 1.5 * U, legY + 2 * U);
  for (const a of [armL, armR]) { const s = box(U * 1.04, U * 0.9, U * 1.04, shirt); s.position.y = -U * 0.45; a.add(s); }
  const legL = limb(U, 2 * U, U, pants, -0.5 * U, legY), legR = limb(U, 2 * U, U, pants, 0.5 * U, legY);
  body.add(armL, armR, legL, legR);
  const hat = G.makeHat(o.hat || 'none', hs); headG.add(hat);
  // bomb held above the head + red warning ring on the ground
  const bomb = G.makeBombMesh(); bomb.position.y = legY + 2 * U + hs + 0.62; bomb.visible = false; root.add(bomb);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 32), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.visible = false; root.add(ring);
  // shield bubble
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), new THREE.MeshBasicMaterial({ color: 0x58b7ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  bubble.position.y = 1.0; bubble.visible = false; root.add(bubble);
  // ice block when frozen
  const ice = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 1.2), new THREE.MeshLambertMaterial({ color: 0xaee4ff, transparent: true, opacity: 0.55, emissive: 0x1a4a6a }));
  ice.position.y = 1.0; ice.visible = false; root.add(ice);
  // name tag
  const tagC = document.createElement('canvas'); tagC.width = 256; tagC.height = 48;
  const tagT = new THREE.CanvasTexture(tagC); tagT.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagT, depthTest: true, transparent: true }));
  tag.scale.set(1.9, 0.36, 1); tag.position.y = legY + 2 * U + hs + 0.42; root.add(tag);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.025; root.add(sh);
  const fadeMats = [skin, shirt, pants, faceMat];
  hat.traverse(m => { if (m.material && !fadeMats.includes(m.material)) fadeMats.push(m.material); });
  bomb.traverse(m => { if (m.material && !fadeMats.includes(m.material)) fadeMats.push(m.material); });
  const baseOp = new Map(fadeMats.map(m => [m, m.opacity]));
  const av = {
    root, body, headG, armL, armR, legL, legR, bomb, ring, bubble, ice, tag, hat, shadow: sh,
    parts: [head, torso, armL.userData.mesh, armR.userData.mesh, legL.userData.mesh, legR.userData.mesh],
    walk: 0, op: 1, t: Math.random() * 10, cheer: 0,
    setOpacity(op) {
      if (Math.abs(op - this.op) < 0.01) return;
      this.op = op;
      for (const m of fadeMats) { m.transparent = op < 1 || m === faceMat || baseOp.get(m) < 1; m.opacity = baseOp.get(m) * op; m.depthWrite = op >= 1; m.needsUpdate = true; }
      sh.visible = op > 0.5; tag.visible = op > 0.5;
    },
    drawTag(name, hasBomb, isPlayer) {
      const k = tagC.getContext('2d'); k.clearRect(0, 0, 256, 48);
      k.font = '900 26px Nunito, sans-serif'; k.textAlign = 'center';
      k.font = '700 28px "Barlow Condensed", sans-serif';
      const label = name.toUpperCase();
      const tw = k.measureText(label).width, ic = hasBomb ? 30 : 0;
      const w = Math.min(252, tw + 20 + ic);
      k.fillStyle = hasBomb ? '#e8261c' : 'rgba(18,18,18,0.72)';
      k.fillRect(128 - w / 2, 4, w, 38);
      if (hasBomb) G.drawIcon(k, 'bomb', 128 - w / 2 + 8, 11, 24, '#ffffff');
      k.fillStyle = isPlayer && !hasBomb ? '#ffd400' : '#ffffff'; k.fillText(label, 128 + ic / 2, 33);
      tagT.needsUpdate = true;
    },
    setBomb(on) { bomb.visible = on; ring.visible = on; },
    animate(dt, speed, grounded, a) {
      this.t += dt;
      this.walk += dt * speed * 2.4;
      const amp = Math.min(1, speed / 4) * 0.9;
      const s = Math.sin(this.walk) * amp;
      legL.rotation.x = s; legR.rotation.x = -s;
      armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.8;
      armL.rotation.z = 0; armR.rotation.z = 0;
      if (bomb.visible) { armL.rotation.x = Math.PI - 0.15; armR.rotation.x = Math.PI - 0.15; armL.rotation.z = -0.25; armR.rotation.z = 0.25; }
      if (this.cheer > 0) { this.cheer = Math.max(0, this.cheer - dt); const w = Math.sin(this.t * 14) * 0.4; armL.rotation.x = Math.PI + w; armR.rotation.x = Math.PI - w; }
      if (!grounded) { legL.rotation.x = 0.45; legR.rotation.x = -0.25; }
      body.position.y = 0;
      if (a && a.fx.frozen > 0) { legL.rotation.x = legR.rotation.x = 0; }
      // bomb pulses faster as the fuse runs out
      if (bomb.visible) {
        const urgency = G.match && G.match.maxFuse ? 1 - G.clamp(G.match.fuse / G.match.maxFuse, 0, 1) : 0;
        const p = Math.sin(this.t * (6 + urgency * 26)) * 0.5 + 0.5;
        const sc = 1 + p * (0.05 + urgency * 0.14);
        bomb.scale.setScalar(sc);
        bomb.position.y = legY + 2 * U + hs + 0.62 + Math.sin(this.t * 5) * 0.04;
        bomb.userData.body.material.emissiveIntensity = p * (0.2 + urgency * 1.6);
        const sp = bomb.userData.spark; sp.scale.setScalar(0.35 + Math.random() * 0.3); sp.material.rotation = Math.random() * 6;
        ring.material.opacity = 0.45 + p * 0.45; ring.scale.setScalar(1 + p * 0.15);
      }
      const spin = hat.userData.spin;
      if (spin) { if (spin.userData.spinY) spin.rotation.y += dt * spin.userData.spinY; if (spin.userData.bob) spin.position.y = hs + 0.3 + Math.sin(this.t * 3) * 0.03; }
      if (bubble.visible) { bubble.material.opacity = 0.16 + Math.sin(this.t * 5) * 0.06; bubble.rotation.y += dt; }
    }
  };
  return av;
};
})();
