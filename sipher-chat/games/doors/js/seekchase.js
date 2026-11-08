// Seek's 3D body and rise cutscene, the chase's opening hallway and fork rooms,
// and animated 3D forms for Halt and Screech (all original designs).
(() => {
'use strict';
const V3 = THREE.Vector3;
const A = G.audio, U = G.ui, M = G.mat, GEO = G.geo;

/* =====================================================================
   Seek: a tall oil-black body with one huge eye, dripping as it runs
   ===================================================================== */
const caps = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 12);
const limbPart = (parent, mat, r, len, y) => { const m = new THREE.Mesh(caps(r, len), mat); m.position.y = y; parent.add(m); return m; };
G.models.seek = () => {
  const g = new THREE.Group();
  const oil = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  const sclera = new THREE.MeshStandardMaterial({ color: 0xf2eee4, emissive: 0xbab4a8, emissiveIntensity: 0.6, roughness: 0.25 });
  const iris = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  const vein = new THREE.MeshBasicMaterial({ color: 0x7a0808 });
  const body = new THREE.Group(); g.add(body);
  // pelvis, torso, ribs pressing through the oil
  limbPart(body, oil, 0.24, 0.25, 1.25);
  const torso = limbPart(body, oil, 0.27, 0.75, 1.85); torso.scale.set(1, 1, 0.8);
  for (let i = 0; i < 4; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.25 - i * 0.015, 0.025, 6, 16, Math.PI), oil); rib.position.set(0, 1.75 + i * 0.12, 0.06); rib.rotation.set(Math.PI / 2, 0, 0); body.add(rib); }
  // stretched neck and head
  const neck = limbPart(body, oil, 0.09, 0.35, 2.45); neck.rotation.x = 0.35; neck.position.z = 0.08;
  const head = new THREE.Group(); head.position.set(0, 2.78, 0.2); body.add(head);
  const skull = new THREE.Mesh(caps(0.24, 0.22), oil); skull.rotation.x = Math.PI / 2 - 0.2; head.add(skull);
  const eye = new THREE.Group(); eye.position.set(0, 0.02, 0.2); head.add(eye);
  const ball = new THREE.Mesh(GEO.sphere, sclera); ball.scale.set(0.17, 0.13, 0.08); eye.add(ball);
  const pupil = new THREE.Mesh(GEO.sphere, iris); pupil.scale.set(0.07, 0.07, 0.03); pupil.position.z = 0.065; eye.add(pupil);
  for (let i = 0; i < 7; i++) { const v = new THREE.Mesh(GEO.box, vein); const a = i / 7 * Math.PI * 2; v.scale.set(0.09, 0.006, 0.006); v.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.075, 0.06); v.rotation.z = a; eye.add(v); }
  // long arms ending in needle fingers, digitigrade legs
  const limbs = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.34, 2.22, 0); body.add(arm);
    limbPart(arm, oil, 0.075, 0.6, -0.4);
    const fore = new THREE.Group(); fore.position.y = -0.82; fore.rotation.x = -0.4; arm.add(fore);
    limbPart(fore, oil, 0.06, 0.6, -0.38);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.32, 5), oil); f.position.set((k - 1.5) * 0.035, -0.9, 0.02); f.rotation.x = Math.PI; f.rotation.z = (k - 1.5) * 0.18; fore.add(f); }
    const leg = new THREE.Group(); leg.position.set(s * 0.15, 1.12, 0); g.add(leg);
    limbPart(leg, oil, 0.095, 0.4, -0.3);
    const shin = new THREE.Group(); shin.position.y = -0.58; shin.rotation.x = 0.45; leg.add(shin);
    limbPart(shin, oil, 0.07, 0.38, -0.28);
    limbs.push(arm, leg);
  }
  // dripping strands
  const drips = [];
  for (let i = 0; i < 18; i++) {
    const base = G.rand(0.12, 0.45), m = new THREE.Mesh(caps(0.012, 1), oil);
    m.scale.y = base; m.position.set(G.rand(-0.28, 0.28), G.rand(1.1, 2.6) - base / 2, G.rand(-0.15, 0.22)); body.add(m);
    drips.push({ m, base, ph: G.random() * 7 });
  }
  g.userData = { body, limbs, drips, eye };
  return g;
};

// Seek waits (rising and staring) while the cutscene plays; its eye opens as it rises.
const SK = G.E.Seek.prototype, skU = SK.update;
SK.update = function (dt) {
  const k = Math.min(1, this.t / this.rise);
  if (this.puddle) this.puddle.scale.setScalar(Math.min(1, this.t / 0.5) * 1.3);
  const eye = this.m.userData.eye; if (eye) eye.scale.y = k < 0.8 ? 0.15 : Math.min(1, (k - 0.8) / 0.2);
  if (this.hold && this.t >= this.rise) {
    this.t += dt;
    const P = G.player, dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z;
    this.m.rotation.y = Math.atan2(dx, dz);
    this.m.userData.body.rotation.x = 0.1 + Math.sin(this.t * 3) * 0.04;
    return true;
  }
  return skU.call(this, dt);
};

/* =====================================================================
   The rise cutscene
   ===================================================================== */
const cine = on => document.body.classList.toggle('cine', on);
G.startSeekCutscene = (game, room) => {
  const P = G.player, pl = room.w2l(P.pos);
  const spawn = room.l2w(0, 0, Math.max(0.8, pl.z - 8.5));
  const seek = game.spawn(new G.E.Seek(spawn, { rise: 2.6 }));
  seek.hold = true;
  game.cutscene = { t: 0, dur: 4.2, seek, yaw0: P.yaw };
  cine(true); P.vel.set(0, 0, 0);
  A.sfx('splash'); A.sfx('sting');
  G.ui.caption('Something is rising behind you...', 2.5);
};
const gUP = G.game.updatePlayer;
G.game.updatePlayer = function (dt) {
  const c = this.cutscene;
  if (!c) return gUP.call(this, dt);
  c.t += dt;
  const P = G.player, head = c.seek.pos.clone().add(new V3(0, 2.4, 0));
  const want = G.yawFromDir(head.x - P.pos.x, head.z - P.pos.z);
  const wantPitch = Math.atan2(head.y - (P.pos.y + P.eye), Math.max(0.5, G.distXZ(head, P.pos)));
  const turnBack = c.t > c.dur - 0.45;
  let dy = (turnBack ? c.yaw0 : want) - P.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  P.yaw += dy * Math.min(1, dt * (turnBack ? 14 : 4));
  P.pitch += ((turnBack ? 0 : wantPitch) - P.pitch) * Math.min(1, dt * 4);
  if (!c.roared && c.t > 2.6) { c.roared = true; A.sfx('roar'); A.sfx('scream', { dur: 0.9, f: 300 }); P.shake = 1; G.post.kick(0.8, 0.6); }
  G.mouse.dx = G.mouse.dy = 0;
  U.modalOpen = true; gUP.call(this, dt); U.modalOpen = false; // freeze movement, keep the camera rig
  if (c.t >= c.dur) {
    this.cutscene = null; cine(false);
    c.seek.hold = false; this.crumbs = [P.pos.clone()]; this.chase = true;
    U.msg('RUN!', 2.5, 'run');
  }
};
// The chase now starts from the hallway cutscene instead of the moment you walk in.
const cre0 = G.chaseRoomEnter;
G.chaseRoomEnter = (game, room) => {
  if (room.chase && room.chase.i === 0 && !room.chaseStarted && !game.seek) { room.awaitSeek = true; return; }
  cre0(game, room);
};
const start0 = G.game.start;
G.game.start = function (id) { this.cutscene = null; cine(false); return start0.call(this, id); };

/* =====================================================================
   Chase rooms: the long opening hallway, and hexagon fork rooms
   ===================================================================== */
const chase0 = G.SP.chase;
const exitLamp = (r, x, z) => r.lamp(x, 2.7, z, { type: 'bare', color: 0x5ab4ff, intensity: 12, dist: 9 });
function hallway(game, at, n, th) {
  const lay = G.chooseLayout(game, at, { Wfix: 4.2, Lfix: 36, center: true, sides: ['front'] });
  const r = new G.Room(game, { index: n, origin: at.origin, dir: at.dir, xl: lay.xl, xr: lay.xr, L: lay.L, H: th.H, theme: th });
  r.chase = { i: 0, last: false };
  r.exits = [{ side: 'front', pos: 0, real: true }];
  r.shell(); r.makeExit(r.exits[0], { number: n + 1 });
  exitLamp(r, 0, r.L - 0.4);
  for (let z = 5; z < r.L; z += 7) r.lamp(0, r.H, z, { color: 0xff9a60, intensity: 7, buzz: true });
  G.SP.seekEyes(r, 30);
  // the puddle waits in the floor
  const pud = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  pud.rotation.x = -Math.PI / 2; pud.position.set(0, 0.012, 4); r.group.add(pud); r.geos.push(pud.geometry); r.mats.push(pud.material);
  r.updaters.push(() => {
    if (!r.awaitSeek || game.cur !== r || game.state !== 'play' || game.seek) return;
    if (r.w2l(G.player.pos).z > 12) { r.awaitSeek = false; r.chaseStarted = true; pud.visible = false; G.startSeekCutscene(game, r); }
  });
  return r.finish();
}
function fork(game, at, n, th, i) {
  const W = 11, L = 24;
  const lay = G.chooseLayout(game, at, { Wfix: W, Lfix: L, center: true, sides: ['front'] });
  const r = new G.Room(game, { index: n, origin: at.origin, dir: at.dir, xl: lay.xl, xr: lay.xr, L: lay.L, H: th.H, theme: th });
  r.chase = { i, last: false };
  r.exits = [{ side: 'front', pos: 0, real: true }];
  r.shell(); r.makeExit(r.exits[0], { number: n + 1 });
  exitLamp(r, 0, r.L - 0.4);
  const wall = th.wall;
  // central pillar splits the room into a left and a right path that rejoin at the far end
  r.box(0, r.H / 2, 12, 3.6, r.H, 12, wall, { uv: 4 });
  // cut corners so the room reads as a hexagon
  for (const [x, z, ry] of [[-W / 2, 0, 1], [W / 2, 0, -1], [-W / 2, L, -1], [W / 2, L, 1]]) {
    const m = r.mesh(GEO.box, wall, x * 0.82, r.H / 2, z === 0 ? 2.2 : L - 2.2, null, 4.2, r.H, 0.25);
    m.rotation.y = ry * Math.PI / 4;
    r.addCol(x * 0.9, r.H / 2, z === 0 ? 1.2 : L - 1.2, 1.6, r.H, 1.6);
  }
  // which way is open? sometimes both
  const roll = G.random(), open = roll < 0.3 ? ['l', 'r'] : roll < 0.65 ? ['l'] : ['r'];
  const guide = G.pick(open);
  for (const side of ['l', 'r']) {
    const sx = side === 'l' ? -1 : 1, laneX = sx * 3.65;
    if (!open.includes(side)) {
      // the wrong way: a collapsed heap of furniture
      for (let k = 0; k < 5; k++) r.box(laneX + G.rand(-0.8, 0.8), G.rand(0.4, 1.4), 15 + G.rand(-0.6, 0.6), G.rand(0.8, 1.8), G.rand(0.6, 1.4), G.rand(0.4, 0.9), M.darkwood, { collide: false, uv: 1 });
      r.addCol(laneX, r.H / 2, 15, 3.7, r.H, 1.2);
      r.lamp(laneX, 1.2, 14, { type: 'bare', color: 0xff5020, intensity: 5, dist: 5, buzz: true });
    }
    if (side === guide) {
      // the guiding light shows the way
      r.lamp(laneX, 2.4, 6.2, { type: 'bare', color: 0x5ab4ff, intensity: 14, dist: 10 });
      r.box(laneX, 0.012, 12, 0.14, 0.02, 11, M.blueGlow, { collide: false });
    }
  }
  for (const z of [3, 21]) r.lamp(0, r.H, z, { color: 0xff9a60, intensity: 7, buzz: true });
  G.SP.seekEyes(r, 16);
  return r.finish();
}
G.SP.chase = (game, at, n, th, i, total) => {
  if (i === 0) return hallway(game, at, n, th);
  if (i === 2 && total > 4) return fork(game, at, n, th, i);
  return chase0(game, at, n, th, i, total);
};

/* =====================================================================
   Halt: a translucent spectre that drifts and reaches
   ===================================================================== */
G.models.halt = () => {
  const g = new THREE.Group();
  const ghost = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const core = new THREE.MeshBasicMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const hollow = new THREE.MeshBasicMaterial({ color: 0x000814 });
  const head = new THREE.Mesh(GEO.sphere, ghost); head.scale.set(0.26, 0.32, 0.26); head.position.y = 0.55; g.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(GEO.sphere, hollow); e.scale.set(0.06, 0.09, 0.03); e.position.set(s * 0.09, 0.6, 0.23); g.add(e); }
  const mouth = new THREE.Mesh(GEO.sphere, hollow); mouth.scale.set(0.05, 0.1, 0.03); mouth.position.set(0, 0.43, 0.23); g.add(mouth);
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.8, 18, 6, true), ghost); robe.position.y = -0.55; robe.rotation.x = Math.PI; g.add(robe);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.3, 12, 1, true), core); inner.position.y = -0.35; inner.rotation.x = Math.PI; g.add(inner);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.3, 0.25, 0.05); g.add(arm);
    const a = new THREE.Mesh(caps(0.05, 0.7), ghost); a.position.y = -0.38; arm.add(a);
    arm.rotation.x = -1.1; arms.push(arm);
  }
  const motes = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(GEO.sphere, core); m.scale.setScalar(0.03); g.add(m); motes.push({ m, a: G.random() * 7, r: G.rand(0.3, 0.7), y: G.rand(-1.2, 0.8), sp: G.rand(0.5, 1.5) }); }
  const haze = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending });
  const light = new THREE.Mesh(GEO.sphere, haze); light.scale.set(0.5, 0.9, 0.5); light.position.y = -0.1; g.add(light);
  let t = 0;
  g.userData.tick = dt => {
    t += dt;
    ghost.opacity = 0.42 + Math.sin(t * 7) * 0.08 + (G.random() < 0.05 ? -0.3 : 0);
    robe.scale.set(1 + Math.sin(t * 3) * 0.06, 1, 1 + Math.cos(t * 2.6) * 0.06);
    robe.rotation.z = Math.sin(t * 1.7) * 0.08;
    head.rotation.z = Math.sin(t * 1.3) * 0.15;
    arms.forEach((a, i) => { a.rotation.x = -1.15 + Math.sin(t * 2 + i) * 0.15; a.rotation.z = (i ? -1 : 1) * (0.25 + Math.sin(t * 1.5) * 0.1); });
    motes.forEach(o => { o.a += dt * o.sp; o.y += dt * 0.3; if (o.y > 1) o.y = -1.2; o.m.position.set(Math.cos(o.a) * o.r, o.y, Math.sin(o.a) * o.r); });
  };
  return g;
};

/* =====================================================================
   Screech: an ink blot with grasping tentacles and a ring of teeth
   ===================================================================== */
G.models.screech = () => {
  const g = new THREE.Group();
  const ink = new THREE.MeshPhysicalMaterial({ color: 0x040405, roughness: 0.2, clearcoat: 0.8 });
  const tooth = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.4 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x120000 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const body = new THREE.Mesh(GEO.sphere, ink); body.scale.set(0.38, 0.34, 0.32); g.add(body);
  const mouth = new THREE.Group(); mouth.position.z = 0.27; g.add(mouth);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), dark); mouth.add(throat);
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + ring * 0.2, rr = 0.17 - ring * 0.05;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 4), tooth);
    t.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.01); t.rotation.z = a + Math.PI / 2; t.rotation.x = -0.6; mouth.add(t);
  }
  for (const s of [-1, 1]) { const e = new THREE.Mesh(GEO.sphere, glow); e.scale.setScalar(0.025); e.position.set(s * 0.1, 0.2, 0.25); g.add(e); }
  const tents = [];
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2, chain = [];
    let parent = g;
    for (let j = 0; j < 6; j++) {
      const seg = new THREE.Group();
      if (j === 0) { seg.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.27, -0.05); seg.rotation.z = a - Math.PI / 2; }
      else seg.position.y = 0.12;
      const m = new THREE.Mesh(GEO.sphere, ink); m.scale.setScalar(0.06 - j * 0.008); m.position.y = 0.06; seg.add(m);
      parent.add(seg); chain.push(seg); parent = seg;
    }
    tents.push({ chain, ph: G.random() * 7 });
  }
  let t = 0;
  g.userData.tick = (dt, anger = 0) => {
    t += dt;
    tents.forEach(o => o.chain.forEach((s, j) => { if (j) s.rotation.z = Math.sin(t * (4 + anger * 6) + o.ph + j * 0.7) * (0.25 + anger * 0.3); }));
    const open = 0.75 + Math.sin(t * 9) * 0.1 + anger * 0.6;
    mouth.scale.set(open, open, 1);
    body.scale.set(0.38 + Math.sin(t * 5) * 0.015, 0.34 + Math.cos(t * 5) * 0.015, 0.32);
  };
  return g;
};
// The sprite stays invisible as Screech's "look at it" target; the model is what you see.
const SC = G.E.Screech.prototype, scU = SC.update, scR = SC.remove;
SC.update = function (dt) {
  if (!this._m) { this._m = G.models.screech(); G.scene.add(this._m); }
  const r = scU.call(this, dt);
  if (this._m && this.sprite) {
    this.sprite.material.opacity = 0;
    this._m.position.copy(this.sprite.position);
    this._m.lookAt(G.camera.position);
    this._m.scale.setScalar(Math.min(1, this.t / 0.2) * 1.4);
    this._m.userData.tick(dt, G.clamp((this.t - 1.2) / 1.1, 0, 1));
  }
  return r;
};
SC.remove = function () { scR.call(this); if (this._m) { G.scene.remove(this._m); this._m = null; } };
})();
