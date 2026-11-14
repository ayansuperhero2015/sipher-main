// FX: debris particles, bullet tracers, muzzle flashes, explosions and floating damage numbers.
(() => {
'use strict';
const MAXP = 500, parts = [], tracers = [], flashes = [], booms = [], nums = [];
let inst, pi = 0, ti = 0, fi = 0, numsEl;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), col = new THREE.Color(), v = new THREE.Vector3();

G.initFx = () => {
  inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), MAXP);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); inst.frustumCulled = false;
  m4.makeScale(0, 0, 0);
  for (let i = 0; i < MAXP; i++) { parts.push({ life: 0, max: 1, pos: new G.V3(), vel: new G.V3(), size: 0.1, grav: 1, rot: Math.random() * 6 }); inst.setMatrixAt(i, m4); inst.setColorAt(i, col.set(0xffffff)); }
  G.scene.add(inst);
  const tg = new THREE.BoxGeometry(1, 1, 1); tg.translate(0, 0, 0.5);
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.visible = false; m.frustumCulled = false; G.scene.add(m); tracers.push({ m, life: 0, max: 0.1 });
  }
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow, color: 0xffc860, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.visible = false; G.scene.add(s); flashes.push({ s, life: 0 });
  }
  numsEl = document.getElementById('nums');
};

G.spawnDebris = (pos, color, n, speed, spread = 0.5, size = 0.16, life = 0.9, grav = 1) => {
  col.set(color);
  for (let i = 0; i < n; i++) {
    const p = parts[pi];
    p.life = p.max = life * G.rand(0.6, 1.2); p.size = size * G.rand(0.6, 1.4); p.grav = grav;
    p.pos.set(pos.x + G.rand(-spread, spread), pos.y + G.rand(-spread, spread), pos.z + G.rand(-spread, spread));
    p.vel.set(G.rand(-1, 1), G.rand(-0.2, 1.3), G.rand(-1, 1)).multiplyScalar(speed);
    inst.setColorAt(pi, col); pi = (pi + 1) % MAXP;
  }
  inst.instanceColor.needsUpdate = true;
};
G.tracer = (from, to, color = 0xffe9a8, width = 0.035, life = 0.09) => {
  const t = tracers[ti]; ti = (ti + 1) % tracers.length;
  t.m.visible = true; t.m.position.copy(from); t.m.lookAt(to); t.m.scale.set(width, width, Math.max(0.1, from.distanceTo(to)));
  t.m.material.color.set(color); t.m.material.opacity = 0.9; t.life = t.max = life;
};
G.muzzle = (pos, size = 0.9) => {
  const f = flashes[fi]; fi = (fi + 1) % flashes.length;
  f.s.visible = true; f.s.position.copy(pos); f.s.scale.setScalar(size * G.rand(0.8, 1.2)); f.life = 0.05;
};
G.explode = (pos, radius) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(pos); G.scene.add(m);
  const l = new THREE.PointLight(0xff9040, 60, radius * 5); l.position.copy(pos); G.scene.add(l);
  booms.push({ m, l, life: 0.35, max: 0.35, r: radius });
  G.spawnDebris(pos, '#ffb040', 22, 9, 0.4, 0.2, 0.7);
  G.spawnDebris(pos, '#444444', 16, 6, 0.6, 0.26, 1.1, 0.4);
  G.audio.explode(pos);
};
G.elimFx = pos => {
  v.set(pos.x, pos.y + 1, pos.z);
  G.spawnDebris(v, '#6fd0ff', 40, 5, 0.5, 0.14, 1.2, -0.5);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(pos.x, pos.y + 20, pos.z); G.scene.add(m);
  booms.push({ m, l: null, life: 0.7, max: 0.7, r: 0, beam: true });
  G.audio.elim(pos);
};
// kind: 'hp' | 'shield' | 'head'
G.dmgNum = (pos, amount, kind) => {
  const el = document.createElement('div'); el.className = 'num ' + kind; el.textContent = amount;
  numsEl.appendChild(el);
  nums.push({ el, pos: new G.V3(pos.x + G.rand(-0.3, 0.3), pos.y + 2.1, pos.z + G.rand(-0.3, 0.3)), life: 0.9 });
};
G.clearFx = () => { for (const n of nums) n.el.remove(); nums.length = 0; };

G.fxUpdate = dt => {
  let dirty = false;
  for (let i = 0; i < MAXP; i++) {
    const p = parts[i]; if (p.life <= 0) continue;
    p.life -= dt; dirty = true;
    if (p.life <= 0) { m4.makeScale(0, 0, 0); inst.setMatrixAt(i, m4); continue; }
    p.vel.y -= 18 * p.grav * dt; p.pos.addScaledVector(p.vel, dt);
    if (p.pos.y < 0.05 && p.grav > 0) { p.pos.y = 0.05; p.vel.y *= -0.35; p.vel.x *= 0.6; p.vel.z *= 0.6; }
    p.rot += dt * 6; e.set(p.rot, p.rot * 0.7, 0); q.setFromEuler(e);
    const s = p.size * Math.min(1, p.life / p.max * 2.5); sc.set(s, s, s);
    m4.compose(p.pos, q, sc); inst.setMatrixAt(i, m4);
  }
  if (dirty) inst.instanceMatrix.needsUpdate = true;
  for (const t of tracers) if (t.life > 0) { t.life -= dt; t.m.material.opacity = Math.max(0, t.life / t.max) * 0.9; if (t.life <= 0) t.m.visible = false; }
  for (const f of flashes) if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.s.visible = false; }
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i]; b.life -= dt; const k = 1 - b.life / b.max;
    if (b.beam) { b.m.scale.set(1 - k * 0.9, 1, 1 - k * 0.9); b.m.material.opacity = 0.7 * (1 - k); }
    else { b.m.scale.setScalar(b.r * (0.3 + k * 0.8)); b.m.material.opacity = 0.85 * (1 - k); if (b.l) b.l.intensity = 60 * (1 - k); }
    if (b.life <= 0) { G.scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); if (b.l) G.scene.remove(b.l); booms.splice(i, 1); }
  }
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]; n.life -= dt; n.pos.y += dt * 1.3;
    if (n.life <= 0) { n.el.remove(); nums.splice(i, 1); continue; }
    v.copy(n.pos).project(G.camera);
    if (v.z > 1) { n.el.style.display = 'none'; continue; }
    n.el.style.display = ''; n.el.style.opacity = Math.min(1, n.life * 3);
    n.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%) scale(${1 + Math.max(0, n.life - 0.75) * 3})`;
  }
};
})();
