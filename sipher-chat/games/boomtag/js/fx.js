// FX: particles, rings, explosions and flying limbs.
(() => {
'use strict';
const F = G.fx = { parts: [], shake: 0 };
const cube = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(1, 10, 8);
const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
const mats = {};
const bmat = (c, add) => mats[c + '|' + add] || (mats[c + '|' + add] = new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));

function spawn(o) {
  const m = new THREE.Mesh(o.geo || cube, o.mat || bmat(o.color, o.add));
  m.position.copy(o.pos); m.scale.setScalar(o.size);
  if (o.rot) m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  G.scene.add(m);
  const p = { m, v: o.vel || new G.V3(), life: o.life, max: o.life, size: o.size, grow: o.grow || 0, grav: o.grav || 0, spin: o.spin || 0, fade: !!o.fade, drag: o.drag || 0, floor: o.floor };
  F.parts.push(p); return p;
}
F.burst = (pos, color, n = 12, speed = 5, size = 0.18, life = 0.7, grav = 12) => {
  if (G.fastSim) return;
  for (let i = 0; i < n; i++) {
    const v = new G.V3(G.rand(-1, 1), G.rand(-0.2, 1), G.rand(-1, 1)).normalize().multiplyScalar(speed * G.rand(0.5, 1.1));
    spawn({ pos, color, vel: v, size: size * G.rand(0.6, 1.3), life: life * G.rand(0.7, 1.2), grav, rot: true, spin: G.rand(-8, 8) });
  }
};
F.ring = (pos, color, r = 4, life = 0.45, y = 0.1) => {
  if (G.fastSim) return;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const p = spawn({ geo: ringGeo, mat, pos: new G.V3(pos.x, pos.y + y, pos.z), size: 0.3, life, grow: r / life, fade: true });
  p.m.rotation.x = -Math.PI / 2; p.ownMat = true;
};
F.trail = (pos, color) => {
  if (G.fastSim) return;
  spawn({ pos: new G.V3(pos.x + G.rand(-0.3, 0.3), pos.y + G.rand(0.3, 1.6), pos.z + G.rand(-0.3, 0.3)), color, size: 0.22, life: 0.35, rot: true, add: true });
};
F.puff = (pos, color = 0xffffff, n = 10) => {
  if (G.fastSim) return;
  for (let i = 0; i < n; i++) {
    spawn({ geo: sphere, pos: new G.V3(pos.x + G.rand(-0.5, 0.5), pos.y + G.rand(0.2, 1.6), pos.z + G.rand(-0.5, 0.5)), color, size: G.rand(0.2, 0.4),
      vel: new G.V3(G.rand(-1.5, 1.5), G.rand(0.5, 2), G.rand(-1.5, 1.5)), life: G.rand(0.4, 0.8), grow: 0.4, drag: 2 });
  }
};
F.explosion = (pos) => {
  F.shake = Math.max(F.shake, G.camera ? G.clamp(1.4 - G.camera.position.distanceTo(pos) / 40, 0.25, 1.2) : 1);
  if (G.fastSim) return;
  const c = new G.V3(pos.x, pos.y + 1.2, pos.z);
  const flash = spawn({ geo: sphere, mat: new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }), pos: c, size: 0.6, life: 0.35, grow: 14, fade: true });
  flash.ownMat = true;
  for (let i = 0; i < 46; i++) {
    const v = new G.V3(G.rand(-1, 1), G.rand(-0.3, 1.2), G.rand(-1, 1)).normalize().multiplyScalar(G.rand(5, 17));
    spawn({ pos: c, color: G.pick([0xff4a1a, 0xffa020, 0xffe14a, 0xff2a0a]), vel: v, size: G.rand(0.18, 0.5), life: G.rand(0.4, 1.0), grav: 14, rot: true, spin: G.rand(-10, 10), add: true });
  }
  for (let i = 0; i < 16; i++) {
    spawn({ geo: sphere, pos: new G.V3(c.x + G.rand(-1, 1), c.y + G.rand(-0.5, 1), c.z + G.rand(-1, 1)), color: G.pick([0x3a3a3a, 0x555555, 0x2a2a2a]),
      vel: new G.V3(G.rand(-2, 2), G.rand(1.5, 4), G.rand(-2, 2)), size: G.rand(0.5, 0.9), life: G.rand(1.0, 1.8), grow: 0.9, drag: 1.5 });
  }
  F.ring(pos, 0xffa040, 9, 0.5, 0.15);
  const light = new THREE.PointLight(0xff8a2a, 60, 22, 1.6); light.position.copy(c); G.scene.add(light);
  F.parts.push({ light, life: 0.5, max: 0.5 });
};
// Fling an avatar's limbs apart.
F.debris = (av, from) => {
  if (G.fastSim) return;
  av.root.updateMatrixWorld(true);
  for (const part of av.parts) {
    const m = part.clone();
    part.getWorldPosition(m.position); part.getWorldQuaternion(m.quaternion);
    m.scale.setScalar(1);
    G.scene.add(m);
    const dir = new G.V3(m.position.x - from.x + G.rand(-0.5, 0.5), 0, m.position.z - from.z + G.rand(-0.5, 0.5)).normalize();
    const v = dir.multiplyScalar(G.rand(5, 11)); v.y = G.rand(7, 14);
    F.parts.push({ m, v, life: 3, max: 3, size: 1, grav: 28, spin: G.rand(-12, 12), floor: 0.15, debris: true });
  }
};
F.update = dt => {
  F.shake = Math.max(0, F.shake - dt * 2.2);
  for (let i = F.parts.length - 1; i >= 0; i--) {
    const p = F.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      if (p.m) { G.scene.remove(p.m); if (p.ownMat) p.m.material.dispose(); }
      if (p.light) G.scene.remove(p.light);
      F.parts.splice(i, 1); continue;
    }
    const k = p.life / p.max;
    if (p.light) { p.light.intensity = 60 * k; continue; }
    p.v.y -= p.grav * dt;
    if (p.drag) p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
    p.m.position.addScaledVector(p.v, dt);
    if (p.floor !== undefined) {
      const fy = G.groundBelow ? G.groundBelow(p.m.position) : 0;
      if (p.m.position.y < fy + p.floor) { p.m.position.y = fy + p.floor; p.v.y *= -0.35; p.v.x *= 0.7; p.v.z *= 0.7; p.spin *= 0.6; }
    }
    if (p.spin) { p.m.rotation.x += p.spin * dt; p.m.rotation.z += p.spin * 0.7 * dt; }
    if (p.debris) { if (p.life < 0.5) p.m.scale.setScalar(p.life / 0.5); continue; }
    if (p.fade) { p.m.material.opacity = k * 0.9; p.m.scale.setScalar(p.m.scale.x + p.grow * dt); }
    else if (p.grow) p.m.scale.setScalar(p.size * (1 + (1 - k) * p.grow * 2) * Math.min(1, k * 3));
    else p.m.scale.setScalar(p.size * Math.min(1, k * 2));
  }
};
F.clear = () => { for (const p of F.parts) { if (p.m) { G.scene.remove(p.m); if (p.ownMat) p.m.material.dispose(); } if (p.light) G.scene.remove(p.light); } F.parts.length = 0; F.shake = 0; };
// Height of the surface under a point (for debris bouncing).
G.groundBelow = (p) => {
  const ray = new G.V3(p.x, p.y + 0.5, p.z);
  const t = G.raycast(ray, new G.V3(0, -1, 0), 40);
  return t >= 40 ? -100 : ray.y - t;
};
})();
