// Entities: freeze traps, decoys, thrown bombs and power-up crates.
(() => {
'use strict';
const A = G.audio;
const E = G.ent = { traps: [], decoys: [], tosses: [], pups: [], pupT: 3 };

E.clear = () => {
  for (const t of E.traps) G.scene.remove(t.mesh);
  for (const d of E.decoys) G.scene.remove(d.av.root);
  for (const t of E.tosses) G.scene.remove(t.mesh);
  for (const p of E.pups) G.scene.remove(p.mesh);
  E.traps = []; E.decoys = []; E.tosses = []; E.pups = []; E.pupT = 3;
};

// ---------- freeze trap ----------
E.addTrap = (a) => {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.12, 6), new THREE.MeshLambertMaterial({ color: 0x9fdcff, emissive: 0x2a6a9a }));
  g.add(base);
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 4), new THREE.MeshLambertMaterial({ color: 0xe8f8ff, emissive: 0x3a7aaa }));
    const ang = i / 6 * Math.PI * 2; s.position.set(Math.cos(ang) * 0.38, 0.2, Math.sin(ang) * 0.38); s.rotation.z = Math.cos(ang) * 0.3; s.rotation.x = -Math.sin(ang) * 0.3; g.add(s);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex(), color: 0x6ad0ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  glow.scale.set(2, 2, 1); glow.position.y = 0.3; g.add(glow);
  g.position.copy(a.pos); g.position.y += 0.03;
  G.scene.add(g);
  E.traps.push({ mesh: g, glow, pos: a.pos.clone(), owner: a, life: 25, arm: 0.4 });
};

// ---------- decoy ----------
E.addDecoy = (a) => {
  const av = G.makeAvatar({ shirt: a.shirt, hat: a.hat });
  av.drawTag(a.name, false, a.isPlayer);
  const dir = G.moveDir(a).clone();
  const d = { isDecoy: true, owner: a, id: -a.id, name: a.name, av, pos: a.pos.clone(), vel: new G.V3(), r: G.RAD, h: G.HEIGHT, grounded: false, ground: null,
    dir, life: 6, turnT: 0, alive: true, bomb: false, fx: { invis: 0, shield: false } };
  G.scene.add(av.root);
  E.decoys.push(d);
  // the real one briefly turns see-through so the swap is convincing
  a.fx.invis = Math.max(a.fx.invis, 1.2);
  G.fx.puff(a.pos, 0xffffff, 10);
};
E.popDecoy = (d, by) => {
  d.alive = false; G.scene.remove(d.av.root);
  G.fx.puff(d.pos, 0xffffff, 14); A.pop(d.pos);
  if (by) {
    by.fx.stun = Math.max(by.fx.stun, 0.7);
    G.ui.feed(`<b>${by.name}</b> fell for <b>${d.owner.name}</b>'s decoy`, 'decoy');
    if (by.isPlayer) G.ui.toast('That was a decoy!');
    if (by.bot) by.bot.replan = true;
  }
};

// ---------- thrown bomb ----------
E.addToss = (from, to) => {
  const m = G.makeBombMesh(); m.scale.setScalar(0.9);
  const start = from.pos.clone(); start.y += 2.4;
  m.position.copy(start); G.scene.add(m);
  E.tosses.push({ mesh: m, from, to, start, t: 0, dur: Math.max(0.25, G.hdist(from.pos, to.pos) / 30) });
};

// ---------- power-ups ----------
const pupGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
E.spawnPowerup = (kind) => {
  const n = G.nav.randomNode();
  if (!n) return;
  if (E.pups.some(p => G.hdist(p.pos, n) < 5)) return;
  kind = kind || G.pick(Object.keys(G.POWERUPS));
  const P = G.POWERUPS[kind];
  const g = new THREE.Group();
  const cube = new THREE.Mesh(pupGeo, new THREE.MeshBasicMaterial({ map: G.iconTex(kind, '#' + new THREE.Color(P.color).getHexString()) }));
  g.add(cube);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex(), color: P.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  glow.scale.set(2.4, 2.4, 1); g.add(glow);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 6), new THREE.MeshBasicMaterial({ color: P.color, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = 3; g.add(beam);
  g.position.set(n.x, n.y + 1, n.z);
  G.scene.add(g);
  E.pups.push({ kind, mesh: g, cube, pos: new G.V3(n.x, n.y, n.z), life: 30, t: Math.random() * 6 });
};

E.update = (dt, live) => {
  const m = G.match;
  // power-up spawning
  if (live) {
    E.pupT -= dt;
    if (E.pupT <= 0) { E.pupT = G.rand(5, 8); if (E.pups.length < 6) E.spawnPowerup(); }
  }
  for (let i = E.pups.length - 1; i >= 0; i--) {
    const p = E.pups[i];
    p.t += dt; p.life -= dt;
    p.mesh.position.y = p.pos.y + 1 + Math.sin(p.t * 3) * 0.15;
    p.cube.rotation.y += dt * 1.8; p.cube.rotation.x = Math.sin(p.t) * 0.3;
    if (p.life < 3) p.mesh.visible = Math.floor(p.t * 8) % 2 === 0;
    let taken = null;
    for (const a of G.actors) {
      if (!a.alive) continue;
      if (Math.abs(a.pos.x - p.pos.x) < 1 && Math.abs(a.pos.z - p.pos.z) < 1 && a.pos.y > p.pos.y - 0.5 && a.pos.y < p.pos.y + 2) { taken = a; break; }
    }
    if (taken) { G.applyPowerup(taken, p.kind); G.fx.burst(p.mesh.position, G.POWERUPS[p.kind].color, 14, 4, 0.16, 0.5); }
    if (taken || p.life <= 0) { G.scene.remove(p.mesh); E.pups.splice(i, 1); }
  }
  // traps
  for (let i = E.traps.length - 1; i >= 0; i--) {
    const t = E.traps[i];
    t.life -= dt; t.arm -= dt;
    t.mesh.rotation.y += dt; t.glow.material.opacity = 0.4 + Math.sin(G.world.time * 5) * 0.2;
    let hit = null;
    if (t.arm <= 0) for (const a of G.actors) {
      if (!a.alive || a === t.owner) continue;
      if (Math.abs(a.pos.x - t.pos.x) < 0.95 && Math.abs(a.pos.z - t.pos.z) < 0.95 && Math.abs(a.pos.y - t.pos.y) < 1) { hit = a; break; }
    }
    if (hit) {
      hit.fx.frozen = 2.5; hit.vel.set(0, hit.vel.y, 0);
      A.frozen(hit.pos); G.fx.burst(hit.pos.clone().setY(hit.pos.y + 1), 0xbfeaff, 18, 5, 0.18, 0.6);
      G.ui.feed(`<b>${hit.name}</b> stepped in <b>${t.owner.name}</b>'s freeze trap`, 'freeze');
      if (hit.isPlayer) G.ui.toast('Frozen');
    }
    if (hit || t.life <= 0) { G.scene.remove(t.mesh); E.traps.splice(i, 1); }
  }
  // decoys: run in a straight line, turning at walls
  for (let i = E.decoys.length - 1; i >= 0; i--) {
    const d = E.decoys[i];
    if (!d.alive) { E.decoys.splice(i, 1); continue; }
    d.life -= dt; d.turnT -= dt;
    const spd = G.SPEED * 1.05;
    d.vel.x = d.dir.x * spd; d.vel.z = d.dir.z * spd;
    d.hitWall = false;
    G.moveBody(d, dt);
    if (d.hitWall && d.grounded) d.vel.y = G.JUMP;
    if ((d.hitWall && d.turnT <= 0) || d.pos.y < G.world.killY + 5) {
      const ang = Math.atan2(d.dir.x, d.dir.z) + G.rand(1.2, 2.4) * (Math.random() < 0.5 ? 1 : -1);
      d.dir.set(Math.sin(ang), 0, Math.cos(ang)); d.turnT = 0.4;
    }
    if (d.pos.y < G.world.killY) d.life = 0;
    const yaw = Math.atan2(d.dir.x, d.dir.z);
    d.av.root.position.copy(d.pos); d.av.root.rotation.y = yaw;
    d.av.animate(dt, d.grounded ? spd : 0, d.grounded, null);
    if (d.life <= 0) { E.popDecoy(d, null); E.decoys.splice(i, 1); continue; }
    // a bomb holder that touches it gets fooled
    for (const a of G.actors) {
      if (!a.alive || !a.bomb || a === d.owner) continue;
      if (Math.abs(a.pos.x - d.pos.x) < G.TAG_DIST && Math.abs(a.pos.z - d.pos.z) < G.TAG_DIST && Math.abs(a.pos.y - d.pos.y) < 1.7) { E.popDecoy(d, a); break; }
    }
  }
  // thrown bombs
  for (let i = E.tosses.length - 1; i >= 0; i--) {
    const t = E.tosses[i];
    t.t += dt;
    const k = Math.min(1, t.t / t.dur);
    const end = t.to.pos.clone(); end.y += 1.2;
    t.mesh.position.lerpVectors(t.start, end, k); t.mesh.position.y += Math.sin(k * Math.PI) * 2.2;
    t.mesh.rotation.x += dt * 14;
    if (Math.random() < 0.7) G.fx.trail(t.mesh.position.clone().setY(t.mesh.position.y - 1), 0xff7a2a);
    if (k >= 1) {
      G.scene.remove(t.mesh); E.tosses.splice(i, 1);
      if (m && m.state === 'round' && t.from.alive && t.from.bomb && t.to.alive && !t.to.bomb) G.passBomb(t.from, t.to, 'toss');
    }
  }
};
})();
