// Game state, player controller, room streaming, items, damage/death and the main loop.
(() => {
'use strict';
const V3 = THREE.Vector3;

G.ITEMS = {
  key: { name: 'Key', icon: '🔑' },
  ekey: { name: 'Electrical Room Key', icon: '🗝️' },
  lighter: { name: 'Lighter', icon: '🔥', charge: 100, drain: 0.9, light: 'lighter' },
  flashlight: { name: 'Flashlight', icon: '🔦', charge: 100, drain: 1.5, light: 'flash' },
  lockpick: { name: 'Lockpicks', icon: '🪛', uses: 3 },
  vitamins: { name: 'Vitamins', icon: '💊', uses: 1 },
  bandage: { name: 'Bandage', icon: '🩹', uses: 1 },
  crucifix: { name: 'Crucifix', icon: '✝️', uses: 1 },
  battery: { name: 'Battery', icon: '🔋', uses: 1 },
  pizza: { name: 'Pizza', icon: '🍕', uses: 1 },
};
class Inv {
  constructor() { this.items = []; this.sel = 0; }
  add(id, silent) {
    const def = G.ITEMS[id];
    if (def.uses && def.uses > 1) {
      const ex = this.items.find(i => i.id === id);
      if (ex) { ex.uses += def.uses; if (!silent) { G.audio.sfx('pickup'); G.ui.caption(`Picked up ${def.name}`, 1.5); } G.ui.hotbar(this); return true; }
    }
    if (this.items.length >= 6) { if (!silent) G.ui.msg('Your inventory is full.', 1.5); return false; }
    this.items.push(Object.assign({ id }, def));
    if (!silent) { G.audio.sfx('pickup'); G.ui.caption(`Picked up ${def.name}`, 1.5); }
    G.ui.hotbar(this);
    return true;
  }
  has(id) { return this.items.some(i => i.id === id); }
  get(id) { return this.items.find(i => i.id === id); }
  remove(id) {
    const i = this.items.findIndex(x => x.id === id);
    if (i < 0) return;
    if (this.items[i] === G.game.light) G.game.setLight(null);
    this.items.splice(i, 1);
    if (this.sel >= this.items.length) this.sel = Math.max(0, this.items.length - 1);
    G.ui.hotbar(this);
  }
  consume(id) {
    const it = this.get(id); if (!it) return;
    it.uses = (it.uses || 1) - 1;
    if (it.uses <= 0) this.remove(id); else G.ui.hotbar(this);
  }
  selected() { return this.items[this.sel]; }
  select(i) { if (i >= 0 && i < this.items.length) { this.sel = i; G.ui.hotbar(this); G.audio.sfx('click'); } }
}
G.Inv = Inv;

const CRUCIFIX_OK = new Set(['rush', 'ambush', 'blitz', 'a60', 'a120', 'seek', 'figure', 'grumble', 'haste', 'monument']);

const Game = G.game = {
  state: 'menu', rooms: [], ents: [], cols: [], figures: [], crumbs: [], inv: new Inv(), floor: null, cur: null, paused: false,

  spawn(e) { this.ents.push(e); return e; },
  despawn(e) { if (!e || e.dead) return; e.dead = true; e.remove(); },
  roomByIndex(n) { return this.rooms.find(r => r.index === n); },
  refresh() { this.cols = []; for (const r of this.rooms) for (const c of r.colliders) this.cols.push(c); },
  clear() {
    for (const e of this.ents) if (!e.dead) { e.dead = true; e.remove(); }
    this.ents = [];
    for (const r of this.rooms) r.dispose();
    this.rooms = []; this.cols = []; this.figures = [];
    this.rush = this.seek = this.haste = this.screech = this.giggle = this.channel = this.a90 = null;
    this.setLight(null);
    if (this.hideLoop) { this.hideLoop.stop(); this.hideLoop = null; }
  },

  start(id) {
    G.audio.init();
    if (this.floor && this.floor.cleanup) this.floor.cleanup(this);
    this.clear();
    const f = this.floor = G.FLOORS[id];
    this.id = id; this.state = 'play'; this.paused = false;
    this.gold = 0; this.time = 0; this.crumbs = []; this.chase = false; this.baseDir = 0; this.hideLimit = 20;
    this.maxIndex = f.start; this.screechT = 0; this.escaping = false; this.itemsLocked = false; this.goldMul = 1; this.lightOn = false; this.light = null;
    const P = G.player;
    Object.assign(P, { hp: 100, hiding: null, crouch: false, speedMul: 1, vitT: 0, boost: 1, rooted: 0, shake: 0, pitch: 0, eye: 1.6, hideT: 0, moving: false });
    P.vel.set(0, 0, 0);
    this.inv = new Inv();
    for (const [k, v] of Object.entries(G.save.shop)) for (let i = 0; i < v; i++) this.inv.add(k, true);
    G.save.shop = {}; G.save.runs++; G.persist();
    G.scene.fog.color.setHex(f.fog[0]); G.scene.fog.density = f.fog[1];
    G.scene.background.setHex(f.outdoor ? 0x0b1426 : 0x000000);
    G.moon.intensity = f.outdoor ? 0.55 : 0;
    G.hemi.intensity = f.outdoor ? 0.7 : 0.45;
    G.hemi.color.setHex(f.outdoor ? 0x6a84c0 : 0x9aa6b8);
    G.fear.reset();
    f.init(this);
    this.genNext(); this.genNext();
    const r0 = this.rooms[0];
    this.cur = r0;
    const sp = r0.spawnLocal || [0, 1.4];
    P.pos.copy(r0.l2w(sp[0], 0, sp[1])); P.pos.y = 0; P.yaw = r0.spawnYaw;
    r0.entered = true;
    if (r0.onEnter) r0.onEnter();
    if (f.onEnter) f.onEnter(this, r0);
    G.ui.startRun(f);
    G.ui.roomLabel(f.plate(r0.index));
    G.audio.ambient(f.ambient);
    G.requestLock();
  },
  genNext() {
    const prev = this.rooms[this.rooms.length - 1];
    let n, at;
    if (prev) { if (!prev.nextAt) return null; n = prev.nextIndex !== undefined ? prev.nextIndex : prev.index + 1; at = prev.nextAt; }
    else { n = this.floor.start; at = { origin: new V3(0, 0, 0), dir: 0 }; }
    if (n > this.floor.end) return null;
    const r = this.floor.build(this, n, at);
    this.rooms.push(r);
    this.refresh();
    return r;
  },

  // Replace whatever was generated past the current room (used by sector skips).
  regenNext(nextIndex) {
    const i = this.rooms.indexOf(this.cur);
    for (const r of this.rooms.splice(i + 1)) r.dispose();
    this.cur.nextIndex = nextIndex;
    this.genNext();
  },
  onDoorOpen(door) { if (this.state === 'play' && this.floor.onDoorOpen) this.floor.onDoorOpen(this, door); },

  /* ---------- per-frame ---------- */
  update(dt) {
    this.time += dt;
    const P = G.player;
    this.updatePlayer(dt);
    // current room
    let cur = null;
    for (let i = this.rooms.length - 1; i >= 0; i--) if (this.rooms[i].isInside(P.pos, 0.02)) { cur = this.rooms[i]; break; }
    if (cur && cur !== this.cur) {
      const prev = this.cur; this.cur = cur;
      if (prev && prev.onLeave) prev.onLeave();
      if (!cur.entered) {
        cur.entered = true;
        if (cur.onEnter) cur.onEnter();
        if (this.floor.onEnter) this.floor.onEnter(this, cur);
      }
      if (cur.index > this.maxIndex) this.maxIndex = cur.index;
      G.ui.roomLabel(this.floor.plate(cur.index));
    }
    // stream rooms ahead / unload behind
    if (this.cur) {
      while (this.rooms[this.rooms.length - 1].index < this.cur.index + 1) if (!this.genNext()) break;
      while (this.rooms.length > 1 && this.rooms[0].index < this.cur.index - 2) {
        const r = this.rooms.shift(); r.dispose();
        this.rooms[0].plug();
        this.refresh();
      }
    }
    // doors open as you walk into them
    for (const r of this.rooms) for (const d of r.doors) {
      if (d.isOpen || d.fake || d.padlock || d.sealed || d.noAuto) continue;
      const dx = P.pos.x - d.center.x, dz = P.pos.z - d.center.z, d2 = dx * dx + dz * dz;
      if (d2 > 2.9 || P.hiding) continue;
      if (!d.interior && dx * d.inward.x + dz * d.inward.z < 0) continue;
      if (d.locked) { if (d2 < 2 && (d.o.keyId ? this.inv.has(d.o.keyId) : this.inv.has('key'))) d.tryOpen(false); continue; }
      d.open();
    }
    for (const r of this.rooms) r.update(dt);
    this.ents = this.ents.filter(e => {
      if (e.dead) return false;
      if (this.state !== 'play') return true;
      if (e.update(dt) === false) { e.dead = true; return false; }
      return true;
    });
    if (this.state !== 'play') return;
    // breadcrumbs for Seek / Haste
    if (this.seek || this.haste || this.floor.crumbs) {
      const last = this.crumbs[this.crumbs.length - 1];
      if (!last || G.distXZ(last, P.pos) > 0.35) { this.crumbs.push(P.pos.clone()); if (this.crumbs.length > 4000) this.crumbs.splice(0, 1000); }
    }
    this.updateHiding(dt);
    this.updateLight(dt);
    this.updateChannel(dt);
    this.updateA90(dt);
    this.floor.update(this, dt);
    G.fear.update(dt, this);
    this.pickTarget();
    if (P.vitT > 0) P.vitT -= dt;
    if (P.hp < 100 && !this.rush && !this.seek) { P.regen = (P.regen || 0) + dt; if (P.regen > 4) { P.regen = 0; P.hp = Math.min(100, P.hp + 1); G.ui.hp(P.hp); } }
  },
  updatePlayer(dt) {
    const P = G.player, k = G.keys, st = G.save.settings;
    const sens = 0.0022 * st.sens;
    if (this.state === 'play' && !this.paused) { P.yaw -= G.mouse.dx * sens; P.pitch -= G.mouse.dy * sens; }
    G.mouse.dx = G.mouse.dy = 0;
    P.pitch = G.clamp(P.pitch, -1.45, 1.45);
    if (P.hiding) {
      let dy = P.yaw - P.hiding.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      P.yaw = P.hiding.yaw + G.clamp(dy, -0.9, 0.9);
      P.pitch = G.clamp(P.pitch, -0.5, 0.5);
      P.moving = false;
      P.eye = G.lerp(P.eye, 1.5, Math.min(1, dt * 10));
    } else {
      P.crouch = !!(k.KeyC || k.ControlLeft || k.ControlRight);
      let fx = 0, fz = 0;
      if (k.KeyW || k.ArrowUp) fz += 1;
      if (k.KeyS || k.ArrowDown) fz -= 1;
      if (k.KeyA || k.ArrowLeft) fx -= 1;
      if (k.KeyD || k.ArrowRight) fx += 1;
      if (this.giggle || this.state !== 'play' || P.rooted > 0 || G.ui.modalOpen) fx = fz = 0;
      P.rooted = Math.max(0, P.rooted - dt);
      const len = Math.hypot(fx, fz); if (len > 0) { fx /= len; fz /= len; }
      const s = Math.sin(P.yaw), c = Math.cos(P.yaw);
      const wx = -s * fz + c * fx, wz = -c * fz - s * fx;
      const sp = (P.crouch ? 2.2 : 4.4) * (P.vitT > 0 ? 1.35 : 1) * (this.chase ? 1.3 : 1) * (P.boost || 1) * (P.speedMul || 1);
      const a = Math.min(1, dt * 12);
      P.vel.x = G.lerp(P.vel.x, wx * sp, a); P.vel.z = G.lerp(P.vel.z, wz * sp, a);
      const bx = P.pos.x, bz = P.pos.z;
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
      const head = P.pos.y + (P.crouch ? 1.15 : 1.75);
      G.collideCircle(P.pos, P.r, this.cols, head);
      G.collideCircle(P.pos, P.r, this.cols, head);
      const fr = this.cur;
      if (fr) P.pos.y = fr.floorY ? fr.floorY(P.pos) : fr.origin.y;
      const moved = Math.hypot(P.pos.x - bx, P.pos.z - bz);
      P.moving = moved / Math.max(dt, 1e-4) > 0.8;
      P.stepD += moved;
      if (P.stepD > (P.crouch ? 0.85 : 1.3)) {
        P.stepD = 0;
        G.audio.sfx('step', { crouch: P.crouch, surface: this.cur && this.cur.theme.surface });
        this.noise(P.pos, P.crouch ? 1.4 : 8);
      }
      P.bob += moved * (P.crouch ? 5 : 6.5);
      P.eye = G.lerp(P.eye, P.crouch ? 1.0 : 1.6, Math.min(1, dt * 10));
    }
    P.shake = Math.max(0, P.shake - dt * 1.5);
    const sh = P.shake * 0.06;
    G.camera.position.set(P.pos.x + G.rand(-sh, sh), P.pos.y + P.eye + (P.hiding ? 0 : Math.sin(P.bob) * 0.035) + G.rand(-sh, sh), P.pos.z + G.rand(-sh, sh));
    G.camera.rotation.set(P.pitch, P.yaw, P.hiding ? 0 : Math.sin(P.bob * 0.5) * 0.005);
  },
  pickTarget() {
    const P = G.player;
    this.target = null;
    let label = null;
    if (!P.hiding && !G.ui.modalOpen) {
      const cam = G.camera.position, f = G.camForward(new V3());
      let best = -1e9;
      for (const r of this.rooms) for (const it of r.inter) {
        const dx = it.pos.x - cam.x, dy = it.pos.y - cam.y, dz = it.pos.z - cam.z, d = Math.hypot(dx, dy, dz);
        if (d > it.r) continue;
        const dot = (dx * f.x + dy * f.y + dz * f.z) / Math.max(d, 1e-4);
        if (dot < (d < 0.9 ? 0.35 : 0.84)) continue;
        const lab = it.label(); if (!lab) continue;
        const score = dot - d * 0.06;
        if (score > best) { best = score; this.target = it; label = lab; }
      }
    }
    G.ui.prompt(label);
  },

  /* ---------- hiding ---------- */
  hide(spot) {
    const P = G.player;
    if (P.hiding || this.state !== 'play') return;
    if (spot.jack) { spot.jack = false; this.scare('jack', 0); G.ui.caption('...Jack. It was just Jack.', 2); return; }
    P.hiding = spot; P.pos.copy(spot.in); P.yaw = spot.yaw; P.pitch = 0; P.hideT = 0; P.vel.set(0, 0, 0);
    spot.doors.forEach(d => { d.visible = false; });
    G.ui.hideOverlay(true, spot.kind);
    G.audio.sfx('door');
    this.noise(P.pos, 3);
  },
  unhide() {
    const P = G.player, s = P.hiding;
    if (!s) return;
    s.doors.forEach(d => { d.visible = true; });
    P.pos.copy(s.out); P.hiding = null;
    G.ui.hideOverlay(false);
    G.audio.sfx('door');
    if (this.hideLoop) { this.hideLoop.stop(); this.hideLoop = null; }
  },
  updateHiding(dt) {
    const P = G.player;
    if (!P.hiding) return;
    const threat = this.rush || this.figures.some(f => G.distXZ(f.pos, P.pos) < 9);
    if (!threat) P.hideT += dt; else P.hideT = Math.max(0, P.hideT - dt);
    const lim = this.hideLimit;
    if (P.hideT > lim * 0.6) {
      if (!this.hideLoop) { this.hideLoop = G.audio.loop('hide'); this.hideLoop.set(0.6); G.ui.caption('Get out...', 2); }
      if (P.hideT > lim * 0.8 && G.random() < dt) G.ui.caption('GET OUT', 1);
    }
    if (P.hideT > lim) {
      this.unhide(); P.hideT = 0;
      this.scare('hide', 10);
    }
  },

  /* ---------- items ---------- */
  setLight(it) {
    this.light = it || null; this.lightOn = !!it;
    G.flash.intensity = it && it.light === 'flash' ? 30 : 0;
    G.handLight.intensity = it && it.light === 'lighter' ? 5 : 0;
    if (this.inv) G.ui.hotbar(this.inv);
  },
  toggleLight() {
    if (this.light) { this.setLight(null); G.audio.sfx('click'); return; }
    const sel = this.inv.selected();
    const it = sel && sel.light ? sel : this.inv.items.find(i => i.light && i.charge > 0);
    if (!it) { G.ui.caption('You have no light source.', 1.5); return; }
    if (it.charge <= 0) { G.ui.caption(`Your ${it.name} is empty.`, 1.5); return; }
    this.setLight(it); G.audio.sfx('click');
  },
  updateLight(dt) {
    const it = this.light;
    if (!it) return;
    it.charge -= it.drain * dt;
    if (it.light === 'lighter') G.handLight.intensity = 5 * (0.85 + G.random() * 0.15);
    if (it.charge <= 0) { it.charge = 0; this.setLight(null); G.ui.caption(it.light === 'flash' ? 'The battery died.' : 'The lighter ran out of fuel.', 2); }
    this._hbT = (this._hbT || 0) + dt;
    if (this._hbT > 0.5) { this._hbT = 0; G.ui.hotbar(this.inv); }
  },
  useItem() {
    const it = this.inv.selected(), P = G.player;
    if (!it) return;
    if (this.itemsLocked) { G.ui.caption('Your inventory is locked.', 1.5); G.audio.sfx('bad'); return; }
    if (it.id === 'pizza') {
      if (P.hp >= 100) { G.ui.caption('You are not hungry... or hurt.', 1.2); return; }
      P.hp = Math.min(100, P.hp + 40); G.ui.hp(P.hp); this.inv.consume('pizza'); G.audio.sfx('gulp'); return;
    }
    if (it.light) { if (this.light === it) this.setLight(null); else if (it.charge > 0) this.setLight(it); G.audio.sfx('click'); }
    else if (it.id === 'vitamins') { P.vitT = 12; this.inv.consume('vitamins'); G.audio.sfx('gulp'); G.ui.caption('You feel faster.', 2); }
    else if (it.id === 'bandage') {
      if (P.hp >= 100) { G.ui.caption('You are not hurt.', 1.2); return; }
      P.hp = Math.min(100, P.hp + 35); G.ui.hp(P.hp); this.inv.consume('bandage'); G.audio.sfx('good');
    } else if (it.id === 'battery') {
      const fl = this.inv.get('flashlight');
      if (!fl) { G.ui.caption('You need a flashlight for this.', 1.5); return; }
      fl.charge = 100; this.inv.consume('battery'); G.audio.sfx('click'); G.ui.caption('Flashlight recharged.', 1.5);
    } else if (it.id === 'crucifix') G.ui.caption('Keep the Crucifix selected. It will protect you once.', 2.5);
    else if (it.id === 'key' || it.id === 'ekey' || it.id === 'lockpick') G.ui.caption('Walk up to a locked door to use it.', 2);
  },
  addGold(n) { this.gold += n; G.audio.sfx('gold'); G.ui.gold(this.gold); G.ui.caption(`+${n} Gold`, 1.2); },
  lootDrawer(room, dr) {
    if (dr.key) { this.inv.add('key'); G.ui.msg('You found a Key!', 2); return; }
    const r = G.random();
    if (r < 0.03) { this.scare('timothy', 5); return; }
    if (r < 0.45) { this.addGold(G.randi(3, 15)); return; }
    const table = [['battery', 0.08], ['bandage', 0.06], ['lighter', 0.03], ['lockpick', 0.035], ['vitamins', 0.035], ['flashlight', 0.015], ['crucifix', 0.006]];
    let acc = 0.45;
    for (const [id, p] of table) { acc += p; if (r < acc) { this.inv.add(id); return; } }
    G.ui.caption('Empty.', 1);
  },
  startChannel(dur, pos, tick, done) { this.channel = { t: 0, dur, pos, tick, done }; G.ui.progress(0); },
  updateChannel(dt) {
    const c = this.channel; if (!c) return;
    if (G.distXZ(G.player.pos, c.pos) > 1.9 || G.player.hiding) { this.channel = null; G.ui.progress(null); G.ui.caption('Interrupted.', 1); return; }
    c.t += dt; c.tick(dt); G.ui.progress(c.t / c.dur);
    if (c.t >= c.dur) { this.channel = null; G.ui.progress(null); c.done(); }
  },

  /* ---------- A-90 ---------- */
  startA90() { this.a90 = { t: 0, phase: 'warn' }; G.ui.a90('warn'); G.audio.sfx('static'); },
  updateA90(dt) {
    const a = this.a90; if (!a) return;
    a.t += dt;
    if (a.phase === 'warn' && a.t > 0.55) { a.phase = 'stare'; a.t = 0; G.ui.a90('stare'); G.audio.sfx('static'); a.mx = 0; }
    else if (a.phase === 'stare') {
      if (a.t > 0.12 && (G.player.moving || a.look > 25)) { this.a90 = null; G.ui.a90(null); this.scare('a90', 70); return; }
      if (a.t > 1.0) { this.a90 = null; G.ui.a90(null); G.ui.caption('A-90 is gone.', 1.5); }
    }
  },

  /* ---------- harm ---------- */
  noise(pos, r) { for (const f of this.figures) if (f.hear) f.hear(pos, r); },
  scare(source, dmg) {
    G.ui.jumpscare(source, 0.7); G.audio.sfx('jumpscare');
    G.player.shake = 0.8;
    if (dmg > 0) this.damage(dmg, source);
  },
  damage(a, source) {
    if (this.state !== 'play' || this.escaping) return;
    const P = G.player;
    P.hp -= a; P.regen = 0;
    G.ui.hurt(); G.audio.sfx('hurt'); P.shake = Math.max(P.shake, 0.35);
    if (P.hp <= 0) { P.hp = 0; this.kill(source, null); }
    G.ui.hp(P.hp);
  },
  kill(source, ent) {
    if (this.state !== 'play' || this.escaping) return;
    const sel = this.inv.selected();
    if (sel && sel.id === 'crucifix' && ent && CRUCIFIX_OK.has(source)) {
      this.inv.consume('crucifix'); this.despawn(ent);
      if (source === 'seek') this.chase = false;
      G.ui.flash('#cfe6ff'); G.audio.sfx('win');
      G.ui.msg(`The Crucifix banished ${G.ui.NAMES[source]}!`, 3);
      return;
    }
    this.state = 'dead';
    G.player.hp = 0; G.ui.hp(0);
    if (G.player.hiding) this.unhide();
    G.ui.jumpscare(source, 1.2); G.audio.sfx('jumpscare'); G.player.shake = 1;
    const info = this.endRun(false, source);
    G.ui.prompt(null); G.ui.giggle(false); G.ui.progress(null); G.ui.a90(null);
    G.releaseLock();
    setTimeout(() => { if (this.state === 'dead') { G.ui.fade(false, 0); G.ui.death(info); } }, 1300);
  },
  endRun(won, source) {
    const f = this.floor, progress = Math.max(0, this.maxIndex - f.start);
    const knobs = progress + Math.floor(this.gold / 2) + (won ? 150 : 0);
    G.save.knobs += knobs;
    const best = G.save.best[f.id];
    if (best === undefined || this.maxIndex > best) G.save.best[f.id] = this.maxIndex;
    if (won) G.save.wins[f.id] = (G.save.wins[f.id] || 0) + 1;
    G.persist();
    for (const e of this.ents) if (e.snd) e.snd.set(0, 0.2);
    G.audio.ambient(null);
    if (this.hideLoop) { this.hideLoop.stop(); this.hideLoop = null; }
    return { floor: f.id, source, plate: f.plate(this.maxIndex), gold: this.gold, knobs, time: this.time };
  },
  win(textKey) {
    if (this.state !== 'play') return;
    this.state = 'win';
    const info = this.endRun(true);
    info.textKey = textKey;
    G.audio.sfx('win');
    G.releaseLock();
    G.ui.fade(false, 0.5);
    G.ui.win(info);
  },
  dupe(door) {
    door.fake = false; door.sealed = true; door.o.sealedLabel = null;
    this.scare('dupe', 40);
    G.ui.caption('That was not the right door. Remember the last number.', 3);
  },
  vacuum(door) {
    door.target = -1.75; door.isOpen = true;
    G.audio.sfx('whoosh');
    setTimeout(() => this.kill('vacuum'), 300);
  },

  /* ---------- flow ---------- */
  pause(on) {
    if (this.state !== 'play') return;
    this.paused = on; G.ui.pause(on);
    $hide('clicklock');
  },
  resume() { G.ui.pause(false); G.requestLock(); this.paused = false; },
  quit() { this.endRun(false, 'quit'); this.toLobby(); },
  toLobby() {
    if (this.floor && this.floor.cleanup) this.floor.cleanup(this);
    this.clear();
    this.state = 'menu'; this.paused = false;
    G.fear.reset(); G.applySettings();
    G.audio.ambient(null);
    G.releaseLock();
    G.ui.showMenu();
    buildMenuScene();
  },
};
const $hide = id => document.getElementById(id).classList.add('hidden');

/* ---------- lobby backdrop: a quiet hotel room ---------- */
function buildMenuScene() {
  const g = Game;
  g.floor = G.FLOORS.hotel; g.floor.init(g);
  G.scene.fog.color.setHex(0x070402); G.scene.fog.density = 0.05; G.scene.background.setHex(0); G.moon.intensity = 0; G.hemi.intensity = 0.3;
  g.genNext();
  const r = g.rooms[0];
  g.menuCam = { base: r.l2w(1.5, 1.6, 3), look: r.l2w(0, 1.4, 13) };
  g.floor = null;
}

/* ---------- input bindings ---------- */
G.onKey = e => {
  const g = Game;
  if (G.ui.modalOpen) { if (G.ui.onModalKey) G.ui.onModalKey(e); return; }
  if (g.state !== 'play' || g.paused) return;
  if (g.floor.onKey && g.floor.onKey(g, e)) return;
  if (e.code === 'KeyE') { if (G.player.hiding) g.unhide(); else if (g.target) g.target.use(); }
  else if (/^Digit[1-6]$/.test(e.code)) g.inv.select(+e.code.slice(5) - 1);
  else if (e.code === 'KeyF') g.toggleLight();
};
G.onMouse = e => {
  const g = Game;
  if (g.state !== 'play' || G.ui.modalOpen || g.paused) return;
  if (!G.locked) { G.requestLock(); return; }
  if (G.ui.hbActive) { G.ui.hbClick(e.button); return; }
  if (g.giggle && e.button === 0) { g.giggle.click(); return; }
  if (e.button === 0 && g.floor.onClick && g.floor.onClick(g)) return;
  if (e.button === 0) g.useItem();
};
addEventListener('wheel', e => {
  const g = Game;
  if (g.state !== 'play' || !g.inv.items.length) return;
  const n = g.inv.items.length;
  g.inv.select((g.inv.sel + (e.deltaY > 0 ? 1 : -1) + n) % n);
}, { passive: true });
G.onLockChange = locked => {
  const g = Game;
  if (locked) { $hide('clicklock'); if (g.paused) { g.paused = false; G.ui.pause(false); } return; }
  if (g.state === 'play' && !G.ui.modalOpen && !g.paused) g.pause(true);
};
// A-90 watches mouse movement too.
addEventListener('mousemove', e => { if (Game.a90 && Game.a90.phase === 'stare') Game.a90.look = (Game.a90.look || 0) + Math.abs(e.movementX) + Math.abs(e.movementY); });

/* ---------- boot + loop ---------- */
G.frustum = new THREE.Frustum();
const projM = new THREE.Matrix4();
G.boot = () => {
  G.initRenderer();
  G.makeMats();
  G.post.init();
  G.ui.init();
  G.ui.showMenu();
  buildMenuScene();
  document.getElementById('loading').classList.add('gone');
  let last = performance.now(), t = 0;
  const loop = now => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (Game.state === 'play' && !Game.paused && !G.ui.modalOpen) Game.update(dt);
    else if (Game.state === 'play' && G.ui.modalOpen) { for (const r of Game.rooms) r.update(dt); Game.updatePlayer(0); }
    else if (Game.state === 'menu' && Game.menuCam) {
      const m = Game.menuCam;
      G.camera.position.copy(m.base).add(new V3(Math.sin(t * 0.2) * 0.4, Math.sin(t * 0.37) * 0.08, 0));
      G.camera.lookAt(m.look);
      for (const r of Game.rooms) { r.update(dt); if (G.random() < 0.004) r.flicker = 0.3; }
    }
    G.camera.updateMatrixWorld();
    projM.multiplyMatrices(G.camera.projectionMatrix, G.camera.matrixWorldInverse);
    G.frustum.setFromProjectionMatrix(projM);
    if (Game.rooms.length) G.updateLights(Game);
    G.ui.tick(dt);
    G.post.render(dt);
  };
  requestAnimationFrame(loop);
};
})();
