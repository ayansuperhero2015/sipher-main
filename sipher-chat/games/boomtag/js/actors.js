// Actors: the player and bots share one movement model, bomb passing and abilities.
(() => {
'use strict';
const A = G.audio;
let NEXT_ID = 1;
G.actors = [];

G.makeActor = (o) => {
  const a = {
    id: NEXT_ID++, name: o.name, isPlayer: !!o.isPlayer, pos: new G.V3(), vel: new G.V3(), yaw: 0,
    r: G.RAD, h: G.HEIGHT, grounded: false, ground: null, hitWall: false,
    alive: true, bomb: false, noBackId: -1, noBackT: 0, passCd: 0,
    stamina: 100, tired: false, sprinting: false, ability: o.ability, cd: 0,
    fx: { speed: 0, jump: 0, slow: 0, frozen: 0, stun: 0, invis: 0, shield: false },
    knockT: 0, padCd: 0, tpCd: 0, lavaCd: 0, stepT: 0,
    input: { x: 0, z: 0, jump: false, sprint: false },
    aim: new G.V3(0, 0, 1),
    place: 0, passes: 0, survived: 0, held: 0, skill: o.skill || 1, bot: null, shirt: o.shirt, hat: o.hat
  };
  a.av = G.makeAvatar({ shirt: o.shirt, hat: o.hat });
  G.scene.add(a.av.root);
  a.av.drawTag(a.name, false, a.isPlayer);
  G.actors.push(a);
  return a;
};
G.clearActors = () => {
  for (const a of G.actors) G.scene.remove(a.av.root);
  G.actors.length = 0;
};
G.alive = () => G.actors.filter(a => a.alive);
G.setBomb = (a, on) => {
  a.bomb = on; a.av.setBomb(on); a.av.drawTag(a.name, on, a.isPlayer);
};

G.placeAt = (a, n) => {
  a.pos.set(n.x + G.rand(-0.2, 0.2), n.y + 0.05, n.z + G.rand(-0.2, 0.2)); a.vel.set(0, 0, 0);
  a.av.root.position.copy(a.pos);
};
G.respawnActor = (a) => {
  let n = null;
  for (let k = 0; k < 20; k++) {
    n = G.nav.randomNode();
    if (!G.actors.some(o => o !== a && o.alive && o.bomb && G.hdist(o.pos, n) < 8)) break;
  }
  G.placeAt(a, n);
  a.fx.stun = 0.5; a.knockT = 0;
  G.fx.puff(a.pos, 0xffffff, 12);
  if (a.isPlayer) G.ui.toast('You fell off! Respawned.');
};

const SURF = new G.V3();
G.stepActor = (a, dt) => {
  const f = a.fx;
  f.speed = Math.max(0, f.speed - dt); f.jump = Math.max(0, f.jump - dt); f.slow = Math.max(0, f.slow - dt);
  f.frozen = Math.max(0, f.frozen - dt); f.stun = Math.max(0, f.stun - dt); f.invis = Math.max(0, f.invis - dt);
  a.cd = Math.max(0, a.cd - dt); a.noBackT = Math.max(0, a.noBackT - dt); a.passCd = Math.max(0, a.passCd - dt);
  a.knockT = Math.max(0, a.knockT - dt); a.padCd = Math.max(0, a.padCd - dt); a.tpCd = Math.max(0, a.tpCd - dt); a.lavaCd = Math.max(0, a.lavaCd - dt);
  if (a.bomb) a.held += dt;
  const locked = f.frozen > 0 || f.stun > 0;
  let ix = a.input.x, iz = a.input.z;
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  if (locked) ix = iz = 0;
  const moving = ix * ix + iz * iz > 0.01;
  let spd = (a.bomb ? G.HOLDER_SPEED : G.SPEED) * G.mod.speed;
  if (!a.isPlayer) spd *= 0.9 + 0.07 * a.skill; // bots are always a touch slower than you
  if (f.speed > 0) spd *= 1.35;
  if (f.slow > 0) spd *= 0.55;
  if (a.tired && a.stamina > 35) a.tired = false;
  if (a.input.sprint && moving && !a.tired && a.stamina > 0) {
    spd *= G.SPRINT; a.stamina -= (a.isPlayer ? 20 : 28) * dt; a.sprinting = true;
    if (a.stamina <= 0) { a.stamina = 0; a.tired = true; }
  } else { a.stamina = Math.min(100, a.stamina + (moving ? 13 : 22) * dt); a.sprinting = false; }
  const ice = a.grounded && a.ground && a.ground.type === 'ice';
  let accel = a.grounded ? (ice ? 8 : 80) : 24;
  if (a.knockT > 0) accel *= 0.1;
  let dvx = ix * spd - a.vel.x, dvz = iz * spd - a.vel.z;
  const dl = Math.hypot(dvx, dvz), mx = accel * dt;
  if (dl > mx) { dvx *= mx / dl; dvz *= mx / dl; }
  a.vel.x += dvx; a.vel.z += dvz;
  if (a.input.jump && a.grounded && !locked) {
    a.vel.y = G.JUMP * (f.jump > 0 ? 1.4 : 1); a.grounded = false;
    if (a.isPlayer || Math.random() < 0.3) A.jump(a.pos);
  }
  a.hitWall = false;
  G.moveBody(a, dt);
  // special surfaces
  const g = a.grounded ? a.ground : null;
  if (g) {
    if (g.type === 'pad' && a.padCd <= 0) {
      a.vel.copy(g.launch); a.grounded = false; a.padCd = 0.5; a.knockT = 0.7;
      A.boing(a.pos); G.fx.ring(a.pos, 0x7dff9a, 2.5, 0.35);
    } else if (g.type === 'lava' && a.lavaCd <= 0) {
      const ang = Math.random() * Math.PI * 2;
      a.vel.set(Math.cos(ang) * 4, 16, Math.sin(ang) * 4); a.grounded = false; a.knockT = 0.5; f.slow = 1.2; a.lavaCd = 0.6;
      A.sizzle(a.pos); G.fx.burst(a.pos, 0xff7a1a, 14, 6, 0.2, 0.6);
      if (a.isPlayer) G.ui.toast('Lava. Slowed for a second');
    }
  }
  if (a.tpCd <= 0) {
    for (const t of G.world.teles) {
      for (const [p, q] of [[t.a, t.b], [t.b, t.a]]) {
        if (Math.abs(a.pos.x - p.x) < 0.9 && Math.abs(a.pos.z - p.z) < 0.9 && Math.abs(a.pos.y - p.y) < 0.8) {
          A.tele(a.pos); G.fx.burst(a.pos, 0xc78bff, 14, 4, 0.18, 0.5);
          a.pos.set(q.x, q.y + 0.05, q.z); a.tpCd = 2.2;
          A.tele(a.pos); G.fx.burst(a.pos, 0xc78bff, 14, 4, 0.18, 0.5);
          if (a.bot) a.bot.replan = true;
          break;
        }
      }
      if (a.tpCd > 0) break;
    }
  }
  if (a.pos.y < G.world.killY) { G.respawnActor(a); if (a.bot) a.bot.replan = true; }
  // facing + avatar
  if (moving) { const ty = Math.atan2(ix, iz); a.yaw += G.angleWrap(ty - a.yaw) * Math.min(1, dt * 14); }
  const av = a.av, hs = Math.hypot(a.vel.x, a.vel.z);
  av.root.position.copy(a.pos); av.root.rotation.y = a.yaw;
  av.animate(dt, a.grounded ? hs : 0, a.grounded, a);
  av.ice.visible = f.frozen > 0; av.bubble.visible = !!f.shield;
  let op = 1;
  if (f.invis > 0) op = a.isPlayer ? 0.3 : (G.player && G.player.alive && G.hdist(G.player.pos, a.pos) < 3 ? 0.25 : 0.04);
  av.setOpacity(op);
  if (a.grounded && hs > 3) { a.stepT -= dt * hs; if (a.stepT < 0) { a.stepT = 2.3; if (a.isPlayer || G.camera.position.distanceTo(a.pos) < 14) A.step(a.pos); } }
  if (a.sprinting && hs > 6 && Math.random() < dt * 8) G.fx.trail(a.pos, 0xffffff);
  if (f.speed > 0 && Math.random() < dt * 20) G.fx.trail(a.pos, 0xffd23f);
};

// ---------- bomb passing ----------
G.passBomb = (from, to, how) => {
  if (!from.bomb || to.bomb || !to.alive || !from.alive) return false;
  if (to.fx.shield) {
    to.fx.shield = false;
    A.shield(to.pos); G.fx.burst(to.pos.clone().setY(to.pos.y + 1), 0x58b7ff, 18, 6, 0.2, 0.5);
    const d = new G.V3(from.pos.x - to.pos.x, 0, from.pos.z - to.pos.z).normalize();
    from.vel.set(d.x * 13, 6, d.z * 13); from.knockT = 0.4; from.passCd = 0.8;
    G.ui.feed(`<b>${to.name}</b>'s shield blocked <b>${from.name}</b>`, 'shield');
    return false;
  }
  G.setBomb(from, false); G.setBomb(to, true);
  to.noBackId = from.id; to.noBackT = 1.5; to.passCd = 0.45;
  from.passes++;
  A.pass(to.pos);
  G.fx.burst(to.pos.clone().setY(to.pos.y + 2.4), 0xff5a2a, 14, 4, 0.16, 0.5);
  G.ui.feed(`<b class="${from.isPlayer ? 'me' : ''}">${from.name}</b><span class="arrow">${how === 'toss' ? 'threw to' : '→'}</span><b class="${to.isPlayer ? 'me' : ''}">${to.name}</b>`, 'bomb');
  if (to.isPlayer) { A.gotBomb(); G.ui.flashBomb(); }
  if (from.isPlayer) G.ui.toast('Passed. Get away from them');
  if (to.bot) to.bot.replan = true;
  if (from.bot) from.bot.replan = true;
  return true;
};

// ---------- abilities ----------
const _f = new G.V3();
G.aimDir = (a) => {
  if (a.isPlayer) { _f.set(Math.sin(G.cam.yaw), 0, Math.cos(G.cam.yaw)); return _f; }
  _f.set(a.aim.x, 0, a.aim.z); if (_f.lengthSq() < 0.01) _f.set(Math.sin(a.yaw), 0, Math.cos(a.yaw));
  return _f.normalize();
};
G.moveDir = (a) => {
  const l = Math.hypot(a.input.x, a.input.z);
  if (l > 0.1) return _f.set(a.input.x / l, 0, a.input.z / l);
  return G.aimDir(a);
};
const RD = new G.V3(), RO = new G.V3();
G.blinkTarget = (a, dir, maxD) => {
  RO.set(a.pos.x, a.pos.y + 1.0, a.pos.z); RD.copy(dir);
  let d = Math.min(maxD, G.raycast(RO, RD, maxD) - 0.6);
  RO.set(a.pos.x, a.pos.y + 0.35, a.pos.z);
  d = Math.min(d, G.raycast(RO, RD, maxD) - 0.6);
  return Math.max(0, d);
};
const ABIL = {
  dash(a) {
    const d = G.moveDir(a);
    a.vel.x = d.x * 25; a.vel.z = d.z * 25; a.vel.y = Math.max(a.vel.y, 3.5); a.knockT = 0.3; a.grounded = false;
    A.dash(a.pos); for (let i = 0; i < 8; i++) G.fx.trail(a.pos, 0xffffff);
  },
  superjump(a) {
    a.vel.y = 19.5 * (G.mod.grav < 1 ? 0.8 : 1); a.grounded = false;
    A.superjump(a.pos); G.fx.ring(a.pos, 0xffffff, 3, 0.4); G.fx.puff(a.pos, 0xffffff, 8);
  },
  blink(a) {
    const d = G.moveDir(a).clone();
    const dist = G.blinkTarget(a, d, 8.5);
    if (dist < 1) return 'Something is in the way!';
    G.fx.burst(a.pos.clone().setY(a.pos.y + 1), 0xd9a6ff, 16, 4, 0.16, 0.5);
    a.pos.addScaledVector(d, dist);
    if (G.bodyStuck(a)) a.pos.y += 0.6;
    a.vel.y = Math.max(a.vel.y, 0);
    A.blink(a.pos); G.fx.burst(a.pos.clone().setY(a.pos.y + 1), 0xd9a6ff, 16, 4, 0.16, 0.5);
    if (a.bot) a.bot.replan = true;
  },
  freeze(a) { G.ent.addTrap(a); A.freeze(a.pos); },
  shockwave(a) {
    let hit = 0;
    for (const o of G.actors) {
      if (o === a || !o.alive) continue;
      const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 7.5 || Math.abs(o.pos.y - a.pos.y) > 3) continue;
      const k = 1 - d / 9;
      o.vel.set(dx / (d || 1) * 18 * k, 8, dz / (d || 1) * 18 * k); o.knockT = 0.5; o.fx.stun = Math.max(o.fx.stun, 0.35); o.grounded = false;
      if (o.bot) o.bot.replan = true;
      hit++;
    }
    A.shock(a.pos); G.fx.ring(a.pos, 0xffc04a, 8, 0.45); G.fx.ring(a.pos, 0xffffff, 6, 0.35, 0.5); G.fx.shake = Math.max(G.fx.shake, a.isPlayer ? 0.5 : 0.2);
    if (a.isPlayer && hit) G.ui.toast(`Hit ${hit} player${hit > 1 ? 's' : ''}`);
  },
  invis(a) { a.fx.invis = 4; A.invis(a.pos); G.fx.puff(a.pos, 0xcfc4ff, 12); },
  decoy(a) { G.ent.addDecoy(a); A.decoy(a.pos); },
  toss(a) {
    if (!a.bomb) return 'Only works while you hold the bomb!';
    const dir = G.aimDir(a);
    let best = null, bs = Infinity;
    for (const o of G.actors) {
      if (o === a || !o.alive || o.bomb) continue;
      if (a.noBackT > 0 && o.id === a.noBackId) continue;
      const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 16 || d < 0.5) continue;
      const ang = Math.acos(G.clamp((dx * dir.x + dz * dir.z) / d, -1, 1));
      if (ang > 0.45) continue;
      if (!G.los(a.pos, o.pos)) continue;
      const s = ang * 10 + d;
      if (s < bs) { bs = s; best = o; }
    }
    if (!best) return 'No one in range, aim at a player!';
    G.ent.addToss(a, best); A.toss(a.pos);
  }
};
G.useAbility = (a) => {
  if (!a.alive || a.cd > 0 || a.fx.frozen > 0 || a.fx.stun > 0) return false;
  const res = ABIL[a.ability](a);
  if (typeof res === 'string') { if (a.isPlayer) { G.ui.toast(res); A.deny(); } return false; }
  a.cd = G.ABILITIES[a.ability].cd;
  return true;
};

// ---------- power-ups ----------
G.applyPowerup = (a, kind) => {
  const P = G.POWERUPS[kind];
  if (kind === 'speed') a.fx.speed = P.dur;
  else if (kind === 'jump') a.fx.jump = P.dur;
  else if (kind === 'shield') a.fx.shield = true;
  else if (kind === 'recharge') { a.cd = 0; a.stamina = 100; a.tired = false; }
  if (a.isPlayer) { A.pickup(); G.ui.toast(P.name); }
};
})();
