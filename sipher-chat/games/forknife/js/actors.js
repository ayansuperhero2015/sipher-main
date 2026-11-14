// Actors: movement physics (sprint, crouch, slide), health and shield, weapons, rockets.
// The player and the bot share all of it.
(() => {
'use strict';
const R = G.RAD, V3 = THREE.Vector3, CROUCH_H = 1.3;
G.actors = []; G.rockets = [];
const _m = new V3(), _d = new V3(), _p = new V3(), _r = new V3(), _u = new V3(), _c = new V3(), _mn = new V3(), _mx = new V3();

G.makeActor = o => {
  const a = { isPlayer: !!o.isPlayer, isBot: !o.isPlayer, name: o.name, pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, grounded: true,
    hp: 100, shield: 100, alive: true, slots: [], ammo: [], cur: 0, buildMode: null, editing: false, matSel: 'wood', mats: { wood: 0, brick: 0, metal: 0 },
    fireCd: 0, reloadT: 0, reloadMax: 1, useT: 0, swapT: 0, bloom: 0, burstLeft: 0, burstT: 0, spin: 0, swingT: 0, emote: 0, buildCd: 0,
    input: { fire: false, jump: false, ads: false, sprint: false, crouch: false }, move: { x: 0, z: 0 }, aimO: new V3(), aimD: new V3(0, 0, -1),
    crouch: false, slideT: 0, wasCrouch: false, h: G.HEIGHT,
    peakY: 0, lastHurt: -99, hurtFlag: false, tier: 0, adsK: 0, respawnT: 0 };
  a.av = G.makeAvatar({ shirt: o.color, name: o.isPlayer ? null : o.name, hair: o.hair, skin: o.skin,
    pants: o.isPlayer ? 0x34465e : 0x4a3434, trim: o.isPlayer ? 0x1f242c : 0x231518, accent: o.isPlayer ? 0xffd23f : 0xff6a3d });
  G.scene.add(a.av.root);
  return a;
};
G.enemyOf = a => (a === G.player ? G.bot : G.player);
G.weaponOf = a => (a.cur < 0 ? null : G.WEAPONS[a.slots[a.cur]]);
G.eyeY = a => a.pos.y + (a.crouch || a.slideT > 0 ? 1.08 : G.EYE);
G.giveLoadout = (a, slots) => {
  a.slots = slots.slice();
  a.ammo = a.slots.map(id => { const w = G.WEAPONS[id]; return w.kind === 'heal' ? w.charges : w.mag; });
  a.cur = a.slots.length ? 0 : -1; a.buildMode = null;
  a.reloadT = a.useT = a.burstLeft = a.spin = a.bloom = 0;
};
G.resetActor = (a, x, z, yaw) => {
  const mode = G.match.mode;
  if (a.editing && G.editCancel) G.editCancel(a);
  a.pos.set(x, 0, z); a.vel.set(0, 0, 0); a.yaw = yaw; a.pitch = 0; a.grounded = true; a.peakY = 0;
  a.hp = 100; a.shield = mode.startShield !== undefined ? mode.startShield : 100; a.alive = true; a.respawnT = 0; a.emote = 0; a.lastHurt = -99; a.hurtFlag = false;
  a.fireCd = a.swapT = a.swingT = a.buildCd = 0; a.matSel = 'wood'; a.crouch = false; a.slideT = 0; a.h = G.HEIGHT; a.editing = false;
  a.mats = mode.build ? Object.assign({}, mode.mats) : { wood: 0, brick: 0, metal: 0 };
  G.giveLoadout(a, a.slots);
  a.av.root.visible = true; a.av.root.position.copy(a.pos); a.av.root.rotation.y = yaw;
};
G.selectSlot = (a, i) => {
  if (a.editing) G.editCancel(a);
  if (i >= a.slots.length) return;
  if (a.cur === i && !a.buildMode) return;
  a.cur = i; a.buildMode = null; a.reloadT = a.useT = a.burstLeft = a.spin = 0; a.swapT = 0.2;
  if (a.isPlayer) G.audio.swap();
};
G.setBuild = (a, type) => {
  if (!G.match.mode.build) return;
  if (a.editing) G.editCancel(a);
  if (a.buildMode !== type && a.isPlayer) G.audio.swap();
  a.buildMode = type; a.reloadT = a.useT = a.burstLeft = 0;
};
G.reload = a => {
  const w = G.weaponOf(a);
  if (!w || w.kind === 'heal' || a.buildMode || a.editing || a.reloadT > 0 || a.ammo[a.cur] >= w.mag) return;
  a.reloadT = a.reloadMax = w.reload; a.burstLeft = 0;
  if (a.isPlayer) G.audio.reload();
};

// ---------------------------------------------------------------- damage
G.rayActor = (o, d, e) => {
  const k = e.crouch || e.slideT > 0 ? 0.7 : 1;
  _mn.set(e.pos.x - 0.36, e.pos.y, e.pos.z - 0.36); _mx.set(e.pos.x + 0.36, e.pos.y + 1.45 * k, e.pos.z + 0.36);
  const tb = G.rayBox(o, d, _mn, _mx);
  _mn.set(e.pos.x - 0.2, e.pos.y + 1.45 * k, e.pos.z - 0.2); _mx.set(e.pos.x + 0.2, e.pos.y + 1.9 * k, e.pos.z + 0.2);
  const th = G.rayBox(o, d, _mn, _mx);
  if (tb === Infinity && th === Infinity) return null;
  return th < tb ? { t: th, head: true } : { t: tb, head: false };
};
G.hurt = (t, dmg, by, head, wid) => {
  const m = G.match;
  if (!t.alive || m.phase !== 'play') return;
  dmg = Math.max(1, Math.round(dmg));
  // storm and fall damage skip the shield, like the real thing
  const bypass = wid === 'storm' || wid === 'fall';
  const sh = bypass ? 0 : Math.min(t.shield, dmg); t.shield -= sh; t.hp -= dmg - sh;
  t.lastHurt = G.time; t.hurtFlag = true;
  if (sh > 0 && t.shield <= 0) G.audio.shieldBreak(t.pos);
  if (by && by !== t) {
    if (by.isPlayer) { m.stats.dmg += dmg; G.dmgNum(t.pos, dmg, head ? 'head' : sh > 0 ? 'shield' : 'hp'); G.ui.hitmarker(head); if (head) { m.stats.heads++; G.audio.headshot(); } else G.audio.hit(); }
    else { m.stats.taken += dmg; G.ui.hurtFrom(by.pos); G.audio.hurt(); }
  } else if (t.isPlayer) { m.stats.taken += dmg; G.ui.hurtFrom(null); G.audio.hurt(); }
  G.spawnDebris(_p.set(t.pos.x, t.pos.y + 1.1, t.pos.z), sh > 0 ? '#58b7ff' : '#ffffff', 5, 3, 0.25, 0.08, 0.4);
  if (t.hp <= 0) { t.hp = 0; t.alive = false; if (t.editing) G.editCancel(t); G.onElim(t, by && by !== t ? by : null, wid, head); }
};

// ---------------------------------------------------------------- weapons
function muzzleOf(a, out) {
  const fl = Math.hypot(a.aimD.x, a.aimD.z) || 1;
  return out.set(a.pos.x + Math.cos(a.yaw) * 0.3 + a.aimD.x / fl * 0.9, G.eyeY(a) - 0.2 + a.aimD.y * 0.6, a.pos.z - Math.sin(a.yaw) * 0.3 + a.aimD.z / fl * 0.9);
}
function spreadDir(d, spread, out) {
  if (spread <= 0) return out.copy(d);
  _r.set(-d.z, 0, d.x); if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0); _r.normalize(); _u.crossVectors(_r, d);
  const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * spread;
  return out.copy(d).addScaledVector(_r, Math.cos(ang) * rad).addScaledVector(_u, Math.sin(ang) * rad).normalize();
}
G.spreadOf = (a, w) => {
  let s = w.spread + a.bloom;
  if (w.scope) return a.isBot ? 0.012 : a.input.ads && a.adsK > 0.8 ? 0 : w.spread; // bots never get a perfect scope
  if (a.input.ads) s *= 0.55;
  if (a.crouch && a.grounded) s *= 0.75;
  if (!a.grounded && !w.pellets) s = s * 1.5 + 0.008;
  return s;
};
function shoot(a, w, id) {
  const m = G.match, e = G.enemyOf(a), mz = muzzleOf(a, _m);
  a.ammo[a.cur]--;
  a.shots = (a.shots || 0) + 1; // party mode shows your shots to your friend
  const spread = G.spreadOf(a, w);
  G.audio.shot(w.snd, a.pos); G.muzzle(mz, w.pellets || w.scope ? 1.4 : 0.8); a.av.kick = 1;
  if (a.isPlayer) { m.stats.shots++; G.camKick = Math.min(1, (G.camKick || 0) + (w.pellets || w.scope || w.kind === 'rocket' ? 1 : w.dmg > 40 ? 0.7 : 0.25)); }
  a.bloom = Math.min(w.maxBloom || 0, a.bloom + (w.bloom || 0));
  if (w.kind === 'rocket') {
    const wr = G.rayWorld(a.aimO, a.aimD, 300), ar = e.alive ? G.rayActor(a.aimO, a.aimD, e) : null;
    const t = Math.max(3, Math.min(wr.t, ar ? ar.t : Infinity));
    _p.copy(a.aimO).addScaledVector(a.aimD, t).sub(mz).normalize();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.6), new THREE.MeshLambertMaterial({ color: 0xdfe5ea, emissive: 0x552200 }));
    mesh.position.copy(mz); mesh.lookAt(_c.copy(mz).add(_p)); G.scene.add(mesh);
    G.rockets.push({ pos: mz.clone(), vel: _p.clone().multiplyScalar(w.speed), owner: a, life: 5, mesh, w });
    if (G.onRocket) G.onRocket(a, mz, _p.clone().multiplyScalar(w.speed));
    return;
  }
  let total = 0, head = false; const n = w.pellets || 1;
  for (let i = 0; i < n; i++) {
    spreadDir(a.aimD, spread, _d);
    const wr = G.rayWorld(a.aimO, _d, 400), ar = e.alive ? G.rayActor(a.aimO, _d, e) : null;
    let t = wr.t;
    if (ar && ar.t < wr.t) {
      t = ar.t;
      const f = t <= w.falloff[0] ? 1 : t >= w.falloff[1] ? w.minF : G.lerp(1, w.minF, (t - w.falloff[0]) / (w.falloff[1] - w.falloff[0]));
      total += w.dmg * f * (ar.head ? w.head : 1); head = head || ar.head;
    } else if (wr.hit) {
      _p.copy(a.aimO).addScaledVector(_d, t);
      if (wr.piece) G.damagePiece(wr.piece, w.bdmg || w.dmg, a);
      if (i < 3) G.spawnDebris(_p, wr.piece && G.MATS[wr.piece.mat] ? G.MATS[wr.piece.mat].color : '#d8d0b8', 3, 2.5, 0.05, 0.07, 0.35);
    }
    G.tracer(mz, _p.copy(a.aimO).addScaledVector(_d, Math.min(t, 160)), w.scope ? 0xffffff : 0xffe9a8, w.scope ? 0.07 : 0.035, w.scope ? 0.3 : 0.09);
  }
  if (total > 0) { if (a.isPlayer) m.stats.hits++; G.hurt(e, Math.min(total, 200), a, head, id); }
}
function swing(a) {
  const P = G.PICKAXE, e = G.enemyOf(a);
  a.swingT = 0.35; a.fireCd = 1 / P.rate; G.audio.swing(a.pos); a.swings = (a.swings || 0) + 1;
  _c.set(a.pos.x, G.eyeY(a), a.pos.z);
  const wr = G.rayWorld(_c, a.aimD, P.range), ar = e.alive ? G.rayActor(_c, a.aimD, e) : null;
  if (ar && ar.t < wr.t && ar.t < P.range) G.hurt(e, P.dmg, a, false, 'pickaxe');
  else if (wr.piece) { G.damagePiece(wr.piece, P.bdmg, a); G.spawnDebris(_p.copy(_c).addScaledVector(a.aimD, wr.t), G.MATS[wr.piece.mat] ? G.MATS[wr.piece.mat].color : '#888', 5, 3, 0.1, 0.1, 0.5); }
}
function explodeAt(p, rk) {
  const w = rk.w;
  G.explode(p, w.radius);
  for (const a of G.actors) {
    if (!a.alive) continue;
    _c.set(a.pos.x, a.pos.y + 1, a.pos.z); const dist = _c.distanceTo(p);
    if (dist > w.radius + 0.5) continue;
    _c.sub(p).normalize(); a.vel.x += _c.x * 9; a.vel.z += _c.z * 9; a.vel.y = Math.max(a.vel.y, 6); a.grounded = false; a.peakY = a.pos.y;
    G.hurt(a, w.dmg * (1 - 0.6 * G.clamp(dist / w.radius, 0, 1)) * (a === rk.owner ? 0.4 : 1), rk.owner, false, 'rocket');
  }
  for (const pc of G.pieces.slice()) {
    _c.set(G.clamp(p.x, pc.min.x, pc.max.x), G.clamp(p.y, pc.min.y, pc.max.y), G.clamp(p.z, pc.min.z, pc.max.z));
    if (_c.distanceTo(p) < w.radius) G.damagePiece(pc, w.bdmg, rk.owner);
  }
}
G.rocketsUpdate = dt => {
  for (let i = G.rockets.length - 1; i >= 0; i--) {
    const r = G.rockets[i]; r.life -= dt;
    const len = r.vel.length() * dt; _d.copy(r.vel).normalize();
    const e = G.enemyOf(r.owner), wr = G.rayWorld(r.pos, _d, len), ar = e.alive ? G.rayActor(r.pos, _d, e) : null;
    const hitT = ar && ar.t <= len ? Math.min(ar.t, wr.t) : wr.hit ? wr.t : -1;
    if (hitT >= 0 || r.life <= 0) {
      r.pos.addScaledVector(_d, Math.max(0, hitT - 0.05)); explodeAt(r.pos, r);
      G.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); G.rockets.splice(i, 1); continue;
    }
    r.pos.addScaledVector(_d, len); r.mesh.position.copy(r.pos);
    G.spawnDebris(r.pos, '#cfcfcf', 1, 0.6, 0.05, 0.16, 0.5, -0.1);
  }
};
G.clearRockets = () => { for (const r of G.rockets) G.scene.remove(r.mesh); G.rockets.length = 0; };

function weapons(a, dt) {
  a.fireCd -= dt; a.swapT -= dt; a.buildCd -= dt;
  if (a.swingT > 0) a.swingT -= dt;
  a.bloom = Math.max(0, a.bloom - dt * 0.09);
  const w = G.weaponOf(a), id = a.cur < 0 ? 'pickaxe' : a.slots[a.cur], fire = a.input.fire && G.match.phase === 'play';
  if (a.editing) { a.spin = 0; return; } // edit mode: the mouse selects tiles instead of firing
  if (a.reloadT > 0) { a.reloadT -= dt; if (a.reloadT <= 0 && w) { a.ammo[a.cur] = w.mag; if (a.isPlayer) G.audio.reloaded(); } }
  if (a.useT > 0) {
    if (!fire || !w || w.kind !== 'heal') a.useT = 0;
    else { a.useT -= dt; if (a.useT <= 0) { a.ammo[a.cur]--; a.shield = Math.min(100, a.shield + w.amount); if (a.isPlayer) G.audio.heal(); } }
  }
  if (a.burstLeft > 0 && w && a.ammo[a.cur] > 0) { a.burstT -= dt; if (a.burstT <= 0) { shoot(a, w, id); a.burstLeft--; a.burstT = w.burstGap; } }
  else a.burstLeft = 0;
  if (w && w.spinup && !a.buildMode) a.spin = fire && a.reloadT <= 0 && a.ammo[a.cur] > 0 ? Math.min(w.spinup, a.spin + dt) : Math.max(0, a.spin - dt * 2);
  if (!fire) return;
  if (a.buildMode) {
    if (a.buildCd <= 0) { const s = G.buildTarget(a, a.buildMode, a.yaw, a.pitch); if (s.valid && G.tryBuild(a, s)) a.buildCd = 0.1; }
    return;
  }
  if (a.fireCd > 0 || a.swapT > 0) return;
  if (!w) { swing(a); return; }
  if (w.kind === 'heal') { if (a.useT <= 0 && a.ammo[a.cur] > 0 && a.shield < 100) { a.useT = w.useTime; a.fireCd = 0.2; if (a.isPlayer) G.audio.drink(); } return; }
  if (a.reloadT > 0) return;
  if (a.ammo[a.cur] <= 0) { G.reload(a); return; }
  if (w.spinup && a.spin < w.spinup) return;
  shoot(a, w, id); a.fireCd = 1 / w.rate;
  if (w.burst) { a.burstLeft = w.burst - 1; a.burstT = w.burstGap; }
  if (a.ammo[a.cur] <= 0 && !w.burst) G.reload(a);
}

function moveActor(a, dt) {
  const frozen = G.match.phase === 'count', A = G.arena;
  let mx = a.move.x, mz = a.move.z; const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  if (frozen || a.emote > 0) mx = mz = 0;
  const hs = Math.hypot(a.vel.x, a.vel.z);
  // crouch, and slide when crouching out of a sprint
  const wantC = a.input.crouch && !frozen;
  if (wantC && !a.wasCrouch && a.grounded && a.input.sprint && hs > 6.5 && a.slideT <= 0) {
    a.slideT = 0.85; const k = 12.5 / (hs || 1); a.vel.x *= k; a.vel.z *= k; if (a.isPlayer) G.audio.slide(a.pos);
  }
  a.wasCrouch = wantC;
  if (a.slideT > 0) { a.slideT -= dt; if (!wantC || !a.grounded) a.slideT = Math.min(a.slideT, 0.05); }
  if (wantC) a.crouch = true;
  else if (a.crouch && !G.blocked(a.pos.x, a.pos.z, a.pos.y, R * 0.8, G.HEIGHT)) a.crouch = false;
  a.h = a.crouch || a.slideT > 0 ? CROUCH_H : G.HEIGHT;
  let sp = G.SPEED * (a.input.sprint && !a.input.ads ? G.SPRINT : 1);
  if (a.useT > 0) sp *= 0.5; else if (a.input.ads && !a.buildMode && a.cur >= 0) sp *= 0.7;
  if (a.crouch && a.slideT <= 0) sp *= 0.55;
  const k = Math.min(1, (a.slideT > 0 ? 1.4 : a.grounded ? 14 : 4.5) * dt);
  a.vel.x += (mx * sp - a.vel.x) * k; a.vel.z += (mz * sp - a.vel.z) * k;
  const steps = Math.max(1, Math.ceil(Math.hypot(a.vel.x, a.vel.z) * dt / 0.2)), sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    const nx = a.pos.x + a.vel.x * sdt; if (!G.blocked(nx, a.pos.z, a.pos.y, R, a.h)) a.pos.x = nx; else a.vel.x = 0;
    const nz = a.pos.z + a.vel.z * sdt; if (!G.blocked(a.pos.x, nz, a.pos.y, R, a.h)) a.pos.z = nz; else a.vel.z = 0;
  }
  a.pos.x = G.clamp(a.pos.x, A.x0 + R, A.x1 - R); a.pos.z = G.clamp(a.pos.z, A.z0 + R, A.z1 - R);
  if (a.grounded) {
    if (a.input.jump && !frozen && !a.crouch) { a.vel.y = G.JUMP; a.grounded = false; a.peakY = a.pos.y; a.slideT = 0; G.audio.jump(a.pos); }
    else {
      const g = G.floorY(a.pos.x, a.pos.z, a.pos.y, G.STEP);
      if (g >= a.pos.y - 0.45) a.pos.y = g; else { a.grounded = false; a.vel.y = 0; a.peakY = a.pos.y; }
    }
  }
  if (!a.grounded) {
    a.vel.y -= G.GRAV * dt;
    let ny = a.pos.y + a.vel.y * dt;
    if (a.vel.y > 0) { if (G.blocked(a.pos.x, a.pos.z, ny, R * 0.7, a.h)) { a.vel.y = 0; ny = a.pos.y; } a.peakY = Math.max(a.peakY, ny); }
    else {
      const g = G.floorY(a.pos.x, a.pos.z, a.pos.y, 0.05);
      if (ny <= g) {
        ny = g; a.grounded = true; a.vel.y = 0; G.audio.land(a.pos);
        const drop = a.peakY - g; if (drop > 10.5) G.hurt(a, (drop - 10.5) * 9, null, false, 'fall');
      }
    }
    a.pos.y = ny;
  }
}

G.actorUpdate = (a, dt) => {
  const mode = G.match.mode;
  if (!a.alive) return;
  if (a.emote > 0) a.emote -= dt;
  moveActor(a, dt);
  weapons(a, dt);
  if (mode.overshield && a.shield < mode.overshield && G.time - a.lastHurt > 5) a.shield = Math.min(mode.overshield, a.shield + 18 * dt);
  const w = G.weaponOf(a);
  a.adsK = G.lerp(a.adsK, a.input.ads && !a.buildMode && !a.editing && w && w.kind !== 'heal' ? 1 : 0, Math.min(1, dt * 12));
  a.av.root.position.copy(a.pos); a.av.root.rotation.y = a.yaw;
  a.av.setWeapon(a.buildMode || a.editing ? null : a.cur < 0 ? 'pickaxe' : a.slots[a.cur]);
  a.av.animate(dt, a);
};
})();
