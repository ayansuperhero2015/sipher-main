// Dread: pacing scares — silence before an entity, false alarms, Rush staring into your closet,
// Seek's hands lunging from the walls, and quiet-moment scares (behind you, runners, dying lights).
(() => {
'use strict';
const V3 = THREE.Vector3;
const A = G.audio, U = G.ui, E = G.E, R = G.rand;
const D = G.dread = { lastTime: 0 };

/* ---------- sounds ---------- */
Object.assign(A.SFX, {
  subswell: () => { A.tone({ f: 28, f2: 58, dur: 3.5, vol: 0.5, a: 2.5 }); A.noise({ dur: 3.4, f: 90, f2: 200, q: 0.8, vol: 0.35, a: 2.6, type: 'lowpass' }); },
  rumble: () => A.noise({ dur: 2.2, f: 140, q: 0.6, vol: 0.28, a: 0.6, type: 'lowpass' }),
  dash: () => { for (let i = 0; i < 6; i++) A.noise({ dur: 0.05, f: 500, q: 0.8, vol: 0.12, delay: i * 0.1 }); },
  grab: () => { A.noise({ dur: 0.25, f: 300, f2: 1800, q: 1.2, vol: 0.6 }); A.tone({ f: 120, f2: 60, dur: 0.3, type: 'sawtooth', vol: 0.15 }); },
});

/* ---------- silence before the storm + Rush peering into your hiding spot ---------- */
const PEEKERS = new Set(['rush', 'ambush', 'blitz', 'a60']);
const RP = E.Rusher.prototype, rUpdate = RP.update, rRemove = RP.remove;
RP.update = function (dt) {
  const P = G.player;
  if (!this._ducked) { this._ducked = true; A.duck(0.02, 0.5); A.sfx('subswell'); }
  if (this._peekT > 0) {
    this._peekT -= dt;
    const s = P.hiding;
    if (s && this._peekAt) {
      this.sprite.visible = true;
      this.sprite.position.copy(this._peekAt).add(new V3(R(-0.04, 0.04), R(-0.04, 0.04), 0));
      const k = 0.8 + Math.sin(this._peekT * 40) * 0.04;
      this.sprite.scale.set(this.C.size * k, this.C.size * k, 1);
      this.sprite.material.map = Math.random() < 0.4 ? G.glitchTex(this.C.face) : G.faceTex(this.C.face);
      this.snd.set(1.3);
      P.shake = Math.max(P.shake, 0.8);
      G.post.kick(0.5, 0.5);
    }
    return true;
  }
  const alive = rUpdate.call(this, dt);
  if (alive !== false && P.hiding && this.pos && this.sprite.visible && !this._peeked && PEEKERS.has(this.kind)) {
    if (P.hiding.room.isInside(this.pos, 0.6) && G.distXZ(this.pos, P.hiding.out) < 4.5) {
      this._peeked = true; this._peekT = 0.8;
      // Stop right outside the slats, face level.
      const o = P.hiding.out, inn = P.hiding.in;
      this._peekAt = o.clone().add(o.clone().sub(inn).multiplyScalar(0.45)).add(new V3(0, 1.5, 0));
      A.sfx('sting'); A.sfx('breath');
    }
  }
  return alive;
};
RP.remove = function () { rRemove.call(this); A.duck(1, 2.5); };

/* ---------- Seek's hands lunge out of the walls during the chase ---------- */
const chase0 = G.SP.chase;
G.SP.chase = (game, at, n, th, i, total) => {
  const r = chase0(game, at, n, th, i, total);
  if (i === total - 1) return r;
  const black = G.mat.black, arms = [];
  let next = R(0.8, 1.6);
  r.updaters.push(dt => {
    for (let k = arms.length - 1; k >= 0; k--) {
      const a = arms[k];
      a.t += dt;
      const ext = a.t < 0.22 ? a.t / 0.22 : a.t < 0.6 ? 1 : Math.max(0, 1 - (a.t - 0.6) / 0.4);
      a.piv.scale.x = Math.max(0.01, a.reach * ext);
      a.fingers.forEach((f, j) => { f.rotation.z = Math.sin(a.t * 30 + j) * 0.4; });
      if (!a.hit && ext > 0.6 && game.state === 'play') {
        const tip = r.l2w(a.wx + a.dir * a.reach * ext, a.y, a.z);
        if (G.distXZ(tip, G.player.pos) < 0.75 && Math.abs(tip.y - (G.player.pos.y + 1.2)) < 0.9) {
          a.hit = true; A.sfx('grab'); game.damage(12, 'hands'); G.player.rooted = 0.35; G.player.shake = 0.7;
        }
      }
      if (a.t > 1.0) { r.group.remove(a.piv); arms.splice(k, 1); }
    }
    if (game.cur !== r || !game.seek || game.state !== 'play') return;
    next -= dt;
    if (next > 0) return;
    next = R(0.9, 1.8);
    const pl = r.w2l(G.player.pos);
    if (r.exits[0].side !== 'front' && pl.z > r.L - 5) return;
    const z = G.clamp(pl.z + R(2.5, 5), 1.5, r.L - 1.5), left = G.chance(0.5);
    const wx = left ? r.xl : r.xr, dir = left ? 1 : -1, y = R(0.9, 1.7);
    const piv = new THREE.Group(); piv.position.set(wx, y, z); if (!left) piv.rotation.y = Math.PI;
    const arm = new THREE.Mesh(G.geo.box, black); arm.position.x = 0.5; arm.scale.set(1, 0.11, 0.11); piv.add(arm);
    const fingers = [];
    for (let j = 0; j < 4; j++) { const f = new THREE.Mesh(G.geo.box, black); f.scale.set(0.12, 0.02, 0.02); f.position.set(1.04, (j - 1.5) * 0.035, 0); piv.add(f); fingers.push(f); }
    r.group.add(piv);
    arms.push({ piv, fingers, t: 0, reach: R(1.3, 1.9), wx, dir, y, z, hit: false });
    A.sfxAt('grab', r.l2w(wx, y, z));
  });
  return r;
};

/* ---------- quiet-moment scares ---------- */
const RUSH_FLOORS = new Set(['hotel', 'mines', 'backdoor', 'rooms']);
D.reset = () => {
  D.falseT = R(70, 140); D.ambT = R(35, 70); D.seq = null;
  if (D.ghost) { G.scene.remove(D.ghost.s); D.ghost = null; }
};
D.reset();
function quiet(g) {
  const cur = g.cur;
  return cur && !cur.safe && !g.rush && !g.seek && !g.escaping && !g.figures.length && (!G.fear || G.fear.level < 0.18);
}
D.update = (dt, g) => {
  if (g.time < D.lastTime) D.reset();
  D.lastTime = g.time;
  const P = G.player, cam = G.camera, cur = g.cur;
  // Hide's eyes open in the dark behind you when you stay too long.
  const eyes = document.getElementById('hide-eyes');
  if (!eyes.getAttribute('src')) eyes.src = G.faceURL('hide');
  if (P.hiding) {
    const k = G.clamp((P.hideT / g.hideLimit - 0.55) / 0.4, 0, 1);
    eyes.style.opacity = (k * (0.75 + Math.random() * 0.25)).toFixed(2);
    if (k > 0.3 && Math.random() < dt * 0.6) A.sfxAt('whisper', cam.position.clone().add(new V3(0, 0, 0.4).applyQuaternion(cam.quaternion)));
  } else eyes.style.opacity = 0;
  // false alarm: the lights flicker... and nothing comes
  if (RUSH_FLOORS.has(g.floor.id) && quiet(g) && !cur.dark) {
    D.falseT -= dt;
    if (D.falseT <= 0) {
      D.falseT = R(70, 150);
      cur.flicker = R(1.1, 1.8); A.sfx('flicker'); A.sfx('rumble'); A.duck(0.03, 0.3);
      D.seq = { kind: 'restore', t: 2.8 };
    }
  }
  // running sequences
  const s = D.seq;
  if (s) {
    s.t -= dt;
    if (s.kind === 'restore' && s.t <= 0) { A.duck(1, 2); D.seq = null; }
    else if (s.kind === 'lights' && s.t <= 0) {
      const lamp = s.room.lamps.find(L => L.on && !L.broken && !L.unbreakable);
      if (lamp && !s.room.disposed) { lamp.broken = true; A.sfxAt('break', lamp.pos); s.room.flicker = 0.25; s.t = R(0.35, 0.7); }
      else { if (!s.room.disposed) s.room.dark = true; D.seq = null; A.sfx('groan'); }
    }
  }
  // ghost sprites (behind you / runner)
  const gh = D.ghost;
  if (gh) {
    gh.t += dt;
    if (gh.kind === 'behind') {
      if (G.lookingAt(gh.s.position, 0.8) && gh.t > 0.15) {
        U.flash('#000'); G.post.kick(1, 0.6); A.sfx('sting'); P.shake = 0.5;
        G.scene.remove(gh.s); D.ghost = null;
      } else if (gh.t > 3.5) { G.scene.remove(gh.s); D.ghost = null; }
    } else if (gh.kind === 'runner') {
      gh.x += gh.v * dt;
      gh.s.position.copy(gh.room.l2w(gh.x, 1.3, gh.z));
      if ((gh.v > 0 && gh.x > gh.end) || (gh.v < 0 && gh.x < gh.end) || gh.room.disposed) { G.scene.remove(gh.s); D.ghost = null; }
    }
  }
  if (!quiet(g) || P.hiding) return;
  D.ambT -= dt;
  if (D.ambT > 0 || D.seq || D.ghost) return;
  D.ambT = R(40, 85);
  const ev = G.weighted({ behind: 2, runner: 2.5, lights: g.floor.outdoor ? 0 : 1.5, closet: cur.hides.length ? 1.5 : 0 });
  if (ev === 'behind') {
    const back = G.camForward(new V3()).setY(0).normalize().multiplyScalar(-1.25);
    const pos = cam.position.clone().add(back).add(new V3(0, -0.15, 0));
    if (!G.los(cam.position, pos, g.cols) || !cur.isInside(pos, -0.2)) return;
    const sp = G.faceSprite('shadow', 2.2); sp.position.copy(pos); G.scene.add(sp);
    D.ghost = { kind: 'behind', s: sp, t: 0 };
    A.sfxAt('breath', pos); A.sfxAt('whisper', cam.position.clone().add(back.clone().multiplyScalar(0.4)));
  } else if (ev === 'runner') {
    const pl = cur.w2l(P.pos), z = pl.z < cur.L / 2 ? cur.L - 1.1 : 1.1;
    if (Math.abs(pl.z - z) < 5) return;
    const fwd = G.chance(0.5), x0 = fwd ? cur.xl + 0.3 : cur.xr - 0.3, x1 = fwd ? cur.xr - 0.3 : cur.xl + 0.3;
    const sp = G.faceSprite('shadow', 2.6); sp.position.copy(cur.l2w(x0, 1.3, z)); G.scene.add(sp);
    D.ghost = { kind: 'runner', s: sp, t: 0, x: x0, end: x1, v: fwd ? 9 : -9, z, room: cur };
    A.sfxAt('dash', cur.l2w((x0 + x1) / 2, 0.5, z));
  } else if (ev === 'lights') {
    if (cur.lamps.filter(L => L.on && !L.broken && !L.unbreakable).length < 1) return;
    D.seq = { kind: 'lights', t: 0.1, room: cur };
    A.sfx('flicker');
  } else if (ev === 'closet') {
    const spot = cur.hides.find(h => h.in.distanceTo(P.pos) < 8);
    if (!spot) return;
    A.sfxAt('breath', spot.in.clone().add(new V3(0, 1.5, 0)));
    if (G.chance(0.5)) spot.jack = true;
  }
};
})();
