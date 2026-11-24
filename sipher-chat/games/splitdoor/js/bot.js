'use strict';
// Bots: A* over the nav grid (including any linked doors), aim with reaction time and error, strafe, jetpack,
// grenades, objective play, and their own door flanks.
G.BOT_NAMES = ['Deadbolt', 'Hingebot', 'Latchkey', 'Jamb Master', 'Knob Rogers', 'Threshold', 'Doorman 9000', 'Keyhole Kev',
  'Swingset', 'Slamwich', 'Peephole Pete', 'Ajarvis', 'Lintel', 'Mortise', 'Doorito', 'Sir Knocks-a-Lot', 'Transom', 'Strike Plate'];
G.SKILLS = [
  { name: 'RECRUIT', reaction: 0.85, err: 8.0, shot: 3.2, dmg: 0.4, head: 0.03, turn: 3.0, jumpy: 0.5, flank: 0.25, nade: 0.2 },
  { name: 'VETERAN', reaction: 0.5, err: 5.0, shot: 2.0, dmg: 0.6, head: 0.08, turn: 4.5, jumpy: 1.0, flank: 0.55, nade: 0.45 },
  { name: 'ELITE', reaction: 0.32, err: 3.0, shot: 1.2, dmg: 0.85, head: 0.18, turn: 7, jumpy: 1.4, flank: 0.85, nade: 0.7 },
];

(() => {
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();

  class Bot extends G.Actor {
    constructor(o) {
      super(o);
      this.dummy = !!o.dummy; this.stepAcc = 0;
      this.skill = o.skill; this.dmgMul = o.skill.dmg;
      this.primary = o.primary || G.pick(G.PRIMARIES); this.secondary = o.secondary || G.pick(G.SECONDARIES);
      this.path = null; this.pathI = 0; this.repathT = 0; this.goal = null; this.goalKind = '';
      this.target = null; this.reactT = 0; this.trackT = 0; this.lastSeen = null; this.lastSeenT = -99; this.lastSeenActor = null;
      this.strafe = 1; this.strafeT = 0; this.thinkT = Math.random() * 0.3; this.stuckT = 0; this.portalCd = G.rand(4, 10);
      this.jumpHold = 0; this.aimOff = new THREE.Vector2(); this.stepStart = 0; this.roamT = 0; this.wantSlide = false;
      this.desiredYaw = 0; this.desiredPitch = 0; this.nadeCd = G.rand(3, 8);
      if (o.tag) { this.tag = G.makeTag(o.name, o.tagColor); G.scene.add(this.tag); }
      this.marker = G.makeMarker(); G.scene.add(this.marker);
    }
    onHurt(amount, attacker) {
      if (attacker && attacker !== this && attacker.alive) {
        this.lastSeen = attacker.pos.clone(); this.lastSeenT = G.t; this.lastSeenActor = attacker;
        if (!this.target) { this.reactT = Math.min(this.reactT, this.skill.reaction * 0.7); }
      }
    }
    respawn(sp) { super.respawn(sp); this.path = null; this.target = null; this.goal = null; this.lastSeen = null; this.portalCd = G.rand(3, 8); }

    // every shot also wanders off the aim line a little, more so on the move or mid-air
    aimRay(o, d) {
      this.eye(o); G.fwdFrom(this.yaw, this.pitch, d);
      const e = this.skill.shot * (1 + this.hspeed() / 10 + (this.onGround ? 0 : 0.8) + (this.target && this.target.hspeed() > 6 ? 0.5 : 0));
      G.cone(d.clone(), THREE.MathUtils.degToRad(e), d);
    }

    // ---------------------------------------------------------------- brain
    think() {
      const eye = this.eye(_v3), sk = this.skill;
      // perception
      let best = null, bs = 1e9, bestDoor = null;
      for (const a of G.actors) {
        if (a === this || !a.alive || !G.match.enemies(this, a)) continue;
        const c = a.center();
        let app = c, door = null;
        if (!G.world.los(eye, c) && !G.world.los(eye, a.eye())) {
          // not in direct sight: maybe through a door
          const s = G.portals.sightTo(eye, c, 95) || G.portals.sightTo(eye, a.eye(), 95);
          if (!s) continue;
          app = s.v; door = s.door;
        }
        const d = app.distanceTo(eye);
        if (d > 95) continue;
        const dir = _v2.copy(app).sub(eye).normalize();
        const facing = G.fwdFrom(this.yaw, 0, new THREE.Vector3()).dot(_v2.set(dir.x, 0, dir.z).normalize());
        const aware = facing > -0.25 || d < 7 || (this.lastSeenActor === a && G.t - this.lastSeenT < 3) || (a.lastShotT && G.t - a.lastShotT < 0.6 && d < 40);
        if (!aware) continue;
        let score = d + (door ? 4 : 0);
        if (a === this.target) score -= 12;
        if (a.isPlayer) score -= (sk.flank * 4);
        if (a.hasKey) score -= 15;
        if (a.lastHitBy === this) score -= 4;
        if (score < bs) { bs = score; best = a; bestDoor = door; }
      }
      this.targetDoor = bestDoor;
      if (best !== this.target) {
        if (best && !this.target) { this.reactT = sk.reaction * G.rand(0.8, 1.3); this.trackT = 0; this.aimOff.set(G.rand(-1, 1), G.rand(-1, 1)).normalize(); }
        this.target = best;
      }
      if (best) { this.lastSeen = best.pos.clone(); this.lastSeenT = G.t; this.lastSeenActor = best; }

      // weapon choice
      if (best) {
        const d = best.pos.distanceTo(this.pos);
        let want = this.slots[0];
        if (this.slots[2] === 'rocket' && d > 6 && d < 50) want = 'rocket';
        else if (this.slots[2] === 'rail' && d > 18) want = 'rail';
        else if (this.slots[1] === 'scatter' && d < 9) want = 'scatter';
        else if (this.mags[this.slots[0]] === 0 && this.reloadT > 0 && d < 15) want = this.slots[1];
        if (want && want !== this.cur && this.switchT <= 0) this.equip(want);
      }

      // grenades at hidden-but-known enemies
      this.nadeCd -= 0.25;
      // jammer: pop a shielded enemy at mid range, or one standing by their doors
      if (best && this.jammers > 0 && this.grenCd <= 0 && Math.random() < sk.nade * 0.12) {
        const d = best.pos.distanceTo(this.pos);
        if (d > 7 && d < 24 && (best.shield > 60 || best.portals.some(p => p.placed && p.center.distanceTo(best.pos) < 9))) {
          const to = _v.copy(best.pos).sub(this.pos), flat = Math.hypot(to.x, to.z) || 1;
          this.throwJammer(new THREE.Vector3(to.x / flat, 0.12 + flat * 0.006, to.z / flat).normalize());
        }
      }
      if (!best && this.lastSeen && G.t - this.lastSeenT < 2.5 && this.nadeCd <= 0 && this.grenades > 0 && Math.random() < sk.nade) {
        const d = this.lastSeen.distanceTo(this.pos);
        if (d > 8 && d < 26) {
          const to = _v.copy(this.lastSeen).sub(this.pos); const flat = Math.hypot(to.x, to.z);
          const dir = new THREE.Vector3(to.x / flat, 0.18 + flat * 0.006, to.z / flat).normalize();
          this.yaw = G.yawOf(dir); this.throwGrenade(dir); this.nadeCd = G.rand(6, 12);
        }
      }

      // goal selection
      let goal = null, kind = '';
      const obj = G.match.botGoal(this);
      if (best) {
        if (obj && obj.urgent) { goal = obj.pos; kind = 'obj'; }
        else if (best.pos.distanceTo(this.pos) > 32) { goal = best.pos.clone(); kind = 'chase'; }
        else { goal = null; kind = 'fight'; }
      } else {
        if (obj && obj.urgent) { goal = obj.pos; kind = 'obj'; }
        if (!goal) {
          const pk = G.match.pickupFor(this);
          if (pk) { goal = pk; kind = 'pickup'; }
        }
        if (!goal && this.lastSeen && G.t - this.lastSeenT < 7) { goal = this.lastSeen; kind = 'hunt'; }
        if (!goal && obj) { goal = obj.pos; kind = 'obj'; }
        if (!goal) {
          this.roamT -= 0.25;
          if (!this.goal || this.roamT <= 0 || this.goalKind !== 'roam') { this.roamGoal = G.match.roamPoint(this); this.roamT = G.rand(8, 16); }
          goal = this.roamGoal; kind = 'roam';
        }
      }
      const changed = goal && (!this.goal || this.goal.distanceTo(goal) > 4 || kind !== this.goalKind);
      this.goal = goal; this.goalKind = kind;
      this.repathT -= 0.25;
      if (goal && (changed || this.repathT <= 0 || !this.path)) this.repath();

      // door flank: open my own pair toward the goal
      this.portalCd -= 0.25;
      if (goal && this.portalCd <= 0 && this.path && this.path.length - this.pathI > 12 && (!best || kind === 'chase')) {
        if (Math.random() < sk.flank && this.tryFlank(goal)) { this.repath(); this.portalCd = G.rand(8, 14); }
        else this.portalCd = G.rand(1.5, 3);
      }
    }
    repath() {
      this.repathT = G.rand(1.0, 1.6);
      if (!this.goal) { this.path = null; return; }
      const p = G.world.path(this.pos, this.goal);
      this.path = p; this.pathI = 0; this.stepStart = G.t;
    }
    tryFlank(goal) {
      const eye = this.eye(), A = G.world.anchors;
      if (!A.length) return false;
      const myD = eye.distanceTo(goal);
      const seen = (an) => {
        const to = _v.copy(an.center).addScaledVector(an.normal, 0.05).sub(eye); const d = to.length(); to.divideScalar(d);
        if (to.dot(an.normal) > -0.15) return false;
        const h = G.world.raycast(eye.x, eye.y, eye.z, to.x, to.y, to.z, d + 0.5, null);
        return h && h.box === an.box && Math.abs(h.t - d) < 1.2;
      };
      let a = null, ad = 1e9;
      for (const an of A) { const d = an.center.distanceTo(eye); if (d < 3 || d > 24 || d >= ad) continue; if (seen(an)) { a = an; ad = d; } }
      if (!a) return false;
      let b = null, bd = myD - 16;
      for (const an of A) { if (an === a) continue; const d = an.center.distanceTo(goal); if (d >= bd) continue; if (an.center.distanceTo(a.center) < 10) continue; if (seen(an)) { b = an; bd = d; } }
      if (!b) return false;
      const ok0 = this.placeAt(0, a), ok1 = ok0 && this.placeAt(1, b);
      if (ok1) G.portals.refreshNav();
      return ok1;
    }
    placeAt(i, an) {
      const eye = this.eye(), dir = _v.copy(an.center).sub(eye).normalize();
      this.yaw = G.yawOf(dir); this.pitch = Math.asin(G.clamp(dir.y, -1, 1));
      return this.shootPortal(i, eye, dir);
    }

    // ---------------------------------------------------------------- body
    update(dt) {
      if (this.tag) { this.tag.visible = this.alive; if (this.alive) this.tag.position.set(this.pos.x, this.pos.y + 2.25, this.pos.z); }
      if (!this.alive) { this.marker.visible = false; return; }
      this.invuln = Math.max(0, this.invuln - dt);
      this.regen(dt);
      const frozen = G.match.frozen;
      if (this.dummy) { this.move(dt, { mx: 0, mz: 0 }); this.yaw += dt * 0.4; return; }
      this.thinkT -= dt;
      if (this.thinkT <= 0 && !frozen) { this.thinkT = 0.25; this.think(); }
      const I = { mx: 0, mz: 0, jump: false, jumpPressed: false, crouch: false, crouchPressed: false, sprint: false };
      if (!frozen) this.steer(dt, I);
      // aim
      const sk = this.skill, t = this.target && this.target.alive ? this.target : null;
      let fire = false;
      if (t) {
        this.trackT += dt; this.reactT -= dt;
        const aimHead = Math.random() < sk.head * dt * 10 ? !this.aimHead : this.aimHead;
        this.aimHead = aimHead;
        const tp = aimHead ? t.eye(_v).setY(t.pos.y + t.height() - 0.2) : t.center(_v);
        tp.addScaledVector(t.vel, 0.06);
        // seen through a door: aim at where the target appears inside that door
        const door = this.targetDoor;
        let throughDoor = false;
        if (door) {
          const v = G.portals.seeVia(door, this.eye(_v3), tp, 95, _v4);
          if (v) { tp.copy(v); throughDoor = true; } else if (!door.linked) this.targetDoor = null;
        }
        const eye = this.eye(_v2), dir = tp.sub(eye);
        const dist = dir.length(); dir.divideScalar(dist);
        const errDeg = sk.err * Math.max(0.65, 1.5 - this.trackT * 0.35) * (t.hspeed() > 6 ? 1.3 : 1) * (this.jetting ? 1.3 : 1);
        const wob = THREE.MathUtils.degToRad(errDeg);
        this.desiredYaw = G.yawOf(dir) + this.aimOff.x * wob + Math.sin(G.t * 2.3 + this.pos.x) * wob * 0.5;
        this.desiredPitch = Math.asin(G.clamp(dir.y, -1, 1)) + this.aimOff.y * wob * 0.6 + Math.sin(G.t * 1.9) * wob * 0.3;
        const dy = G.wrap(this.desiredYaw - this.yaw), dp = this.desiredPitch - this.pitch;
        const turn = sk.turn * dt;
        this.yaw += G.clamp(dy, -turn, turn) * Math.min(1, dt * 14 + 0.3);
        this.pitch += G.clamp(dp, -turn, turn) * Math.min(1, dt * 14 + 0.3);
        const off = Math.abs(G.wrap(this.desiredYaw - this.yaw)) + Math.abs(this.desiredPitch - this.pitch);
        const W = this.W();
        const inRange = W.projectile ? dist > 4 : dist < W.range * 0.95;
        const canSee = throughDoor || G.world.los(this.eye(_v3), t.center(_v));
        fire = this.reactT <= 0 && off < 0.09 + wob && inRange && canSee;
        if (this.cur === 'rail' && this.trackT < 0.6) fire = false;
        if (!throughDoor && dist < 2.8 && this.meleeCd <= 0 && Math.random() < 0.5 * dt * 10) this.melee(G.fwdFrom(this.yaw, this.pitch, _v));
        if (t.hasKey === false && this.hasKey && dist < 3.4) this.melee(G.fwdFrom(this.yaw, this.pitch, _v));
      } else {
        // look where we're going
        const hv = this.hspeed();
        if (hv > 1.5) { const ty = Math.atan2(-this.vel.x, -this.vel.z); this.yaw += G.clamp(G.wrap(ty - this.yaw), -4 * dt, 4 * dt); }
        else if (this.lastSeen && G.t - this.lastSeenT < 4) { const d = _v.copy(this.lastSeen).sub(this.pos); this.yaw += G.clamp(G.wrap(G.yawOf(d) - this.yaw), -4 * dt, 4 * dt); }
        this.pitch = G.damp(this.pitch, 0, 4, dt);
      }
      this.move(dt, I);
      if (this.onGround && this.sliding <= 0) { this.stepAcc += this.hspeed() * dt; if (this.stepAcc > 2.6) { this.stepAcc = 0; G.audio.play('step', { pos: this.pos, vol: 0.9, ref: 5, jit: 0.15 }); } }
      if (!this.alive) return;
      this.tickWeapons(dt, { fire, firePressed: fire && this.fireCd <= 0, ads: !!t && this.cur === 'rail' && this.trackT > 0.3, reload: !t && this.mags[this.cur] < this.W().mag * 0.5 });
    }
    // fill movement intent from the path + combat footwork
    steer(dt, I) {
      const sk = this.skill;
      let wx = 0, wz = 0, jump = false;
      const t = this.target && this.target.alive ? this.target : null;
      if (this.path && this.pathI < this.path.length && (this.goalKind !== 'fight')) {
        const step = this.path[this.pathI];
        let tx = step.n.x, ty = step.n.y, tz = step.n.z;
        if (step.k === 3) {
          const p = step.portal;
          if (!p || !p.linked) { this.repath(); return; }
          if (this.lastDoorT > this.stepStart) { this.pathI++; this.stepStart = G.t; return; }
          tx = p.center.x - p.normal.x * 0.8; ty = p.center.y - G.PORTAL_H / 2; tz = p.center.z - p.normal.z * 0.8;
          if (p.normal.y > 0.5) { tx = p.center.x; tz = p.center.z; }
          if (G.t - this.stepStart > 6) { this.repath(); return; }
        }
        const dx = tx - this.pos.x, dz = tz - this.pos.z, dh = Math.hypot(dx, dz), dy = ty - this.pos.y;
        if (step.k !== 3 && dh < 0.9 && Math.abs(dy) < 1.6) { this.pathI++; this.stepStart = G.t; }
        if (dh > 0.01) { wx = dx / dh; wz = dz / dh; }
        if ((step.k === 2 || dy > 0.7) && dh < 4.5) jump = true;
        if (G.t - this.stepStart > 4) this.repath();
        I.sprint = !t && this.path.length - this.pathI > 4;
      } else if (this.path && this.pathI >= this.path.length) { this.path = null; }
      if (t) {
        // combat footwork: strafe and keep a preferred distance
        const to = _v.copy(t.pos).sub(this.pos); to.y = 0; const d = to.length(); to.divideScalar(d || 1);
        const pref = this.cur === 'scatter' ? 5 : this.cur === 'rail' ? 30 : this.cur === 'smg' ? 9 : 16;
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = G.rand(0.45, 1.4) / sk.jumpy; if (Math.random() < 0.18 * sk.jumpy) jump = true; if (Math.random() < 0.1 * sk.jumpy && this.onGround) this.wantSlide = true; }
        const side = _v2.set(-to.z, 0, to.x).multiplyScalar(this.strafe);
        const fwd = d > pref + 4 ? 1 : d < pref - 3 ? -0.8 : 0;
        if (this.goalKind === 'fight' || !this.path) { wx = side.x * 0.9 + to.x * fwd; wz = side.z * 0.9 + to.z * fwd; }
        else { wx = wx * 0.7 + side.x * 0.5; wz = wz * 0.7 + side.z * 0.5; }
        // avoid walking off ledges into the void
        const ax = this.pos.x + wx * 1.4, az = this.pos.z + wz * 1.4;
        if (G.world.groundAt(ax, az, this.pos.y + 0.5, 0.6) < this.pos.y - 4) { wx = -wx * 0.5; wz = -wz * 0.5; }
      }
      // stuck handling
      const intendMove = Math.abs(wx) + Math.abs(wz) > 0.1;
      if (intendMove && this.onGround && this.hspeed() < 1.2) { this.stuckT += dt; if (this.stuckT > 0.6) jump = true; if (this.stuckT > 2.2) { this.stuckT = 0; this.repath(); } }
      else this.stuckT = Math.max(0, this.stuckT - dt);
      // world dir -> local intent
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      I.mx = wx * rx + wz * rz; I.mz = -(wx * fx + wz * fz);
      if (jump && this.onGround) { I.jumpPressed = true; this.jumpHold = 0.9; }
      if (this.jumpHold > 0) { this.jumpHold -= dt; I.jump = true; }
      if (this.wantSlide && this.hspeed() > 8.2) { I.crouch = true; I.crouchPressed = this.sliding <= 0; if (this.sliding <= 0.05 && this._slid) { this.wantSlide = false; this._slid = false; } else this._slid = true; }
    }
  }
  G.Bot = Bot;

  // floating team name tag
  G.makeTag = (name, color) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48;
    const x = c.getContext('2d'); x.font = '500 22px Archivo, sans-serif'; x.letterSpacing = '4px'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillText(name.toUpperCase(), 129, 26); x.fillStyle = color; x.fillText(name.toUpperCase(), 128, 24);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true, fog: false }));
    s.scale.set(1.9, 0.36, 1); s.renderOrder = 6; return s;
  };
  // red chevron over visible enemies
  G.makeMarker = () => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.fillStyle = '#ff3b30'; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(12, 18); x.lineTo(32, 44); x.lineTo(52, 18); x.lineTo(44, 14); x.lineTo(32, 30); x.lineTo(20, 14); x.closePath(); x.stroke(); x.fill();
    const t = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false }));
    s.scale.set(0.42, 0.42, 1); s.renderOrder = 7; s.visible = false; return s;
  };
})();
