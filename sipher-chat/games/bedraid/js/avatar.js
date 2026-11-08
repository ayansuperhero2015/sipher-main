// Avatar: a blocky six-part character (head, torso, two arms, two legs) in team colours,
// with armour overlays, a held item, a name tag and simple procedural animation.
(() => {
'use strict';
const U = 0.35; // one "limb unit"
const SKINS = [0xf5c99b, 0xe0a878, 0xc68642, 0x8d5524, 0xffdbac, 0xf1c27d];
const PANTS = [0x2b2f3a, 0x3d5a80, 0x4a3b2a, 0x1f1f1f, 0x5b4b8a, 0x2f4f3f];
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
// A limb pivots from its top so rotation.x swings it.
function limb(w, h, d, mat, x, y) {
  const piv = new THREE.Group(); piv.position.set(x, y, 0);
  const m = box(w, h, d, mat); m.position.y = -h / 2; piv.add(m);
  piv.userData.mesh = m; return piv;
}
const ARMOR = { leather: null, chain: 0x9aa0a8, iron: 0xe6e6e6, diamond: 0x4fe3e0 };

G.makeAvatar = (o) => {
  const team = G.TEAMS[o.team];
  const skin = new THREE.MeshLambertMaterial({ color: o.skin || G.pick(SKINS) });
  const shirt = new THREE.MeshLambertMaterial({ color: team.color });
  const pants = new THREE.MeshLambertMaterial({ color: o.pants || G.pick(PANTS) });
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const legY = 2 * U;
  const torso = box(2 * U, 2 * U, U, shirt); torso.position.y = legY + U; body.add(torso);
  const headG = new THREE.Group(); headG.position.y = legY + 2 * U; body.add(headG);
  const hs = 1.2 * U;
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTex(o.face !== undefined ? o.face : G.randi(0, 3)), transparent: true });
  const head = box(hs, hs, hs, skin); head.position.y = hs / 2; headG.add(head);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(hs * 0.98, hs * 0.98), faceMat); face.position.set(0, hs / 2, hs / 2 + 0.002); headG.add(face);
  const armL = limb(U, 2 * U, U, skin, -1.5 * U, legY + 2 * U), armR = limb(U, 2 * U, U, skin, 1.5 * U, legY + 2 * U);
  // shirt sleeves
  for (const a of [armL, armR]) { const s = box(U * 1.02, U * 0.9, U * 1.02, shirt); s.position.y = -U * 0.45; a.add(s); }
  const legL = limb(U, 2 * U, U, pants, -0.5 * U, legY), legR = limb(U, 2 * U, U, pants, 0.5 * U, legY);
  body.add(armL, armR, legL, legR);
  // armour overlays (hidden until bought)
  const armorMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const ar = [];
  const chest = box(2 * U + 0.04, 2 * U * 0.75, U + 0.04, armorMat); chest.position.y = legY + U * 1.25; body.add(chest); ar.push(chest);
  for (const l of [legL, legR]) { const p = box(U + 0.04, 2 * U * 0.7, U + 0.04, armorMat); p.position.y = -U * 0.9; l.add(p); ar.push(p); }
  const boots = [legL, legR].map(l => { const p = box(U + 0.05, U * 0.5, U + 0.05, armorMat); p.position.y = -U * 1.75; l.add(p); return p; });
  ar.push(...boots);
  ar.forEach(m => { m.visible = false; });
  // held item in the right hand
  const hand = new THREE.Group(); hand.position.set(0, -2 * U + 0.05, U * 0.3); armR.add(hand);
  // name tag
  const tagC = document.createElement('canvas'); tagC.width = 256; tagC.height = 64;
  const tagT = new THREE.CanvasTexture(tagC); tagT.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagT, depthTest: true, transparent: true }));
  tag.scale.set(1.6, 0.4, 1); tag.position.y = legY + 2 * U + hs + 0.45; root.add(tag);
  // blob shadow
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; root.add(sh);
  const allMats = [skin, shirt, pants, armorMat, faceMat];
  const av = {
    root, body, headG, armL, armR, legL, legR, hand, tag, shadow: sh, held: null, heldId: null,
    walk: 0, swing: 0, hurt: 0, lastHp: -1, armorTier: 'leather',
    setArmor(tier) {
      this.armorTier = tier;
      const c = ARMOR[tier];
      ar.forEach(m => { m.visible = !!c; });
      if (c) armorMat.color.setHex(c);
    },
    drawTag(name, hp, maxHp, visible = true) {
      const k = tagC.getContext('2d'); k.clearRect(0, 0, 256, 64);
      k.font = '800 26px Nunito, sans-serif'; k.textAlign = 'center';
      const w = Math.min(250, k.measureText(name).width + 20);
      k.fillStyle = 'rgba(0,0,0,0.45)'; k.fillRect(128 - w / 2, 2, w, 34);
      k.fillStyle = team.css; k.fillText(name, 128, 28);
      k.fillStyle = 'rgba(0,0,0,0.55)'; k.fillRect(58, 44, 140, 12);
      const f = G.clamp(hp / maxHp, 0, 1);
      k.fillStyle = f > 0.5 ? '#5be05b' : f > 0.25 ? '#ffd23f' : '#ff4b42'; k.fillRect(60, 46, 136 * f, 8);
      tagT.needsUpdate = true; tag.visible = visible;
    },
    setHeld(id, mesh) {
      if (this.heldId === id) return;
      this.heldId = id;
      hand.clear();
      if (mesh) hand.add(mesh);
    },
    // speed = horizontal speed, onGround, dt
    animate(dt, speed, grounded, sneaking) {
      this.walk += dt * speed * 2.6;
      const amp = Math.min(1, speed / 4) * 0.9;
      const s = Math.sin(this.walk) * amp;
      legL.rotation.x = s; legR.rotation.x = -s;
      armL.rotation.x = -s * 0.8;
      if (this.swing > 0) {
        this.swing = Math.max(0, this.swing - dt * 4);
        const p = 1 - this.swing;
        armR.rotation.x = -Math.sin(p * Math.PI) * 1.8 - 0.3;
      } else armR.rotation.x = s * 0.8 - (this.heldId ? 0.35 : 0);
      if (!grounded) { legL.rotation.x = 0.4; legR.rotation.x = -0.2; }
      body.rotation.x = sneaking ? 0.35 : 0;
      body.position.y = sneaking ? -0.12 : 0;
      if (this.hurt > 0) {
        this.hurt = Math.max(0, this.hurt - dt * 3);
        const r = this.hurt;
        allMats.forEach(m => { if (m.emissive) m.emissive.setRGB(r * 0.7, 0, 0); });
      }
    },
    dispose() { root.traverse(m => { if (m.isMesh || m.isSprite) { if (m.geometry) m.geometry.dispose(); } }); }
  };
  return av;
};
})();
