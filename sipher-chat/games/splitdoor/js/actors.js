'use strict';
// Actors: shared movement/combat for player and bots, plus the first-person player controller.
G.SUITS = [
  { n: 'Porcelain', c: '#e6e9ee', lv: 1 }, { n: 'Graphite', c: '#40454f', lv: 1 }, { n: 'Signal', c: '#ff7a2a', lv: 3 },
  { n: 'Cobalt', c: '#2f6bff', lv: 5 }, { n: 'Moss', c: '#6f8f4a', lv: 7 }, { n: 'Crimson', c: '#c8323c', lv: 9 },
  { n: 'Gold Leaf', c: '#d4a83a', lv: 12 }, { n: 'Void', c: '#17191e', lv: 15 },
];
G.ACCENTS = [
  { n: 'Factory', c: null, lv: 1 }, { n: 'Arctic', c: '#7fe8ff', lv: 2 }, { n: 'Toxic', c: '#7dff4a', lv: 4 },
  { n: 'Plasma', c: '#ff3fd0', lv: 6 }, { n: 'Ember', c: '#ff6a1a', lv: 8 }, { n: 'Prism', c: '#ffffff', lv: 10 },
];
G.TEAM = [
  { name: 'ATLAS', color: '#3fb8ff', suit: '#e3e8ee', doors: ['#36d6ff', '#7d6bff'] },
  { name: 'HELIX', color: '#ff5040', suit: '#d5d1cc', doors: ['#ff3b5c', '#ffb02e'] },
];
G.PLAYER_DOORS = ['#2e86ff', '#ff8a1a'];
G.FFA_COLORS = ['#ff5040', '#4dff7a', '#ffd23f', '#c46bff', '#ff8a2a', '#ff5cb8', '#5ef0e6', '#a0ff3f', '#ff9c9c', '#7f9cff', '#ffffff'];
G.grav = () => (G.match && G.match.mut && G.match.mut.lowgrav ? 0.45 : 1);

(() => {
  const WALK = 7.5, SPRINT = 10.5, CROUCH = 4.0, GRAV = 19, JUMP_V = 7.2, R = 0.4;
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4(), _tmp = [], _ign = [];

  class Actor {
    constructor(o) {
      this.team = o.team; this.name = o.name; this.isPlayer = !!o.isPlayer;
      this.suit = o.suit; this.accent = o.accent; this.portalColors = o.doors;
      this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0;
      this.alive = false; this.hp = 100; this.maxHp = 100; this.shield = 100; this.maxShield = 100; this.over = 0;
      this.regenDelay = 0; this.invuln = 0; this.respawnT = 0;
      this.crouched = false; this.sliding = 0; this.jetFuel = 1; this.jetDelay = 0; this.jetting = false;
      this.onGround = false; this.wasGround = false; this.airTime = 0; this.jumpReleased = true; this.prevVy = 0;
      this.slots = ['ar', 'sidearm', null]; this.mags = {}; this.reserve = {}; this.cur = 'ar';
      this.fireCd = 0; this.reloadT = 0; this.switchT = 0; this.burstLeft = 0; this.burstT = 0; this.ads = 0; this.bloom = 0;
      this.meleeCd = 0; this.meleeAnim = 0; this.grenades = 2; this.grenCd = 0; this.grenRegen = 0;
      this.stats = { kills: 0, deaths: 0, assists: 0, streak: 0, best: 0, headshots: 0, doorKills: 0, shots: 0, hits: 0, damage: 0, medals: 0, score: 0, obj: 0, doors: 0 };
      this.multi = 0; this.lastKillT = -10; this.lastKiller = null; this.lastDoorT = -10; this.damagers = new Map();
      this.portals = G.portals.create(this, this.portalColors);
      this.model = G.models.robot(this.suit, this.accent); G.scene.add(this.model); this.model.visible = false;
      this.gunModel = null; this.animPhase = 0; this.hasKey = false;
      this.dmgMul = 1;
    }
    height() { return (this.crouched || this.sliding > 0) ? 1.1 : 1.8; }
    eyeH() { return (this.crouched || this.sliding > 0) ? 1.0 : 1.62; }
    pivotY() { return this.isPlayer ? this.eyeH() : 0.9; }
    eye(out) { return (out || new THREE.Vector3()).set(this.pos.x, this.pos.y + this.eyeH(), this.pos.z); }
    center(out) { return (out || new THREE.Vector3()).set(this.pos.x, this.pos.y + this.height() * 0.5, this.pos.z); }
    hspeed() { return Math.hypot(this.vel.x, this.vel.z); }
    W() { return G.WEAPONS[this.cur]; }

    // ray vs body box + head sphere
    rayTest(o, d, maxT, pad = 0) {
      const h = this.height(), x = this.pos.x, y = this.pos.y, z = this.pos.z;
      let best = null;
      // head
      const hc = _v2.set(x, y + h - 0.2, z), rr = 0.27 + pad;
      const ocx = o.x - hc.x, ocy = o.y - hc.y, ocz = o.z - hc.z;
      const b = ocx * d.x + ocy * d.y + ocz * d.z, c = ocx * ocx + ocy * ocy + ocz * ocz - rr * rr, disc = b * b - c;
      if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < maxT) best = { t, head: true }; }
      // body
      const bx0 = x - 0.42 - pad, bx1 = x + 0.42 + pad, by0 = y, by1 = y + h - 0.38, bz0 = z - 0.42 - pad, bz1 = z + 0.42 + pad;
      let t0 = -Infinity, t1 = Infinity;
      for (const [oo, dd, lo, hi] of [[o.x, d.x, bx0, bx1], [o.y, d.y, by0, by1], [o.z, d.z, bz0, bz1]]) {
        if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return best; continue; }
        let a1 = (lo - oo) / dd, a2 = (hi - oo) / dd; if (a1 > a2) [a1, a2] = [a2, a1];
        if (a1 > t0) t0 = a1; if (a2 < t1) t1 = a2;
      }
      if (t0 <= t1 && t0 > 0 && t0 < maxT && (!best || t0 < best.t - 0.05)) best = { t: t0, head: false };
      return best;
    }

    // ---------------------------------------------------------------- movement
    move(dt, I) {
      const v = this.vel;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      let wx = rx * I.mx - fx * I.mz, wz = rz * I.mx - fz * I.mz;
      const wl = Math.min(1, Math.hypot(wx, wz));
      if (wl > 0.01) { const k = Math.hypot(wx, wz); wx /= k; wz /= k; } else { wx = 0; wz = 0; }
      this.wx = wx * wl; this.wz = wz * wl;
      const onG = this.onGround;
      const hs = this.hspeed();
      if (I.crouchPressed && onG && hs > 8 && this.sliding <= 0) {
        this.sliding = 0.9; v.x += v.x / hs * 4.5; v.z += v.z / hs * 4.5;
        this.onSlide && this.onSlide();
      }
      if (this.sliding > 0) { this.sliding -= dt; if (!I.crouch) this.sliding = 0; }
      this.setCrouch(I.crouch || this.sliding > 0);
      let max = I.sprint && I.mz < 0.2 ? SPRINT : WALK;
      if (this.crouched && this.sliding <= 0) max = CROUCH;
      if (this.ads > 0.5) max = Math.min(max, WALK * 0.7);
      if (this.hasKey) max *= 0.92;
      if (onG) {
        this.airTime = 0;
        this.friction(dt, this.sliding > 0 ? 0.5 : 7);
        this.accel(wx, wz, max * wl, this.sliding > 0 ? 1.2 : 11, dt);
        if (I.jumpPressed) { v.y = JUMP_V * Math.sqrt(G.grav()); this.jumpReleased = false; this.sliding = 0; this.onJump && this.onJump(); }
      } else {
        this.airTime += dt;
        this.accel(wx, wz, Math.max(max, 1) * wl, 2.4, dt);
        if (!I.jump) this.jumpReleased = true;
      }
      const inf = G.match && G.match.mut && G.match.mut.infjet;
      this.jetting = !this.onGround && I.jump && this.jetFuel > 0 && (this.jumpReleased || this.airTime > 0.35);
      if (this.jetting) { v.y = Math.min(v.y + 37 * dt, 6.5); if (!inf) this.jetFuel = Math.max(0, this.jetFuel - 0.7 * dt); this.jetDelay = 0.8; }
      v.y -= GRAV * G.grav() * dt;
      this.prevVy = v.y;
      this.wasGround = this.onGround;
      this.collide(dt);
      if (this.onGround && !this.wasGround && this.prevVy < -7) this.onLand && this.onLand(this.prevVy);
      if (this.onGround) { this.jetDelay -= dt; if (this.jetDelay <= 0) this.jetFuel = Math.min(1, this.jetFuel + 0.6 * dt); }
      if (this.pos.y < G.world.map.killY) this.takeDamage(9999, this.lastHitBy && G.t - this.lastHitT < 6 ? this.lastHitBy : null, { weapon: 'void', void: true });
    }
    friction(dt, f) {
      const sp = this.hspeed();
      if (sp < 0.05) { this.vel.x = 0; this.vel.z = 0; return; }
      const drop = Math.max(sp, 4) * f * dt, k = Math.max(sp - drop, 0) / sp;
      this.vel.x *= k; this.vel.z *= k;
    }
    accel(dx, dz, wish, a, dt) {
      if (!dx && !dz) return;
      const cur = this.vel.x * dx + this.vel.z * dz, add = wish - cur;
      if (add <= 0) return;
      const s = Math.min(a * wish * dt, add);
      this.vel.x += dx * s; this.vel.z += dz * s;
    }
    setCrouch(c) {
      if (c === this.crouched) return;
      if (!c && G.world.overlap(this.pos.x - R, this.pos.y + 0.05, this.pos.z - R, this.pos.x + R, this.pos.y + 1.8, this.pos.z + R, _ign, _tmp).length) return;
      this.crouched = c;
    }
    collide(dt) {
      const v = this.vel, p = this.pos, W = G.world;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt / 0.22));
      const h = dt / steps;
      const groundedPrev = this.onGround;
      this.onGround = false;
      const prevPivot = new THREE.Vector3(), newPivot = new THREE.Vector3();
      for (let s = 0; s < steps; s++) {
        prevPivot.set(p.x, p.y + this.pivotY(), p.z);
        G.portals.ignoreFor(prevPivot, _ign);
        this.axis(0, v.x * h, groundedPrev); this.axis(2, v.z * h, groundedPrev); this.axis(1, v.y * h, groundedPrev);
        this.rampFix(groundedPrev);
        if (groundedPrev && !this.onGround && v.y <= 0.01 && !_ign.length) {
          const gy = W.groundAt(p.x, p.z, p.y + 0.02, 0);
          if (gy > -1e8 && p.y - gy < 0.45 && p.y - gy >= -0.01) { p.y = gy; v.y = 0; this.onGround = true; }
        }
        newPivot.set(p.x, p.y + this.pivotY(), p.z);
        if (_ign.length && G.portals.clampInside(newPivot)) { p.x = newPivot.x; p.z = newPivot.z; p.y = newPivot.y - this.pivotY(); }
        const door = G.portals.crossed(prevPivot, newPivot);
        if (door) { this.teleport(door, newPivot); break; }
      }
    }
    axis(ax, amt, groundedPrev) {
      if (amt === 0) return;
      const p = this.pos, v = this.vel, W = G.world, hgt = this.height();
      if (ax === 0) p.x += amt; else if (ax === 1) p.y += amt; else p.z += amt;
      const list = W.overlap(p.x - R, p.y, p.z - R, p.x + R, p.y + hgt, p.z + R, _ign, _tmp).slice();
      for (const i of list) {
        const b = W.boxes[i];
        // re-test: previous pushes may have resolved it
        if (p.x + R <= b.min[0] || p.x - R >= b.max[0] || p.y + hgt <= b.min[1] || p.y >= b.max[1] || p.z + R <= b.min[2] || p.z - R >= b.max[2]) continue;
        if (ax === 1) {
          if (amt < 0) { p.y = b.max[1]; v.y = 0; this.onGround = true; }
          else { p.y = b.min[1] - hgt - 0.001; v.y = Math.min(v.y, 0); }
        } else {
          const step = b.max[1] - p.y;
          if ((groundedPrev || this.onGround) && step > 0 && step <= 0.56 &&
            !W.overlap(p.x - R, b.max[1] + 0.002, p.z - R, p.x + R, b.max[1] + hgt, p.z + R, _ign, []).length) { p.y = b.max[1] + 0.001; continue; }
          // mantle: airborne and pushing into a ledge within reach, with standing room on top -> boost up and over
          if (!groundedPrev && !this.onGround && step > 0.56 && step <= 1.95 && v.y > -9 && (ax === 0 ? this.wx : this.wz) * Math.sign(amt) > 0.5 &&
            !W.overlap(p.x - R, b.max[1] + 0.002, p.z - R, p.x + R, b.max[1] + hgt, p.z + R, _ign, []).length) {
            v.y = Math.max(v.y, 7.4);
            if (G.t - (this._mantleT || -9) > 0.6) { this._mantleT = G.t; this.onMantle && this.onMantle(); }
          }
          const c = ax === 0 ? 'x' : 'z';
          if (amt > 0) p[c] = b.min[ax] - R - 0.001; else p[c] = b.max[ax] + R + 0.001;
          v[c] = 0;
        }
      }
    }
    rampFix(groundedPrev) {
      const p = this.pos, v = this.vel, W = G.world;
      for (const r of W.ramps) {
        if (p.x < r.x0 - 0.1 || p.x > r.x1 + 0.1 || p.z < r.z0 - 0.1 || p.z > r.z1 + 0.1) continue;
        const hy = W.rampHeight(r, G.clamp(p.x, r.x0, r.x1), G.clamp(p.z, r.z0, r.z1));
        const inside = p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;
        if (!inside) continue;
        if (p.y < hy + 0.001 && p.y > hy - 0.9) { p.y = hy; if (v.y < 0) v.y = 0; this.onGround = true; }
        else if (groundedPrev && v.y <= 0.01 && p.y >= hy && p.y - hy < 0.4) { p.y = hy; v.y = 0; this.onGround = true; }
        else if (p.y <= hy - 0.9 && p.y + this.height() > Math.min(r.y0, r.y1)) {
          // walked into the side of the wedge: push out sideways
          const opts = r.axis === 'x' ? [['z', r.z0 - R - 0.01, Math.abs(p.z - r.z0)], ['z', r.z1 + R + 0.01, Math.abs(p.z - r.z1)]] : [['x', r.x0 - R - 0.01, Math.abs(p.x - r.x0)], ['x', r.x1 + R + 0.01, Math.abs(p.x - r.x1)]];
          opts.sort((a, b) => a[2] - b[2]); p[opts[0][0]] = opts[0][1]; v[opts[0][0]] = 0;
        }
      }
    }
    teleport(door, pivot) {
      const q = door.twin, M = door.travel(_m);
      const np = pivot.clone().applyMatrix4(M);
      const sp = this.vel.length();
      this.vel.transformDirection(M).multiplyScalar(sp);
      const n = q.normal, minExit = n.y > 0.5 ? 6 : 3.5;
      const vn = this.vel.dot(n); if (vn < minExit) this.vel.addScaledVector(n, minExit - vn);
      const s = R * (Math.abs(n.x) + Math.abs(n.z)) + (n.y > 0 ? this.pivotY() * n.y : (this.height() - this.pivotY()) * -n.y);
      const d = _v.copy(np).sub(q.center).dot(n);
      if (d < s + 0.05) np.addScaledVector(n, s + 0.05 - d);
      this.pos.set(np.x, np.y - this.pivotY(), np.z);
      const f = G.fwdFrom(this.yaw, this.pitch, _v).transformDirection(M);
      this.yaw = G.yawOf(f); this.pitch = G.clamp(Math.asin(G.clamp(f.y, -1, 1)), -1.55, 1.55);
      this.lastDoorT = G.t; this.stats.doors++; this.onGround = false; this.jumpReleased = true;
      this.onTeleport && this.onTeleport(door, q);
      if (!this.isPlayer) G.audio.play('portalPass', { pos: this.pos, vol: 0.7 });
    }

    // ---------------------------------------------------------------- health
    takeDamage(amount, attacker, info = {}) {
      if (!this.alive) return 0;
      if (this.invuln > 0 && !info.void) return 0;
      if (attacker && attacker !== this && !G.match.enemies(this, attacker)) return 0;
      if (attacker === this) amount *= 0.5;
      this.regenDelay = 4.5;
      if (attacker && attacker !== this) { this.lastHitBy = attacker; this.lastHitT = G.t; const e = this.damagers.get(attacker) || 0; this.damagers.set(attacker, e + amount); attacker.stats.damage += amount; }
      let rem = amount, shieldHit = false;
      if (this.over > 0) { const a = Math.min(this.over, rem); this.over -= a; rem -= a; shieldHit = true; }
      if (this.shield > 0 && rem > 0) {
        const a = Math.min(this.shield, rem); this.shield -= a; rem -= a; shieldHit = true;
        if (this.shield <= 0) this.onShieldBreak && this.onShieldBreak();
      }
      this.hp -= rem;
      this.lastShieldHit = shieldHit && rem <= 0;
      this.onHurt && this.onHurt(amount, attacker, info);
      if (this.hp <= 0) { this.die(attacker, info); return 2; }
      return 1;
    }
    regen(dt) {
      this.regenDelay -= dt;
      if (this.over > 0) this.over = Math.max(0, this.over - 2.5 * dt);
      if (this.regenDelay <= 0 && this.shield < this.maxShield) {
        if (this.shield <= 0.01 || this._regenStart) { if (!this._regenStart) { this._regenStart = true; this.onRegen && this.onRegen(); } }
        this.shield = Math.min(this.maxShield, this.shield + 45 * dt);
        if (this.shield >= this.maxShield) this._regenStart = false;
      }
      if (this.regenDelay <= -1 && this.hp < this.maxHp && this.shield >= this.maxShield) this.hp = Math.min(this.maxHp, this.hp + 25 * dt);
    }
    die(attacker, info) {
      this.alive = false; this.hp = 0; this.jetting = false;
      this.model.visible = false;
      const c = this.center();
      G.fx.debrisBurst(c, this.suit, 14, 8, 0.16);
      G.fx.debrisBurst(c, this.accent, 6, 9, 0.1, 1);
      G.fx.burst(c, null, this.accent, 30, 7, 0.6, 0.12, 1.2, -6);
      G.fx.light(c, this.accent, 20, 0.4, 10);
      G.audio.play('death', { pos: c, vol: 0.9 });
      for (const p of this.portals) p.close();
      this.stats.deaths++;
      G.match.onKill(attacker, this, info);
      this.damagers.clear();
      this.streakBefore = this.stats.streak; this.stats.streak = 0; this.multi = 0;
      this.respawnT = G.match.respawnTime(this);
    }
    respawn(sp) {
      this.pos.set(sp[0], sp[1] + 0.02, sp[2]); this.vel.set(0, 0, 0); this.yaw = sp[3]; this.pitch = 0;
      this.hp = this.maxHp; this.shield = this.maxShield; this.over = 0; this.alive = true; this.invuln = 1.5;
      this.jetFuel = 1; this.grenades = 2; this.jammers = 1; this.jamRegen = 0; this.crouched = false; this.sliding = 0; this.lastHitBy = null;
      this.resetLoadout();
      this.model.visible = !this.isPlayer;
      G.fx.burst(this.center(), G._cy, this.accent, 30, 4, 0.7, 0.1, 0.6, 2);
    }
    resetLoadout() {
      const mut = G.match && G.match.mut;
      this.slots = mut && mut.railsonly ? ['rail', 'sidearm', null] : [this.primary || 'ar', this.secondary || 'sidearm', null];
      for (const id in G.WEAPONS) { this.mags[id] = G.WEAPONS[id].mag; this.reserve[id] = G.WEAPONS[id].reserve ?? -1; }
      if (G.match && G.match.mode === 'lock') { const id = G.LOCK_ORDER[Math.min(this.gunTier || 0, G.LOCK_ORDER.length - 1)]; this.slots = [id, null, null]; this.reserve[id] = -1; }
      if (mut && mut.railsonly) this.reserve.rail = -1;
      this.reloadT = 0; this.burstLeft = 0;
      this.equip(this.slots[0], true);
    }

    // ---------------------------------------------------------------- weapons
    equip(id, instant) {
      if (!id || (id === this.cur && !instant)) return;
      this.cur = id; this.reloadT = 0; this.burstLeft = 0; this.switchT = instant ? 0 : 0.32;
      this.onEquip && this.onEquip(id, instant);
      this.attachGun();
    }
    attachGun() {
      const P = this.model.userData.P;
      if (this.gunModel) P.gunMount.remove(this.gunModel);
      this.gunModel = G.models.gun(this.cur, this.accent); this.gunModel.scale.setScalar(0.85);
      P.gunMount.add(this.gunModel);
    }
    give(id) {
      this.slots[2] = id; this.mags[id] = G.WEAPONS[id].mag; this.reserve[id] = G.WEAPONS[id].reserve ?? -1;
      this.equip(id, false);
    }
    currentSpread() {
      const W = this.W();
      let s = G.lerp(W.spread, W.adsSpread, this.ads);
      if (this.cur !== 'scatter') {
        s += G.clamp(this.hspeed() / 10, 0, 1.5) * 0.9 * (1 - this.ads * 0.75);
        if (!this.onGround) s += 1.2 * (1 - this.ads * 0.5);
        s += this.bloom * (1 - this.ads * 0.6);
      }
      return s;
    }
    startReload() {
      const W = this.W();
      if (this.reloadT > 0 || this.mags[this.cur] >= W.mag) return;
      if (this.reserve[this.cur] === 0) {
        if (W.kind === 'power') { this.slots[2] = null; this.equip(this.slots[0]); }
        return;
      }
      this.reloadT = W.reload; this.burstLeft = 0;
      this.onReload && this.onReload();
    }
    finishReload() {
      const W = this.W(), need = W.mag - this.mags[this.cur];
      if (this.reserve[this.cur] < 0) this.mags[this.cur] = W.mag;
      else { const take = Math.min(need, this.reserve[this.cur]); this.mags[this.cur] += take; this.reserve[this.cur] -= take; }
    }
    // ctl: {fire, firePressed, ads, reload}
    tickWeapons(dt, ctl) {
      this.fireCd -= dt; this.meleeCd -= dt; this.grenCd -= dt; this.meleeAnim = Math.max(0, this.meleeAnim - dt * 3.5);
      if (this.grenades < 2) { this.grenRegen += dt; if (this.grenRegen > 12) { this.grenades++; this.grenRegen = 0; } }
      if (this.jammers < 1) { this.jamRegen += dt; if (this.jamRegen > 22) { this.jammers = 1; this.jamRegen = 0; } }
      this.bloom = Math.max(0, this.bloom - dt * 4);
      if (this.switchT > 0) this.switchT -= dt;
      if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.finishReload(); }
      const W = this.W();
      const wantAds = ctl.ads && this.reloadT <= 0 && this.switchT <= 0 && this.sliding <= 0 && !this.hasKey;
      this.ads = G.clamp(this.ads + (wantAds ? 1 : -1) * dt * (this.cur === 'rail' ? 5.5 : 8), 0, 1);
      if (ctl.reload) this.startReload();
      if (this.hasKey) return;
      // burst continuation
      if (this.burstLeft > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0 && this.mags[this.cur] > 0) { this.shootOnce(); this.burstLeft--; this.burstT = W.burstGap; if (!this.burstLeft) this.fireCd = 60 / W.rpm; }
        else if (this.mags[this.cur] <= 0) { this.burstLeft = 0; this.startReload(); }
        return;
      }
      const trig = W.auto ? ctl.fire : ctl.firePressed;
      if (trig && this.fireCd <= 0 && this.switchT <= 0 && this.reloadT <= 0) {
        if (this.mags[this.cur] > 0) {
          if (W.burst) { this.burstLeft = W.burst - 1; this.burstT = W.burstGap; this.shootOnce(); this.fireCd = 1; }
          else { this.shootOnce(); this.fireCd = 60 / W.rpm; }
        } else { this.onDry && this.onDry(); this.startReload(); this.fireCd = 0.25; }
      }
    }
    shootOnce() {
      const W = this.W();
      this.mags[this.cur]--; this.stats.shots++;
      const o = new THREE.Vector3(), d = new THREE.Vector3();
      this.aimRay(o, d);
      const mz = this.muzzlePos();
      const res = G.weapons.fire(this, o, d, mz);
      if (res && res.any) this.stats.hits++;
      this.bloom = Math.min(this.bloom + W.bloom, 3);
      this.onShot && this.onShot(W, res);
      this.lastShotT = G.t;
      if (!this.isPlayer) { G.fx.muzzle(mz, W.color); G.audio.play(W.sound, { pos: mz, vol: 0.9, ref: 14 }); }
      if (this.mags[this.cur] <= 0 && !W.burst) this.startReload();
    }
    muzzlePos() {
      if (this.gunModel) { this.model.updateMatrixWorld(true); return new THREE.Vector3().setFromMatrixPosition(this.gunModel.userData.muzzle.matrixWorld); }
      return this.eye();
    }
    // Jammer: slams every enemy door shut and strips enemy shields in its blast
    throwJammer(dir) {
      if (this.jammers <= 0 || this.grenCd > 0 || this.hasKey) return false;
      this.jammers--; this.grenCd = 0.7; this.jamRegen = 0; this.usedJammer = true;
      G.weapons.jammer(this, this.eye().addScaledVector(dir, 0.6), dir.clone().multiplyScalar(22).add(new THREE.Vector3(0, 3, 0)).addScaledVector(this.vel, 0.4));
      G.audio.play('switch', { pos: this.isPlayer ? null : this.pos, rate: 0.6, vol: 0.7 });
      return true;
    }
    throwGrenade(dir) {
      if (this.grenades <= 0 || this.grenCd > 0 || this.hasKey) return false;
      this.grenades--; this.grenCd = 0.7;
      const e = this.eye();
      G.weapons.grenade(this, e.addScaledVector(dir, 0.6), dir.clone().multiplyScalar(19).add(new THREE.Vector3(0, 3.5, 0)).addScaledVector(this.vel, 0.4));
      G.audio.play('switch', { pos: this.isPlayer ? null : this.pos, rate: 0.7, vol: 0.7 });
      return true;
    }
    melee(dir) {
      if (this.meleeCd > 0) return null;
      this.meleeCd = 0.8; this.meleeAnim = 1;
      G.audio.play('melee', { pos: this.isPlayer ? null : this.pos, vol: 0.8 });
      const e = this.eye();
      let best = null, bd = this.hasKey ? 3.6 : 3.2;
      for (const c of G.actors) {
        if (c === this || !c.alive || !G.match.enemies(this, c)) continue;
        const to = c.center(_v).sub(e), d = to.length();
        if (d < bd && to.normalize().dot(dir) > 0.72 && G.world.los(e, c.center())) { best = c; bd = d; }
      }
      if (!best) return null;
      const back = G.fwdFrom(best.yaw, 0, _v2).dot(_v.set(dir.x, 0, dir.z).normalize()) > 0.55;
      const dmg = back || this.hasKey ? 250 : 75;
      this.vel.addScaledVector(dir, 5);
      const res = best.takeDamage(dmg, this, { weapon: 'melee', back, dir, point: best.center() });
      G.fx.burst(best.center(), dir.clone().negate(), '#fff0c0', 20, 5, 0.4, 0.06);
      if (res > 0 && this.onDealt) this.onDealt(dmg, false, res === 2, best, best.center());
      return { target: best, res, back };
    }
    shootPortal(i, origin, dir) {
      const p = this.portals[i];
      const hit = G.world.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, 260, null);
      const end = hit ? origin.clone().addScaledVector(dir, hit.t) : origin.clone().addScaledVector(dir, 260);
      const from = this.isPlayer ? G.vm.gadgetWorld() : this.eye();
      G.fx.tracer(from, end, p.colorHex, 0.05, 0.22);
      if (hit && hit.box >= 0 && G.world.boxes[hit.box].portal && p.place(hit.box, end, hit.normal, dir)) {
        G.audio.play('portal' + i, { pos: this.isPlayer ? null : end, vol: 0.9 });
        if (this.isPlayer) G.audio.play('portal' + i, { pos: end, vol: 0.6 });
        return true;
      }
      if (hit) G.fx.burst(end, hit.normal, p.colorHex, 16, 4, 0.4, 0.06);
      G.audio.play('fizzle', { pos: this.isPlayer ? null : end, vol: 0.7 });
      return false;
    }
    closePortals() { let any = false; for (const p of this.portals) { if (p.placed) any = true; p.close(); } if (any) G.audio.play('portalClose', { pos: this.isPlayer ? null : this.pos }); }

    // ---------------------------------------------------------------- visuals
    updateModel(dt) {
      const m = this.model;
      if (!this.alive) { m.visible = false; return; }
      m.position.copy(this.pos); m.rotation.y = this.yaw;
      const hs = this.hspeed();
      if (this.onGround && this.sliding <= 0) this.animPhase += dt * hs * 1.15;
      const blink = this.invuln > 0 && Math.floor(G.t * 12) % 2 === 0;
      if (!this.isPlayer) m.visible = !blink;
      G.models.animateRobot(m, { speed: hs, phase: this.animPhase, ground: this.onGround, crouch: this.crouched && this.sliding <= 0, slide: this.sliding > 0, pitch: this.pitch, jet: this.jetting, melee: Math.sin(this.meleeAnim * Math.PI) });
      if (this.keyMesh) this.keyMesh.visible = this.hasKey;
    }
  }
  G.Actor = Actor;

  // ================================================================== PLAYER
  class Player extends Actor {
    constructor(o) {
      super(Object.assign({ isPlayer: true }, o));
      this.trauma = 0; this.shakeT = 0; this.recoil = new THREE.Vector2(); this.fovKick = 0; this.roll = 0; this.dip = 0; this.bobT = 0;
      this.headH = 1.62; this.kick = 0; this.sway = new THREE.Vector2(); this.gadgetAnim = 0; this.flashT = 0; this.stepAcc = 0;
      this.deathCam = null;
      this.primary = G.save.primary; this.secondary = G.save.secondary;
    }
    addTrauma(a) { this.trauma = Math.min(1, this.trauma + a); }
    onEquip(id, instant) { G.vm.equip(id); if (!instant) G.audio.play('switch', { vol: 0.6 }); G.ui && G.ui.weaponChanged(); }
    onReload() { G.audio.play('reload', { vol: 0.7 }); }
    onDry() { G.audio.play('denied', { vol: 0.5 }); }
    onSlide() { G.audio.play('slide', { vol: 0.7 }); this.fovKick += 7; this.addTrauma(0.12); }
    onJump() { G.audio.play('jump', { vol: 0.4 }); }
    onMantle() { G.audio.play('land', { vol: 0.45, rate: 1.3 }); this.dip = 0.12; this.roll += 0.05; }
    onLand(vy) {
      this.dip = G.clamp(-vy * 0.012, 0, 0.3); this.addTrauma(G.clamp(-vy / 70, 0, 0.3)); G.audio.play('land', { vol: 0.7 });
      if (vy < -16) G.fx.burst(this.pos.clone().setY(this.pos.y + 0.1), G._cy, '#cfe0ff', 22, 6, 0.5, 0.06, 1.5);
    }
    onShieldBreak() { G.audio.play('shieldBreak', { vol: 0.9 }); G.ui.flash('#4ab8ff', 0.35); }
    onRegen() { G.audio.play('shieldUp', { vol: 0.5 }); }
    onHurt(amount, attacker, info) {
      this.addTrauma(G.clamp(amount / 110, 0.08, 0.45));
      if (attacker && attacker !== this) G.ui.damageFrom(attacker.pos);
      G.audio.play('hurt', { vol: 0.6 });
      G.ui.hurt(1 - this.hp / this.maxHp);
    }
    onDealt(total, head, killed, victim, pos) {
      G.ui.hitmarker(head, killed);
      if (!killed) G.audio.play(head ? 'head' : 'hit', { vol: head ? 0.7 : 0.55 });
      G.fx.number(pos, total, head, victim.lastShieldHit);
    }
    onShot(W, res) {
      this.flashT = 0.05; this.kick += W.recoil * 0.012;
      this.recoil.x += W.recoil * 0.008 * (1 - this.ads * 0.45); this.recoil.y += (Math.random() * 2 - 1) * W.recoil * 0.003;
      this.addTrauma(W.recoil * 0.018);
      G.audio.play(W.sound, { vol: 0.85, jit: 0.05 });
      // brass
      if (!W.projectile && G.cam) { const q = G.cam.quaternion; G.fx.casing(G.cam.position.clone().add(new THREE.Vector3(0.22, -0.16, -0.45).applyQuaternion(q)), new THREE.Vector3(2.2 + Math.random(), 2 + Math.random(), 0.4).applyQuaternion(q).add(this.vel)); }
    }
    onTeleport(door, q) {
      this.fovKick += 16; this.roll += G.rand(-0.1, 0.1); this.recoil.set(0, 0);
      G.audio.play('portalPass', { vol: 0.8 });
      G.ui.flash(q.colorHex, 0.4);
    }
    aimRay(o, d) {
      o.copy(G.cam.position);
      G.cam.getWorldDirection(d);
    }
    muzzlePos() { return this.ads > 0.85 && this.cur === 'rail' ? G.cam.position.clone().add(new THREE.Vector3(0, -0.15, 0)) : G.vm.muzzleWorld(); }

    update(dt) {
      if (!this.alive) { this.updateCamera(dt); return; }
      const I = G.input, frozen = G.match.frozen;
      // look
      if (I.locked) {
        const zoom = G.cam.fov / G.settings.fov, s = 0.0022 * G.settings.sens * zoom;
        this.yaw -= I.mdx * s; this.pitch = G.clamp(this.pitch - I.mdy * s * (G.settings.invertY ? -1 : 1), -1.55, 1.55);
        this.sway.x += I.mdx * 0.0006; this.sway.y += I.mdy * 0.0006;
      }
      this.invuln = Math.max(0, this.invuln - dt);
      this.regen(dt);
      const intent = frozen ? { mx: 0, mz: 0 } : {
        mx: (G.down('right') ? 1 : 0) - (G.down('left') ? 1 : 0), mz: (G.down('back') ? 1 : 0) - (G.down('fwd') ? 1 : 0),
        jump: G.down('jump'), jumpPressed: G.hit('jump'), crouch: G.down('crouch'), crouchPressed: G.hit('crouch'), sprint: G.down('sprint'),
      };
      this.move(dt, intent);
      if (this.alive) {
        if (this.onGround && this.sliding <= 0) { this.stepAcc += this.hspeed() * dt; if (this.stepAcc > 2.6) { this.stepAcc = 0; G.audio.play('step', { vol: 0.35, jit: 0.15 }); } }
        G.audio.loop('jet', 'jet', this.jetting, 0.35);
        if (!frozen) this.controls(dt);
        else this.tickWeapons(dt, {});
      }
      this.updateCamera(dt);
      this.updateViewmodel(dt);
    }
    controls(dt) {
      for (let i = 0; i < 3; i++) if (G.hit('slot' + (i + 1)) && this.slots[i]) this.equip(this.slots[i]);
      if (G.input.wheel) {
        const own = this.slots.filter(Boolean); let i = own.indexOf(this.cur);
        i = (i + (G.input.wheel > 0 ? 1 : -1) + own.length) % own.length; this.equip(own[i]);
      }
      this.tickWeapons(dt, { fire: G.down('fire'), firePressed: G.hit('fire'), ads: G.down('ads'), reload: G.hit('reload') });
      const d = new THREE.Vector3(); G.cam.getWorldDirection(d);
      if (G.hit('portalA')) { this.gadgetAnim = 1; this.shootPortal(0, G.cam.position, d); }
      if (G.hit('portalB')) { this.gadgetAnim = 1; this.shootPortal(1, G.cam.position, d); }
      if (G.hit('closePortals')) this.closePortals();
      if (G.hit('melee') || (this.hasKey && G.hit('fire'))) { const r = this.melee(d); if (r) { this.addTrauma(0.25); G.hitstop(0.1, 0.05); } }
      if (G.hit('grenade')) { if (this.throwGrenade(d)) this.gadgetAnim = 1; }
      if (G.hit('jammer')) { if (this.throwJammer(d)) this.gadgetAnim = 1; else G.audio.play('denied', { vol: 0.4 }); }
      // aim probe for crosshair state + enemy name
      const hit = G.world.raycast(G.cam.position.x, G.cam.position.y, G.cam.position.z, d.x, d.y, d.z, 260, null);
      this.aimPortalable = !!(hit && hit.box >= 0 && G.world.boxes[hit.box].portal);
      let tgt = null, tt = hit ? hit.t : 200;
      for (const a of G.actors) { if (a === this || !a.alive) continue; const r = a.rayTest(G.cam.position, d, tt, 0.1); if (r) { tt = r.t; tgt = a; } }
      this.aimTarget = tgt;
    }
    updateCamera(dt) {
      const cam = G.cam;
      this.trauma = Math.max(0, this.trauma - dt * 1.4); this.shakeT += dt * 30;
      this.recoil.lerp(G._z2 || (G._z2 = new THREE.Vector2()), Math.min(1, dt * 9));
      this.fovKick = G.damp(this.fovKick, 0, 4, dt); this.dip = G.damp(this.dip, 0, 8, dt); this.kick = G.damp(this.kick, 0, 14, dt);
      this.flashT -= dt; this.gadgetAnim = Math.max(0, this.gadgetAnim - dt * 4);
      if (!this.alive) {
        // death cam: rise and look at the killer
        const k = this.lastKiller && this.lastKiller.alive ? this.lastKiller : null;
        const base = this.deathPos || this.pos;
        const tgtPos = _v.set(base.x, base.y + 3.6, base.z);
        cam.position.lerp(tgtPos, Math.min(1, dt * 2.5));
        const look = k ? k.center(_v2) : _v2.set(base.x, base.y, base.z);
        _m.lookAt(cam.position, look, G._cy); const q = new THREE.Quaternion().setFromRotationMatrix(_m);
        cam.quaternion.slerp(q, Math.min(1, dt * 4));
        cam.fov = G.damp(cam.fov, 70, 3, dt); cam.updateProjectionMatrix();
        G.vm.root.visible = false;
        return;
      }
      const tgtH = this.eyeH();
      this.headH = G.damp(this.headH, tgtH, 12, dt);
      const hs = this.hspeed();
      if (this.onGround && hs > 1 && this.sliding <= 0) this.bobT += dt * hs * 1.25;
      const bob = Math.sin(this.bobT) * 0.035 * Math.min(hs / 8, 1.2) * (1 - this.ads * 0.85);
      cam.position.set(this.pos.x, this.pos.y + this.headH - this.dip + bob * 0.5, this.pos.z);
      // keep the camera at the true eye when crossing doors (no bob offsets beyond small)
      const sh = this.trauma * this.trauma;
      const sx = (Math.sin(this.shakeT * 1.7) + Math.sin(this.shakeT * 2.9 + 1.3)) * 0.5;
      const sy = (Math.sin(this.shakeT * 2.3 + 0.7) + Math.sin(this.shakeT * 3.7)) * 0.5;
      const sz = (Math.sin(this.shakeT * 1.1 + 2) + Math.sin(this.shakeT * 4.1)) * 0.5;
      const strafe = (G.down('right') ? 1 : 0) - (G.down('left') ? 1 : 0);
      this.roll = G.damp(this.roll, -strafe * 0.022 + (this.sliding > 0 ? 0.07 : 0), 8, dt);
      cam.rotation.set(this.pitch + this.recoil.x + sx * 0.09 * sh, this.yaw + this.recoil.y + sy * 0.09 * sh, this.roll + sz * 0.06 * sh, 'YXZ');
      const W = this.W();
      const sprinting = G.down('sprint') && hs > 8.5 && this.onGround;
      const tf = G.settings.fov * G.lerp(1, W.adsFov, this.ads) + (sprinting ? 5 : 0) + this.fovKick + G.clamp((hs - 11) * 0.9, 0, 16) * (1 - this.ads);
      cam.fov = G.clamp(G.damp(cam.fov, tf, 12, dt), 20, 150);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    }
    updateViewmodel(dt) {
      const V = G.vm, W = this.W();
      if (!V.gun) return;
      this.sway.lerp(G._z2, Math.min(1, dt * 10));
      const hs = this.hspeed(), sprinting = G.down('sprint') && hs > 8.5 && this.onGround;
      let hip = new THREE.Vector3(0.24, -0.22, -0.42), aim = new THREE.Vector3(0, -0.12, -0.32);
      if (this.cur === 'rocket') { hip.set(0.22, -0.14, -0.3); aim.set(0.14, -0.1, -0.26); }
      if (this.cur === 'sidearm') { hip.set(0.2, -0.2, -0.38); aim.set(0, -0.1, -0.3); }
      const p = hip.lerp(aim, this.ads);
      p.x -= this.sway.x * (1 - this.ads * 0.8); p.y += this.sway.y * (1 - this.ads * 0.8);
      const bm = Math.min(hs / 8, 1.2) * (1 - this.ads);
      p.x += Math.cos(this.bobT * 0.5) * 0.012 * bm; p.y -= Math.abs(Math.sin(this.bobT * 0.5)) * 0.014 * bm;
      p.z += this.kick; p.y -= this.switchT * 1.1;
      let rx = this.kick * 2.5, rz = this.sway.x * 1.5, ry = -this.sway.x * 2;
      if (this.reloadT > 0) { const k = Math.sin(this.reloadT / W.reload * Math.PI); p.y -= 0.08 * k; rx -= 0.5 * k; rz += 0.5 * k; }
      if (sprinting && this.ads < 0.1 && this.reloadT <= 0) { p.x -= 0.05; p.y -= 0.04; p.z += 0.02; rz += 0.35; rx -= 0.15; }
      if (this.hasKey) { p.y -= 0.5; }
      V.gunHolder.position.copy(p); V.gunHolder.rotation.set(rx, ry, rz);
      const scoped = this.cur === 'rail' && this.ads > 0.85;
      V.root.visible = true; V.gunHolder.visible = !scoped;
      const ga = this.gadgetAnim, ma = Math.sin(this.meleeAnim * Math.PI);
      V.gadget.visible = this.ads < 0.5;
      V.gadget.position.set(-0.3 - this.sway.x * 0.6, -0.29 + ga * 0.05 - ma * 0.1 + this.sway.y * 0.6, -0.5 - ga * 0.06 - ma * 0.35); V.gadget.scale.setScalar(0.62);
      V.gadget.rotation.set(ga * 0.3, 0.15 + ma * 0.5, 0);
      for (let i = 0; i < 2; i++) { const pp = this.portals[i]; const l = V.gadget.userData.lights[i + 2]; l.visible = pp.placed; }
      const fl = this.flashT > 0 && !scoped;
      V.flashSprite.visible = fl;
      if (fl) { V.root.updateMatrixWorld(true); V.flashSprite.position.setFromMatrixPosition(V.muzzle.matrixWorld); V.flashSprite.material.color.set(W.color).lerp(G.col('#fff2d0'), 0.6).multiplyScalar(4); V.flashSprite.scale.setScalar(G.rand(0.12, 0.22)); }
      V.cam.fov = 74; V.gunHolder.scale.setScalar(0.8); V.cam.aspect = G.cam.aspect; V.cam.updateProjectionMatrix();
    }
    die(attacker, info) {
      this.deathPos = this.pos.clone();
      this.lastKiller = attacker && attacker !== this ? attacker : null;
      G.audio.loop('jet', 'jet', false);
      super.die(attacker, info);
      G.ui.onPlayerDeath(attacker, info);
    }
    respawn(sp) {
      super.respawn(sp);
      this.model.visible = false; this.headH = 1.62; this.trauma = 0; this.ads = 0;
      G.cam.fov = G.settings.fov;
      G.audio.play('spawn', { vol: 0.6 });
      G.ui.onPlayerSpawn();
    }
  }
  G.Player = Player;

  G.vm && (G.vm.gadgetWorld = function () {
    this.root.updateMatrixWorld(true);
    return new THREE.Vector3().setFromMatrixPosition(this.gadget.matrixWorld).add(new THREE.Vector3(0, 0.08, -0.1)).applyMatrix4(G.cam.matrixWorld);
  });
})();
