// Entities: Rush family, Screech, Eyes/Lookman, Seek, Figure, Grumble, Giggle, Gloombats, Monument, Snare, Haste.
(() => {
'use strict';
const V3 = THREE.Vector3;
const E = G.E = {};

/* ---------- Rush / Ambush / Blitz / A-60 / A-120 ---------- */
const RUSH = {
  rush: { speed: 40, passes: 1, wait: 5.0, face: 'rush', size: 2.6, sound: 'rush', breaks: true, killR: 3.4, flick: 2.2 },
  ambush: { speed: 62, passes: 0, wait: 4.0, face: 'ambush', size: 2.8, sound: 'ambush', breaks: true, killR: 3.6, flick: 2.5 },
  blitz: { speed: 36, passes: 2, wait: 4.5, face: 'blitz', size: 2.5, sound: 'blitz', breaks: false, killR: 3.4, flick: 2 },
  a60: { speed: 70, passes: 1, wait: 3.0, face: 'a60', size: 2.8, sound: 'a60', breaks: false, killR: 3.8, flick: 0 },
  a120: { speed: 20, passes: 1, wait: 4.0, face: 'a120', size: 2.4, sound: 'a120', breaks: false, killR: 3.0, flick: 0 },
};
class Rusher {
  constructor(kind) {
    const C = this.C = RUSH[kind]; this.kind = kind;
    this.t = -C.wait; this.passes = C.passes || G.randi(2, 5);
    this.sprite = G.faceSprite(C.face, C.size); this.sprite.visible = false; G.scene.add(this.sprite);
    this.glow = G.faceSprite(kind === 'a60' ? 'a60' : 'rush', C.size * 1.8); this.glow.material.opacity = 0.25; this.glow.visible = false; G.scene.add(this.glow);
    this.snd = G.audio.loop(C.sound);
    this.pts = null; this.seg = 0; this.pause = 0;
    const cur = G.game.cur;
    if (cur && C.flick) { cur.flicker = C.flick; G.audio.sfx('flicker'); }
    if (kind === 'a60' || kind === 'a120') G.audio.sfx('static');
    G.game.rush = this;
  }
  buildPath() {
    const rooms = G.game.rooms.slice().sort((a, b) => a.index - b.index), pts = [];
    for (const r of rooms) for (const p of r.path) pts.push(p.clone().add(new V3(0, 0.1, 0)));
    return pts;
  }
  update(dt) {
    this.t += dt;
    const cam = G.camera.position;
    if (this.t < 0) {
      const k = 1 + this.t / this.C.wait;
      this.snd.set(k * k * 0.35);
      // Lights keep flickering where you are (and the room you just opened) until it arrives.
      const cur = G.game.cur;
      if (cur && this.C.flick) for (const r of G.game.rooms) if (Math.abs(r.index - cur.index) <= 1) r.flicker = Math.max(r.flicker, 0.2);
      if (this.kind === 'a60' && G.game.cur) G.player.shake = Math.max(G.player.shake, 0.08 * k);
      return true;
    }
    if (!this.pts) { this.pts = this.buildPath(); this.seg = 0; this.pos = this.pts[0].clone(); this.sprite.visible = this.glow.visible = true; }
    if (this.pause > 0) {
      this.pause -= dt; this.sprite.visible = this.glow.visible = false;
      this.snd.set(0.15);
      if (this.pause <= 0) { this.sprite.visible = this.glow.visible = true; G.audio.sfx('whoosh'); }
      return true;
    }
    let move = this.C.speed * dt;
    while (move > 0) {
      const tgt = this.pts[this.seg + 1];
      if (!tgt) {
        this.passes--;
        if (this.passes <= 0) { this.remove(); return false; }
        this.pts.reverse(); this.seg = 0; this.pause = G.rand(1.2, 3);
        break;
      }
      const d = this.pos.distanceTo(tgt);
      if (d <= move) { this.pos.copy(tgt); this.seg++; move -= d; }
      else { this.pos.addScaledVector(tgt.clone().sub(this.pos).normalize(), move); move = 0; }
    }
    const j = this.kind === 'a60' ? 0.35 : 0.12;
    this.sprite.position.copy(this.pos).add(new V3(G.rand(-j, j), G.rand(-j, j), G.rand(-j, j)));
    this.glow.position.copy(this.pos);
    for (const r of G.game.rooms) {
      if (!r.isInside(this.pos, 1.5)) continue;
      if (this.C.flick) r.flicker = Math.max(r.flicker, 0.4);
      if (this.C.breaks && G.distXZ(this.pos, r.center) < 3) r.breakLights();
    }
    const d = this.pos.distanceTo(cam);
    this.snd.set(G.clamp(1 - d / 50, 0.05, 1) * 1.1);
    if (d < 14) G.player.shake = Math.max(G.player.shake, (1 - d / 14) * 0.5);
    if (!G.player.hiding && d < this.C.killR) {
      if (!this.C.hit) G.game.kill(this.kind, this);
      else if (this.hitPass !== this.passes) { this.hitPass = this.passes; this.C.hit(this); }
    }
    return true;
  }
  remove() {
    G.scene.remove(this.sprite); G.scene.remove(this.glow); this.snd.stop();
    if (G.game.rush === this) G.game.rush = null;
  }
}
E.Rusher = Rusher;
E.RUSH = RUSH;

/* ---------- Screech ---------- */
class Screech {
  constructor() {
    const f = G.camForward(new V3()); f.y = 0; f.normalize();
    const a = Math.PI + G.rand(-1.3, 1.3);
    const dir = f.clone().applyAxisAngle(new V3(0, 1, 0), a);
    this.off = dir.multiplyScalar(1.4).setY(G.rand(0.35, 0.9));
    this.t = 0;
    this.sprite = G.faceSprite('screech', 1.0); G.scene.add(this.sprite);
    G.audio.sfx('psst'); G.ui.caption('Psst!', 2);
  }
  update(dt) {
    this.t += dt;
    this.sprite.position.copy(G.camera.position).add(this.off);
    this.sprite.position.y += Math.sin(this.t * 6) * 0.05;
    if (G.player.hiding || G.game.state !== 'play') { this.remove(); return false; }
    if (this.t > 0.25 && G.lookingAt(this.sprite.position, 0.82)) {
      G.audio.sfx('psst'); G.ui.caption('Screech retreats into the dark...', 2); this.remove(); return false;
    }
    if (this.t > 2.3) { this.remove(); G.game.scare('screech', 40); return false; }
    return true;
  }
  remove() { G.scene.remove(this.sprite); if (G.game.screech === this) G.game.screech = null; }
}
E.Screech = Screech;

/* ---------- Eyes / Lookman (look away) ---------- */
class Gazer {
  constructor(room, kind = 'eyes', pos) {
    this.room = room; this.kind = kind;
    this.pos = pos || room.center.clone().setY(1.9);
    this.sprite = G.faceSprite(kind, kind === 'eyes' ? 1.9 : 1.4); this.sprite.position.copy(this.pos); G.scene.add(this.sprite);
    this.lamp = { pos: this.pos.clone(), color: new THREE.Color(kind === 'eyes' ? 0xb050ff : 0xc8d0ff), base: kind === 'eyes' ? 9 : 2, dist: 10, mat: new THREE.MeshBasicMaterial(), on: true, broken: false, unbreakable: true, f: 1 };
    room.lamps.push(this.lamp);
    this.snd = G.audio.loop('eyes'); this.dmgT = 0; this.t = 0; this.warned = false;
  }
  update(dt) {
    if (this.room.disposed) { this.remove(); return false; }
    this.t += dt;
    this.sprite.position.y = this.pos.y + Math.sin(this.t * 1.5) * 0.08;
    const cam = G.camera.position, d = cam.distanceTo(this.pos);
    this.snd.set(G.clamp(1 - d / 22, 0, 1) * 0.9);
    const looking = !G.player.hiding && d < 24 && G.lookingAt(this.pos, this.kind === 'eyes' ? 0.6 : 0.78) && G.los(cam, this.pos, G.game.cols);
    if (looking) {
      if (!this.warned) { this.warned = true; G.ui.caption(this.kind === 'eyes' ? "Don't look at it!" : 'Look away from it!', 2.5); }
      this.dmgT -= dt;
      if (this.dmgT <= 0) { this.dmgT = 0.22; G.game.damage(this.kind === 'eyes' ? 6 : 8, this.kind); }
    } else this.dmgT = Math.min(this.dmgT, 0.08);
    return true;
  }
  remove() {
    G.scene.remove(this.sprite); this.snd.stop();
    const i = this.room.lamps.indexOf(this.lamp); if (i >= 0) this.room.lamps.splice(i, 1);
  }
}
E.Gazer = Gazer;

/* ---------- Seek (breadcrumb chaser) ---------- */
class Seek {
  constructor(pos, o = {}) {
    this.m = G.models.seek(); this.m.position.copy(pos); this.m.position.y = -2.6; G.scene.add(this.m);
    this.pos = this.m.position; this.t = 0; this.rise = o.rise || 1.8; this.speed = o.speed || 5.35;
    this.ci = 0; this.face = 0; this.walk = 0;
    this.puddle = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    this.puddle.rotation.x = -Math.PI / 2; this.puddle.position.set(pos.x, 0.02, pos.z); G.scene.add(this.puddle);
    this.snd = G.audio.loop('seek'); this.snd.set(0.7, 0.6);
    G.game.crumbs = [];
    G.game.seek = this;
    G.audio.sfx('roar');
  }
  update(dt) {
    this.t += dt;
    const P = G.player;
    const d = G.distXZ(this.pos, P.pos);
    if (this.t < this.rise) {
      this.pos.y = -2.6 * (1 - this.t / this.rise);
      const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z;
      this.m.rotation.y = Math.atan2(dx, dz);
      return true;
    }
    this.pos.y = 0;
    const cr = G.game.crumbs;
    let move = this.speed * dt * (d > 13 ? 1.45 : 1);
    const before = this.pos.clone();
    while (move > 0 && this.ci < cr.length) {
      const tg = cr[this.ci], dx = tg.x - this.pos.x, dz = tg.z - this.pos.z, dd = Math.hypot(dx, dz);
      if (dd <= move) { this.pos.x = tg.x; this.pos.z = tg.z; this.ci++; move -= dd; }
      else { this.pos.x += dx / dd * move; this.pos.z += dz / dd * move; this.face = Math.atan2(dx, dz); move = 0; }
    }
    this.walk += before.distanceTo(this.pos) * 3;
    this.m.rotation.y = this.face;
    const { limbs, body } = this.m.userData;
    limbs.forEach((l, i) => { l.rotation.x = Math.sin(this.walk + (i % 2 ? 0 : Math.PI) + (i > 1 ? Math.PI : 0)) * 0.9; });
    body.rotation.x = 0.25;
    if (d < 1.15 && !P.hiding) G.game.kill('seek', this);
    return true;
  }
  remove() { G.scene.remove(this.m); G.scene.remove(this.puddle); this.snd.stop(); if (G.game.seek === this) G.game.seek = null; }
}
E.Seek = Seek;

/* ---------- navigating walkers ---------- */
class Walker {
  constructor(room, model, pos) {
    this.room = room; this.nav = room.nav || (room.nav = new G.Nav(room));
    this.m = model; this.m.position.copy(pos).setY(room.origin.y); G.scene.add(model);
    this.pos = this.m.position; this.path = []; this.pi = 0; this.face = 0; this.walk = 0; this.repath = 0;
  }
  get nav() { return this.room.nav; }
  set nav(v) { this.room.nav = v; }
  goTo(p) { this.path = this.room.nav.path(this.pos, p) || []; this.pi = 0; }
  step(dt, speed) {
    let move = speed * dt, moved = 0;
    while (move > 0 && this.pi < this.path.length) {
      const tg = this.path[this.pi], dx = tg.x - this.pos.x, dz = tg.z - this.pos.z, dd = Math.hypot(dx, dz);
      if (dd > 0.01) this.face = Math.atan2(dx, dz);
      if (dd <= move) { this.pos.x = tg.x; this.pos.z = tg.z; this.pi++; move -= dd; moved += dd; }
      else { this.pos.x += dx / dd * move; this.pos.z += dz / dd * move; moved += move; move = 0; }
    }
    let df = this.face - this.m.rotation.y;
    while (df > Math.PI) df -= Math.PI * 2;
    while (df < -Math.PI) df += Math.PI * 2;
    this.m.rotation.y += df * Math.min(1, dt * 8);
    this.walk += moved * 2.2;
    return this.pi >= this.path.length;
  }
}

class Figure extends Walker {
  constructor(room, pos, o = {}) {
    super(room, G.models.figure(), pos);
    this.state = 'wander'; this.wait = 1; this.chaseT = 0; this.hbCool = 0; this.intro = o.intro || 0;
    this.enraged = false; this.snd = G.audio.loop('figure');
    this.speedMul = o.speedMul || 1;
    G.game.figures.push(this);
    if (this.intro) G.audio.sfx('roar');
  }
  hear(p, r) {
    if (this.state === 'chase' || this.intro > 0) return;
    if (G.distXZ(p, this.pos) < r) { this.state = 'investigate'; this.goTo(p); }
  }
  update(dt) {
    if (this.room.disposed) { this.remove(); return false; }
    const P = G.player, d = G.distXZ(this.pos, P.pos), inRoom = this.room.isInside(P.pos, 0.6);
    this.snd.set(G.clamp(1 - d / 20, 0, 1) * 0.9);
    const { limbs, head } = this.m.userData;
    limbs.forEach((l, i) => { l.rotation.x = Math.sin(this.walk + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6; });
    head.rotation.z = Math.sin(this.walk * 0.5) * 0.15;
    if (this.intro > 0) { this.intro -= dt; this.m.userData.body.rotation.x = -0.25; return true; }
    this.m.userData.body.rotation.x = 0.08;
    if (this.hbCool > 0) this.hbCool -= dt;
    const detect = !P.hiding && inRoom && (this.enraged || d < 1.7 || (d < 3.6 && !P.crouch && P.moving));
    if (detect) { if (this.state !== 'chase') G.audio.sfx('roar'); this.state = 'chase'; this.chaseT = 2.5; }
    if (this.state === 'chase') {
      this.chaseT -= dt; this.repath -= dt;
      if (this.repath <= 0) { this.goTo(P.pos); this.repath = 0.35; }
      this.step(dt, (this.enraged ? 4.9 : 4.25) * this.speedMul);
      if (!this.enraged && (P.hiding || this.chaseT <= 0)) { this.state = 'investigate'; this.goTo(P.hiding ? P.hiding.out : P.pos); }
    } else if (this.state === 'investigate') {
      if (this.step(dt, 2.9 * this.speedMul)) { this.state = 'wander'; this.wait = G.rand(1.5, 3); }
    } else {
      if (this.wait > 0) this.wait -= dt;
      else if (this.step(dt, 1.6 * this.speedMul)) { this.goTo(this.nav.randomFree()); this.wait = G.rand(0, 1.5); }
    }
    if (!P.hiding && d < 1.05 && inRoom) G.game.kill('figure', this);
    if (P.hiding && P.hiding.room === this.room && d < 2.6 && this.hbCool <= 0 && !G.ui.hbActive) {
      this.hbCool = 9;
      G.ui.heartbeat(5, ok => {
        if (!ok) G.game.kill('figure', this);
        else { this.state = 'wander'; this.goTo(this.nav.randomFree()); }
      });
    }
    return true;
  }
  remove() { G.scene.remove(this.m); this.snd.stop(); G.game.figures = G.game.figures.filter(f => f !== this); }
}
E.Figure = Figure;

class Grumble extends Walker {
  constructor(room, pos) {
    super(room, G.models.grumble(), pos);
    this.state = 'patrol'; this.chaseT = 0; this.wait = G.rand(0, 2);
    this.snd = G.audio.loop('grumble');
    G.game.figures.push(this);
  }
  hear(p, r) { if (this.state !== 'chase' && G.distXZ(p, this.pos) < r * 0.8) { this.state = 'investigate'; this.goTo(p); } }
  update(dt) {
    if (this.room.disposed) { this.remove(); return false; }
    const P = G.player, d = G.distXZ(this.pos, P.pos), inRoom = this.room.isInside(P.pos, 0.6);
    this.snd.set(G.clamp(1 - d / 18, 0, 1) * 0.7);
    this.m.userData.segs.forEach((s, i) => { s.position.x = Math.sin(this.walk - i * 0.8) * 0.15; });
    const eye = this.pos.clone().setY(1.7);
    const sees = inRoom && !P.hiding && d < 11 && (!P.crouch || d < 4 || G.game.lightOn) && G.los(eye, G.camera.position, G.game.cols);
    if (sees) { if (this.state !== 'chase') G.audio.sfx('roar'); this.state = 'chase'; this.chaseT = 3.5; }
    if (this.state === 'chase') {
      this.chaseT -= dt; this.repath -= dt;
      if (this.repath <= 0) { this.goTo(P.pos); this.repath = 0.4; }
      this.step(dt, 4.3);
      if (this.chaseT <= 0 || P.hiding) { this.state = 'patrol'; this.wait = 2; }
    } else if (this.state === 'investigate') {
      if (this.step(dt, 2.6)) { this.state = 'patrol'; this.wait = 2; }
    } else {
      if (this.wait > 0) this.wait -= dt;
      else if (this.step(dt, 1.5)) { this.goTo(this.nav.randomFree()); this.wait = G.rand(1, 3); }
    }
    if (!P.hiding && d < 1.5) G.game.kill('grumble', this);
    return true;
  }
  remove() { G.scene.remove(this.m); this.snd.stop(); G.game.figures = G.game.figures.filter(f => f !== this); }
}
E.Grumble = Grumble;

/* ---------- Giggle (ceiling ambusher) ---------- */
class Giggle {
  constructor(room, pos) {
    this.room = room; this.m = G.models.giggle(); this.m.position.copy(pos); this.m.position.y = room.H - 0.3;
    G.scene.add(this.m); this.state = 'wait'; this.t = 0; this.clicks = 0; this.dmgT = 0.7;
  }
  update(dt) {
    if (this.room.disposed && this.state !== 'latched') { this.remove(); return false; }
    this.t += dt;
    const P = G.player;
    if (this.state === 'wait') {
      this.m.rotation.y += dt * 0.5; this.m.position.y += Math.sin(this.t * 3) * 0.002;
      if (!P.hiding && G.distXZ(this.m.position, P.pos) < 1.5) { this.state = 'drop'; G.audio.sfx('attack'); }
    } else if (this.state === 'drop') {
      this.m.position.y -= 9 * dt;
      this.m.position.x += (P.pos.x - this.m.position.x) * Math.min(1, dt * 10);
      this.m.position.z += (P.pos.z - this.m.position.z) * Math.min(1, dt * 10);
      if (this.m.position.y < 1.9) { this.state = 'latched'; this.m.visible = false; G.game.giggle = this; G.ui.giggle(true, 0); }
    } else if (this.state === 'latched') {
      this.dmgT -= dt;
      if (this.dmgT <= 0) { this.dmgT = 0.7; G.game.damage(5, 'giggle'); }
      P.shake = Math.max(P.shake, 0.1);
      if (this.clicks >= 10) {
        G.ui.giggle(false); G.ui.caption('You threw Giggle off.', 2); G.audio.sfx('hurt');
        if (G.game.giggle === this) G.game.giggle = null;
        this.remove(); return false;
      }
    }
    return true;
  }
  click() { this.clicks++; G.ui.giggle(true, this.clicks / 10); G.player.shake = 0.25; G.audio.sfx('click'); }
  remove() { G.scene.remove(this.m); if (G.game.giggle === this) { G.game.giggle = null; G.ui.giggle(false); } }
}
E.Giggle = Giggle;

/* ---------- Gloombats (punish lights in dark mine rooms) ---------- */
class Gloombats {
  constructor(room) {
    this.room = room; this.level = 0; this.bats = []; this.dmgT = 0.5; this.warned = false;
    for (let i = 0; i < 8; i++) { const s = G.faceSprite('gloombat', 0.5); s.visible = false; G.scene.add(s); this.bats.push({ s, a: G.random() * 7, r: G.rand(0.6, 1.4), h: G.rand(-0.3, 0.6), sp: G.rand(3, 6) }); }
    this.snd = G.audio.loop('gloom');
  }
  update(dt) {
    if (this.room.disposed) { this.remove(); return false; }
    const inRoom = this.room.isInside(G.player.pos, 0.3);
    const lit = inRoom && G.game.lightOn;
    if (lit && !this.warned) { this.warned = true; G.ui.caption('Something stirs above... turn off your light!', 3); }
    this.level = G.clamp(this.level + (lit ? dt : -dt * 1.5), 0, 2);
    const active = this.level > 0.9;
    this.snd.set(inRoom ? G.clamp(this.level / 2, 0, 1) : 0);
    const cam = G.camera.position;
    for (const b of this.bats) {
      b.s.visible = active || (this.level > 0.4 && inRoom);
      b.a += b.sp * dt;
      b.s.position.set(cam.x + Math.cos(b.a) * b.r, cam.y + b.h + Math.sin(b.a * 2) * 0.2, cam.z + Math.sin(b.a) * b.r);
    }
    if (active && !G.player.hiding) { this.dmgT -= dt; if (this.dmgT <= 0) { this.dmgT = 0.5; G.game.damage(7, 'gloombats'); } }
    return true;
  }
  remove() { this.bats.forEach(b => G.scene.remove(b.s)); this.snd.stop(); }
}
E.Gloombats = Gloombats;

/* ---------- Monument (moves only when unseen) ---------- */
class Monument {
  constructor(room, pos) {
    this.room = room; this.m = G.models.monument(); this.m.position.copy(pos).setY(0); G.scene.add(this.m);
    this.pos = this.m.position; this.moving = false;
  }
  update(dt) {
    if (this.room.disposed) { this.remove(); return false; }
    const P = G.player, cam = G.camera, d = G.distXZ(this.pos, P.pos);
    const head = this.pos.clone().setY(1.8), feet = this.pos.clone().setY(0.4);
    const seen = (G.frustum.containsPoint(head) || G.frustum.containsPoint(feet)) && G.los(cam.position, head, G.game.cols);
    const near = d < 26;
    if (!seen && near && !P.hiding) {
      const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, dd = Math.hypot(dx, dz);
      const sp = 6.2 * dt;
      this.pos.x += dx / dd * sp; this.pos.z += dz / dd * sp;
      G.collideCircle(this.pos, 0.45, G.game.cols, this.pos.y + 1.5);
      this.m.rotation.y = Math.atan2(dx, dz);
      if (!this.moving) { this.moving = true; }
    } else if (this.moving) { this.moving = false; G.audio.sfx('click'); }
    if (d < 1.0) G.game.kill('monument', this);
    return true;
  }
  remove() { G.scene.remove(this.m); }
}
E.Monument = Monument;

/* ---------- Snare ---------- */
class Snare {
  constructor(room, pos) {
    this.room = room; this.pos = pos.clone(); this.armed = true;
    const g = this.g = new THREE.Group(); g.position.copy(pos).setY(0.02);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 16), G.mat.rust); ring.rotation.x = -Math.PI / 2; g.add(ring);
    this.teeth = [];
    for (let i = 0; i < 10; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 4), G.mat.white);
      const a = i / 10 * Math.PI * 2; t.position.set(Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3); t.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      g.add(t); this.teeth.push(t);
    }
    for (let i = 0; i < 8; i++) { const l = new THREE.Mesh(G.geo.sphere, G.mat.leaf); l.position.set(G.rand(-0.4, 0.4), 0.05, G.rand(-0.4, 0.4)); l.scale.set(0.15, 0.08, 0.15); g.add(l); }
    G.scene.add(g);
  }
  update() {
    if (this.room.disposed) { G.scene.remove(this.g); return false; }
    if (this.armed && !G.player.hiding && G.distXZ(G.player.pos, this.pos) < 0.55) {
      this.armed = false;
      G.audio.sfx('snare');
      this.teeth.forEach(t => { t.rotation.x *= 0.1; t.rotation.z *= 0.1; t.position.y = 0.12; });
      G.player.rooted = 1.6;
      G.game.damage(20, 'snare');
    }
    return true;
  }
  remove() { G.scene.remove(this.g); }
}
E.Snare = Snare;

/* ---------- Haste (Backdoor timer) ---------- */
class Haste {
  constructor() {
    this.sprite = G.faceSprite('haste', 2.4); G.scene.add(this.sprite);
    const cr = G.game.crumbs;
    const start = cr.length > 25 ? cr[cr.length - 25] : G.player.pos.clone().add(new V3(0, 0, -12));
    this.pos = start.clone().setY(1.6); this.ci = Math.max(0, cr.length - 24); this.speed = 2.6;
    this.snd = G.audio.loop('haste'); this.snd.set(0.8, 0.4);
    G.game.haste = this;
    G.ui.caption('Haste is coming. Find a lever!', 4);
  }
  update(dt) {
    this.speed = Math.min(5.2, this.speed + dt * 0.05);
    const cr = G.game.crumbs; let move = this.speed * dt;
    while (move > 0 && this.ci < cr.length) {
      const tg = cr[this.ci], dx = tg.x - this.pos.x, dz = tg.z - this.pos.z, dd = Math.hypot(dx, dz);
      if (dd <= move) { this.pos.x = tg.x; this.pos.z = tg.z; this.ci++; move -= dd; }
      else { this.pos.x += dx / dd * move; this.pos.z += dz / dd * move; move = 0; }
    }
    this.sprite.position.copy(this.pos).add(new V3(G.rand(-0.05, 0.05), Math.sin(performance.now() / 300) * 0.1, 0));
    const d = this.pos.distanceTo(G.camera.position);
    if (d < 1.4) G.game.kill('haste', this);
    return true;
  }
  remove() { G.scene.remove(this.sprite); this.snd.stop(); if (G.game.haste === this) G.game.haste = null; }
}
E.Haste = Haste;
})();
