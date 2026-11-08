// Bots: farm their generator, shop, cover their bed, bridge to enemies, break beds and fight.
(() => {
'use strict';
const V3 = G.V3, wd = G.world, S = G.SURF;
const SKILL = {
  easy: { aim: 0.32, react: 0.65, hit: 0.5, cps: 0.75, think: 0.5, bridge: 2.4 },
  normal: { aim: 0.17, react: 0.38, hit: 0.72, cps: 0.9, think: 0.3, bridge: 3.0 },
  hard: { aim: 0.07, react: 0.2, hit: 0.88, cps: 1.0, think: 0.2, bridge: 3.6 }
};

class Bot {
  constructor(a, diff, role) {
    this.a = a; a.bot = this; this.sk = SKILL[diff] || SKILL.normal; this.diff = diff;
    this.role = role; // 'rush' | 'defend'
    this.state = 'farm'; this.think = 0; this.goal = null; this.enemy = null; this.seen = 0;
    this.farmUntil = 0; this.covered = false; this.shopQueue = [];
    this.stuck = 0; this.lastPos = new V3(); this.strafe = 1; this.strafeT = 0;
    this.targetTeam = -1; this.wantJump = false; this.aggro = G.rand(0.6, 1);
    this.ignore = {}; this.fightStart = 0; this.prevState = 'farm';
    this.firstRush = G.rand(diff === 'hard' ? 35 : 55, diff === 'easy' ? 120 : 90);
  }
  get home() { return G.game.map.teams[this.a.team]; }
  onHurt(from) { if (from && from.alive && from.team !== this.a.team) { this.enemy = from; this.seen = G.game.time; } }
  onRespawn() { this.jumpOff = false; this.shopAt = null; this.strandT = 0; this.state = 'farm'; this.farmUntil = G.game.time + G.rand(8, 16); this.enemy = null; this.goal = null; }

  /* ---------- decisions ---------- */
  decide() {
    const a = this.a, g = G.game, t = g.time;
    // immediate threats: anyone close to me, or near my bed
    const myBed = g.teams[a.team].bedAlive ? this.home.bed[0] : null;
    let best = null, bd = 1e9;
    // give up on enemies we cannot reach (across a gap, behind a wall) for a while
    if (this.state === 'fight' && this.enemy && t - this.fightStart > 7 && (a.lastLanded || 0) < this.fightStart) {
      this.ignore[this.enemy.id] = t + 12; this.enemy = null; this.state = this.prevState || 'farm';
    }
    for (const e of g.actors) {
      if (!e.alive || e.team === a.team || (this.ignore[e.id] || 0) > t) continue;
      const d = a.pos.distanceTo(e.pos);
      const nearBed = myBed && G.dist2(e.pos.x, e.pos.z, myBed.x, myBed.z) < 9 * 9 && Math.abs(e.pos.y - S) < 6;
      const range = nearBed ? 30 : this.state === 'rush' ? 9 : 12;
      if ((d < range || (this.enemy === e && t - this.seen < 6 && d < 22)) && Math.abs(e.pos.y - a.pos.y) < 5 && d < bd) { best = e; bd = d; }
    }
    if (best) {
      if (this.enemy !== best || this.state !== 'fight') { this.reactAt = t + this.sk.react; this.fightStart = t; if (this.state !== 'fight') this.prevState = this.state; }
      this.enemy = best; this.seen = t; this.state = 'fight'; return;
    }
    if (this.state === 'fight') this.state = this.prevState === 'rush' ? 'rush' : 'farm';
    this.enemy = null;
    // heal up between fights
    if (a.hp < 45 && a.count('gapple') && a.useCd <= 0) G.game.useItem(a, 'gapple');
    // defend: cover the bed once we can afford it
    if (myBed && !this.covered && (this.role === 'defend' || t > 12)) {
      if (a.blockCount() >= 10) { this.state = 'cover'; return; }
    }
    if (this.state === 'cover') return;
    // shopping, only while on our own island (no walking back mid-rush)
    const atHome = G.dist2(a.pos.x, a.pos.z, this.home.cx, this.home.cz) < 14 * 14;
    const want = atHome ? this.shoppingList() : null;
    if (want) { this.state = 'shop'; this.shopItem = want; return; }
    // rush when equipped
    const rushReady = t > this.firstRush && a.blockCount() >= 20 && (this.role === 'rush' || t > this.firstRush * 2.2);
    if (rushReady && this.state !== 'rush') { this.pickTarget(); if (this.targetTeam >= 0 || this.targetActor) this.state = 'rush'; }
    if (this.state === 'rush') {
      if (a.blockCount() < 4 && !this.nearTarget()) { this.state = 'farm'; this.farmUntil = t + G.rand(15, 25); }
      else if (this.targetTeam >= 0 && !g.teams[this.targetTeam].bedAlive) this.pickTarget();
      return;
    }
    if (this.state === 'farm' && t > this.farmUntil && !want) {
      if (this.role === 'defend' && g.teams[a.team].bedAlive && t < 300) { this.farmUntil = t + 20; return; }
      if (G.chance(0.25) && this.diff !== 'easy' && a.blockCount() >= 24) { this.state = 'diamonds'; this.diaGoal = this.nearestDiamond(); this.diaUntil = t + 60; return; }
      this.farmUntil = t + 10;
    }
    if (this.state === 'diamonds') {
      const far = !this.diaGoal || G.dist2(a.pos.x, a.pos.z, this.diaGoal.x, this.diaGoal.z) > 9;
      if (a.res.diamond >= 4 || t > this.diaUntil || (far && a.blockCount() < 2)) { this.state = 'farm'; this.farmUntil = t + 8; }
    }
  }
  nearTarget() { return this.goal && G.dist2(this.a.pos.x, this.a.pos.z, this.goal.x, this.goal.z) < 36; }
  nearestDiamond() {
    let b = null, bd = 1e9;
    for (const d of G.game.map.diamond) { const k = G.dist2(d.x, d.z, this.a.pos.x, this.a.pos.z); if (k < bd) { bd = k; b = d; } }
    return b;
  }
  pickTarget() {
    const g = G.game, a = this.a;
    let bt = -1, bd = 1e9;
    for (const tm of g.teams) {
      if (tm.id === a.team || tm.eliminated) continue;
      const m = g.map.teams[tm.id];
      const d = G.dist2(m.cx, m.cz, a.pos.x, a.pos.z) * (tm.bedAlive ? 1 : 2.5) * G.rand(0.7, 1.3);
      if (d < bd) { bd = d; bt = tm.id; }
    }
    this.targetTeam = bt; this.targetActor = null;
    if (bt >= 0 && !g.teams[bt].bedAlive) {
      this.targetActor = g.actors.find(e => e.team === bt && e.alive) || null;
    }
  }
  shoppingList() {
    const a = this.a, r = a.res, sw = a.bestSword();
    const swTier = sw ? G.ITEMS[sw.id].tier : -1;
    const tm = G.game.teams[a.team];
    if (a.blockCount() < 16 && r.iron >= 4) return { id: 'wool' };
    if (swTier < 1 && r.iron >= 10) return { id: 'sword_stone' };
    if (a.armor === 'leather' && r.iron >= 24) return { armor: 'chain' };
    if (a.blockCount() < 48 && r.iron >= 8 && this.state !== 'rush') return { id: 'wool' };
    if (swTier < 2 && r.gold >= 7) return { id: 'sword_iron' };
    if ((a.armor === 'chain' || a.armor === 'leather') && r.gold >= 12) return { armor: 'iron' };
    if (!a.pickTier && r.iron >= 10) return { tool: 'pick' };
    if (!a.shears && r.iron >= 20 && this.diff !== 'easy') return { id: 'shears' };
    if (a.count('gapple') < 2 && r.gold >= 3) return { id: 'gapple' };
    if (this.diff === 'hard' && !a.count('bow') && r.gold >= 12) return { id: 'bow' };
    if (a.count('bow') && a.count('arrow') < 8 && r.gold >= 2) return { id: 'arrow' };
    if (this.diff !== 'easy' && a.count('fireball') < 2 && r.iron >= 40 && a.slots.includes(null)) return { id: 'fireball' };
    if (a.blockCount() < 64 && r.iron >= 28 && this.state !== 'rush' && a.slots.includes(null)) return { id: 'wool' };
    if (r.emerald >= 4 && swTier < 3) return { id: 'sword_diamond' };
    if (r.emerald >= 6 && a.armor !== 'diamond') return { armor: 'diamond' };
    if (r.diamond >= 1) {
      for (const u of ['sharp', 'prot', 'forge', 'heal', 'trap']) {
        const def = G.UPGRADES.find(x => x.id === u), lvl = tm.up[u];
        if (lvl < def.max && r.diamond >= def.cost[lvl]) return { upgrade: u };
      }
    }
    return null;
  }

  /* ---------- per-frame ---------- */
  update(dt) {
    const a = this.a, g = G.game;
    if (!a.alive) return;
    this.think -= dt;
    if (this.think <= 0) { this.think = this.sk.think * G.rand(0.7, 1.3); this.decide(); }
    a.sneak = false; a.bridging = false; a.sprint = false;
    this.wantJump = false;
    // stranded at an edge without blocks: buy some at the nearest shop, or jump and respawn
    if (this.gapBlocked) this.strandT = (this.strandT || 0) + dt; else this.strandT = Math.max(0, (this.strandT || 0) - dt);
    this.gapBlocked = false;
    if (this.strandT > 3 && this.state !== 'shop') {
      this.strandT = 0;
      let shop = null, bd = 30 * 30;
      for (const m of g.map.teams) { const d = G.dist2(a.pos.x, a.pos.z, m.shop.pos.x, m.shop.pos.z); if (d < bd) { bd = d; shop = m.shop; } }
      if (shop && a.res.iron >= 4) { this.state = 'shop'; this.shopAt = shop; this.shopItem = { id: 'wool' }; }
      else if (g.teams[a.team].bedAlive) this.jumpOff = true;
    }
    if (a.alive && a.pos.y < G.SURF - 3) this.jumpOff = false;
    let wish = null;
    switch (this.state) {
      case 'fight': wish = this.fight(dt); break;
      case 'cover': wish = this.cover(dt); break;
      case 'shop': wish = this.shop(dt); break;
      case 'rush': wish = this.rush(dt); break;
      case 'diamonds': wish = this.diaGoal ? this.moveTo(this.diaGoal.x, this.diaGoal.z, dt, 0.6) : null; if (!wish && this.diaGoal) this.idleLook(dt); break;
      default: wish = this.moveTo(this.home.gen.x + Math.sin(g.time * 0.7 + a.id) * 0.6, this.home.gen.z + Math.cos(g.time * 0.5 + a.id) * 0.6, dt, 0.4); if (!wish) this.idleLook(dt);
    }
    let wx = 0, wz = 0;
    if (wish) { wx = wish.x; wz = wish.z; }
    this.unstick(dt, wish);
    a.physics(dt, wx, wz, this.wantJump);
  }
  idleLook(dt) { this.a.pitch = G.lerp(this.a.pitch, -0.1, dt * 2); }
  face(x, y, z, dt, err = 0) {
    const a = this.a, e = a.eye;
    const yaw = Math.atan2(-(x - e.x), -(z - e.z)) + err;
    const pitch = Math.atan2(y - e.y, Math.hypot(x - e.x, z - e.z));
    a.yaw += G.angleWrap(yaw - a.yaw) * Math.min(1, dt * 12);
    a.pitch = G.lerp(a.pitch, pitch, Math.min(1, dt * 10));
  }
  // Walk toward (x,z). Handles jumping up single blocks, breaking placed walls and bridging over the void.
  moveTo(x, z, dt, stopDist = 0.5, o = {}) {
    const a = this.a;
    const dx = x - a.pos.x, dz = z - a.pos.z, d = Math.hypot(dx, dz);
    if (d < stopDist) return null;
    const nx = dx / d, nz = dz / d;
    if (!o.noFace) { const yaw = Math.atan2(-nx, -nz); a.yaw += G.angleWrap(yaw - a.yaw) * Math.min(1, dt * 8); a.pitch = G.lerp(a.pitch, 0, dt * 3); }
    a.sprint = d > 4 && !o.slow;
    const fy = Math.floor(a.pos.y + 0.01);
    // look ahead
    const ax = a.pos.x + nx * 0.75, az = a.pos.z + nz * 0.75;
    const cx = Math.floor(ax), cz = Math.floor(az);
    const feetBlocked = G.solidH(cx, fy, cz) > 0.6, headBlocked = G.solidH(cx, fy + 1, cz) > 0;
    if (feetBlocked || headBlocked) {
      const above = G.solidH(cx, fy + 2, cz) > 0;
      if (feetBlocked && !headBlocked && !above && G.solidH(Math.floor(a.pos.x), fy + 2, Math.floor(a.pos.z)) === 0) this.wantJump = true;
      else {
        // a wall: break it if it was built by a player
        const by = headBlocked ? fy + 1 : fy;
        if (a.canBreak(cx, by, cz)) { this.face(cx + 0.5, by + 0.5, cz + 0.5, dt); this.equipBest(cx, by, cz); a.dig(dt, cx, by, cz); return null; }
        if (feetBlocked && a.canBreak(cx, fy, cz)) { a.dig(dt, cx, fy, cz); return null; }
      }
    }
    // is there ground ahead?
    let ground = false;
    for (let k = 1; k <= 3; k++) if (G.solidH(cx, fy - k, cz)) { ground = true; break; }
    if (!ground && a.onGround) {
      if (this.jumpOff) return { x: nx, z: nz }; // stranded with a bed: walk off and respawn
      if (a.blockCount() <= 0) { this.gapBlocked = true; return null; } // nothing to bridge with
      a.bridging = true; a.sneak = false;
      this.bridgeStep(nx, nz, fy, dt);
      const sp = this.sk.bridge / 6.0; // bridging walks slower than sprinting
      a.sprint = false;
      return { x: nx * sp, z: nz * sp };
    }
    return { x: nx, z: nz };
  }
  bridgeStep(nx, nz, fy, dt) {
    const a = this.a;
    const i = a.firstBlockSlot(); if (i < 0) return;
    a.sel = i;
    const y = fy - 1;
    const px = Math.floor(a.pos.x), pz = Math.floor(a.pos.z);
    const tx = Math.floor(a.pos.x + nx * 0.9), tz = Math.floor(a.pos.z + nz * 0.9);
    a.pitch = G.lerp(a.pitch, -1.1, dt * 8);
    this.placeT = (this.placeT || 0) - dt;
    if (this.placeT > 0) return;
    const tryAt = (x, z) => a.placeBlock(x, y, z, i);
    if (!wd.get(px, y, pz) && tryAt(px, pz)) { this.placeT = 0.12; return; }
    if (wd.get(tx, y, tz)) return;
    if (tryAt(tx, tz) || tryAt(tx, pz) || tryAt(px, tz)) this.placeT = 0.14 / (this.sk.bridge / 3);
  }
  equipBest(x, y, z) {
    const a = this.a, b = G.BLOCKS[wd.get(x, y, z)]; if (!b) return;
    const want = b.tool === 'pick' ? 'pick' : b.tool === 'axe' ? 'axe' : b.tool === 'shears' ? 'shears' : 'sword';
    const i = a.slots.findIndex(s => s && G.ITEMS[s.id].kind === want);
    if (i >= 0) a.sel = i;
  }
  equipSword() { const a = this.a; const i = a.slots.findIndex(s => s && G.ITEMS[s.id].kind === 'sword'); if (i >= 0) a.sel = i; }
  unstick(dt, wish) {
    const a = this.a;
    if (!wish || this.state === 'fight') { this.stuck = 0; this.lastPos.copy(a.pos); return; }
    const moved = G.dist2(a.pos.x, a.pos.z, this.lastPos.x, this.lastPos.z);
    this.stuckT = (this.stuckT || 0) + dt;
    if (this.stuckT > 0.8) {
      if (moved < 0.15 && !a.bridging) this.stuck++; else this.stuck = 0;
      this.stuckT = 0; this.lastPos.copy(a.pos);
      if (this.stuck >= 2) this.wantJump = true;
      if (this.stuck >= 5) { this.stuck = 0; this.goal = null; if (this.state === 'rush') this.pickTarget(); else this.state = 'farm'; }
    }
  }

  /* ---------- behaviours ---------- */
  fight(dt) {
    const a = this.a, e = this.enemy, g = G.game;
    if (!e || !e.alive) { this.state = 'farm'; return null; }
    const d = a.pos.distanceTo(e.pos);
    const bowOk = a.count('bow') && a.count('arrow') && d > 9 && d < 28;
    if (bowOk) return this.shootBow(dt, e, d);
    // lob a fireball at enemies standing on bridges
    if (a.count('fireball') && d > 5 && d < 18 && a.useCd <= 0 && G.chance(dt * 0.5)) {
      a.sel = a.slots.findIndex(s => s && s.id === 'fireball');
      this.face(e.pos.x, e.pos.y + 0.8, e.pos.z, 1);
      G.game.useItem(a, 'fireball');
    }
    this.equipSword();
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = G.rand(0.4, 1.2); this.strafe = G.chance(0.5) ? 1 : -1; }
    const err = Math.sin(g.time * 3 + a.id) * this.sk.aim;
    this.face(e.pos.x, e.pos.y + 1.2, e.pos.z, dt, err);
    let wish = null;
    if (d > 2.4) wish = this.moveTo(e.pos.x, e.pos.z, dt, 0.5, { noFace: true });
    else {
      // strafe around the target and w-tap
      const yaw = a.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
      const fwd = d > 1.6 ? 0.6 : -0.3;
      const wx = fx * fwd + rx * this.strafe * 0.8, wz = fz * fwd + rz * this.strafe * 0.8;
      // never strafe into the void
      const ax = Math.floor(a.pos.x + wx), az = Math.floor(a.pos.z + wz);
      let ground = false; for (let k = 1; k <= 3; k++) if (G.solidH(ax, Math.floor(a.pos.y) - k, az)) ground = true;
      wish = ground ? { x: wx, z: wz } : { x: fx * 0.3, z: fz * 0.3 };
      if (this.diff !== 'easy' && G.chance(dt * 0.8) && a.onGround) this.wantJump = true;
    }
    a.sprint = true;
    if (d < 3.3 && g.time > (this.reactAt || 0) && a.atkCd <= 0 && G.chance(this.sk.cps)) {
      if (G.chance(this.sk.hit)) a.attack(e); else { a.atkCd = 0.42; a.avatar.swing = 1; G.audio.swing(); }
    }
    return wish;
  }
  shootBow(dt, e, d) {
    const a = this.a;
    const i = a.slots.findIndex(s => s && s.id === 'bow'); if (i < 0) return null;
    a.sel = i;
    const flight = d / 34;
    const lead = new V3(e.pos.x + e.vel.x * flight, e.pos.y + 1.1 + d * d * 0.0085, e.pos.z + e.vel.z * flight);
    this.face(lead.x, lead.y, lead.z, dt, (Math.random() - 0.5) * this.sk.aim);
    a.bowDraw += dt;
    if (a.bowDraw > 1.0) { G.game.fireBow(a, 1); a.bowDraw = 0; }
    return null;
  }
  cover(dt) {
    const a = this.a, home = this.home, g = G.game;
    if (!g.teams[a.team].bedAlive) { this.covered = true; this.state = 'farm'; return null; }
    const cells = [];
    const bedSet = new Set(home.bed.map(b => b.x + ',' + b.z));
    for (const b of home.bed) {
      cells.push([b.x, b.y + 1, b.z]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!bedSet.has((b.x + dx) + ',' + (b.z + dz))) cells.push([b.x + dx, b.y, b.z + dz]);
    }
    // second layer for harder bots
    if (this.diff !== 'easy' && a.blockCount() > 24) for (const b of home.bed) {
      cells.push([b.x, b.y + 2, b.z]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!bedSet.has((b.x + dx) + ',' + (b.z + dz))) cells.push([b.x + dx, b.y + 1, b.z + dz]);
    }
    const todo = cells.filter(([x, y, z]) => !wd.get(x, y, z));
    if (!todo.length || a.blockCount() <= 0) { this.covered = !todo.length || this.covered; this.state = 'farm'; this.farmUntil = g.time + G.rand(15, 30); return null; }
    // stand beside the bed (left or right side), where every cover block is within reach
    const r = home.right, side = (a.id % 2) ? 1 : -1;
    const bcx = (home.bed[0].x + home.bed[1].x) / 2 + 0.5, bcz = (home.bed[0].z + home.bed[1].z) / 2 + 0.5;
    const sx = bcx + r[0] * 2.3 * side, sz = bcz + r[1] * 2.3 * side;
    if (Math.hypot(sx - a.pos.x, sz - a.pos.z) > 0.9) return this.moveTo(sx, sz, dt, 0.5);
    const e = a.eye;
    const free = todo.filter(([x, y, z]) => !g.actors.some(o => o.overlapsCell(x, y, z)) && Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y, z + 0.5 - e.z) < 4.6);
    if (!free.length) { this.coverTries = (this.coverTries || 0) + dt; if (this.coverTries > 4) { this.coverTries = 0; this.covered = true; this.state = 'farm'; } return null; }
    const [x, y, z] = free[0];
    this.face(x + 0.5, y + 0.5, z + 0.5, dt);
    this.placeT = (this.placeT || 0) - dt;
    if (this.placeT <= 0) {
      const i = a.firstBlockSlot();
      if (i >= 0) { a.sel = i; a.placeBlock(x, y, z, i); }
      this.placeT = this.diff === 'hard' ? 0.18 : 0.28;
    }
    return null;
  }
  shop(dt) {
    const a = this.a, it = this.shopItem;
    if (!it) { this.state = 'farm'; return null; }
    const kp = it.upgrade ? this.home.upg.pos : (this.shopAt || this.home.shop).pos;
    const w = this.moveTo(kp.x, kp.z, dt, 2.2);
    if (w) return w;
    if (Math.hypot(kp.x - a.pos.x, kp.z - a.pos.z) > 3.4) { this.state = 'farm'; this.shopAt = null; return null; } // cannot get there
    if (it.upgrade) G.game.buyUpgrade(a, it.upgrade);
    else G.game.buy(a, G.SHOP.find(e => (it.id && e.id === it.id) || (it.armor && e.armor === it.armor) || (it.tool && e.tool === it.tool)));
    const away = !!this.shopAt;
    this.shopItem = away ? (a.res.iron >= 4 && a.blockCount() < 32 ? { id: 'wool' } : null) : this.shoppingList();
    if (!this.shopItem) { this.shopAt = null; this.state = away ? (this.prevState === 'rush' ? 'rush' : 'farm') : 'farm'; this.farmUntil = G.game.time + G.rand(4, 10); }
    return null;
  }
  rush(dt) {
    const a = this.a, g = G.game;
    if (this.targetTeam < 0 && !this.targetActor) { this.state = 'farm'; return null; }
    if (this.targetActor) {
      const e = this.targetActor;
      if (!e.alive) { this.pickTarget(); return null; }
      return this.moveTo(e.pos.x, e.pos.z, dt, 1.5);
    }
    const m = g.map.teams[this.targetTeam];
    const bed = m.bed[0], bed2 = m.bed[1];
    const bc = new V3((bed.x + bed2.x) / 2 + 0.5, S + 0.3, (bed.z + bed2.z) / 2 + 0.5);
    const d = Math.hypot(bc.x - a.pos.x, bc.z - a.pos.z);
    if (d > 2.6) {
      // approach from the front of the island (the side facing the middle)
      if (d > 10) { const f = m.fwd; return this.moveTo(bc.x + f[0] * 4, bc.z + f[1] * 4, dt, 1.2); }
      return this.moveTo(bc.x, bc.z, dt, 2.2);
    }
    // at the bed: dig through whatever covers it
    const e = a.eye, dir = bc.clone().sub(e).normalize();
    const hit = wd.raycast(e, dir, 5);
    if (hit) {
      if (a.canBreak(hit.x, hit.y, hit.z)) { this.face(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, dt); this.equipBest(hit.x, hit.y, hit.z); a.dig(dt, hit.x, hit.y, hit.z); return null; }
    }
    // try each bed cell and the blocks around it
    for (const b of m.bed) {
      for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 0, 0]]) {
        const x = b.x + dx, y = b.y + dy, z = b.z + dz;
        if (wd.get(x, y, z) && a.canBreak(x, y, z) && Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y, z + 0.5 - e.z) < 4.2) {
          if (dx === 0 && dy === 0 && dz === 0 && wd.get(x, y + 1, z) && a.canBreak(x, y + 1, z)) continue;
          this.face(x + 0.5, y + 0.5, z + 0.5, dt); this.equipBest(x, y, z); a.dig(dt, x, y, z); return null;
        }
      }
    }
    // stuck by unbreakable blocks: walk around the bed
    const ang = g.time * 0.8 + a.id;
    return this.moveTo(bc.x + Math.cos(ang) * 2, bc.z + Math.sin(ang) * 2, dt, 0.3);
  }
}
G.Bot = Bot;
})();
