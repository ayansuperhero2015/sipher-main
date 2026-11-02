// World building: rooms, doors, lamps, furniture, layout, light pool, navigation grid.
(() => {
'use strict';
const V3 = THREE.Vector3;
const DW = G.DW = 1.35, DH = G.DH = 2.35, WT = G.WT = 0.2;
const M = G.mat, GEO = G.geo;

/* ---------- Room ---------- */
class Room {
  constructor(game, o) {
    Object.assign(this, { index: o.index, origin: o.origin.clone(), dir: o.dir, xl: o.xl, xr: o.xr, L: o.L, H: o.H, theme: o.theme });
    this.group = new THREE.Group();
    this.group.position.copy(this.origin);
    this.group.rotation.y = this.dir * Math.PI / 2;
    G.scene.add(this.group);
    this.group.updateMatrixWorld(true);
    this.colliders = []; this.lamps = []; this.inter = []; this.updaters = []; this.doors = []; this.drawers = []; this.hides = [];
    this.geos = []; this.mats = []; this.exits = []; this.placed = [];
    this.dark = false; this.flicker = 0;
    this.bounds = G.footprint(this.origin, this.dir, this.xl, this.xr, 0, this.L);
    this.center = this.l2w((this.xl + this.xr) / 2, 1.6, this.L / 2);
  }
  l2w(x, y, z) { return this.group.localToWorld(new V3(x, y, z)); }
  w2l(v) { return this.group.worldToLocal(v.clone()); }
  sub(x, z, ry = 0, y = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    this.group.add(g); g.updateMatrixWorld(true); return g;
  }
  // Box centered at (x,y,z) in the parent's local space; world-scaled UVs; optional collider.
  box(x, y, z, w, h, d, mat, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
    G.worldUV(g, o.uv || 2);
    this.geos.push(g);
    const m = new THREE.Mesh(g, mat);
    (o.parent || this.group).add(m);
    if (o.collide !== false) m.userData.col = this.addCol(x, y, z, w, h, d, o.parent);
    return m;
  }
  mesh(geo, mat, x, y, z, parent, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    (parent || this.group).add(m); return m;
  }
  addCol(x, y, z, w, h, d, parent) { const c = G.aabb(parent || this.group, x, y, z, w, h, d); this.colliders.push(c); return c; }
  anim(obj, prop, to, dur) {
    const from = obj.position[prop]; let t = 0;
    this.updaters.push(dt => { t += dt; const k = Math.min(1, t / dur); obj.position[prop] = from + (to - from) * (1 - Math.pow(1 - k, 3)); return k < 1; });
  }
  addInter(pos, label, use, r = 2.1) { const it = { pos, r, label: typeof label === 'function' ? label : () => label, use }; this.inter.push(it); return it; }

  shell(o = {}) {
    const { xl, xr, L, H } = this, t = this.theme;
    this.box((xl + xr) / 2, -0.1, L / 2, xr - xl + 0.4, 0.2, L + 0.4, t.floor, { collide: false, uv: t.floorUV || 4 });
    if (!t.noCeil) this.box((xl + xr) / 2, H + 0.1, L / 2, xr - xl + 0.4, 0.2, L + 0.4, t.ceil, { collide: false, uv: 4 });
    const gaps = { front: [], left: [], right: [], back: o.noBackGap ? [] : [{ c: 0, w: DW + 0.1, h: DH + 0.05 }] };
    for (const e of this.exits) if (!e.inset) gaps[e.side].push({ c: e.pos, w: (e.w || DW) + 0.1, h: (e.h || DH) + 0.05 });
    this.wallRun('x', L, L + WT, xl - WT, xr + WT, gaps.front);
    this.wallRun('x', 0, 0.15, xl, xr, gaps.back);
    this.wallRun('z', xr, xr + WT, 0, L, gaps.right);
    this.wallRun('z', xl - WT, xl, 0, L, gaps.left);
  }
  wallRun(axis, f0, f1, a0, a1, gaps) {
    const H = this.H, mat = this.theme.wall, uv = this.theme.wallUV || 4;
    gaps.sort((a, b) => a.c - b.c);
    const seg = (s, e, y0, y1) => {
      if (e - s < 0.01 || y1 - y0 < 0.01) return;
      const c = (s + e) / 2, len = e - s, fc = (f0 + f1) / 2, ft = f1 - f0;
      if (axis === 'x') this.box(c, (y0 + y1) / 2, fc, len, y1 - y0, ft, mat, { uv });
      else this.box(fc, (y0 + y1) / 2, c, ft, y1 - y0, len, mat, { uv });
    };
    let cur = a0;
    for (const g of gaps) { seg(cur, g.c - g.w / 2, 0, H); seg(g.c - g.w / 2, g.c + g.w / 2, g.h, H); cur = g.c + g.w / 2; }
    seg(cur, a1, 0, H);
  }
  // Exit door frame on a wall. Frame local +z points out of the room.
  makeExit(e, o = {}) {
    const fr = new THREE.Group(), { xl, xr, L } = this;
    if (e.side === 'front') fr.position.set(e.pos, 0, e.inset ? L - 0.06 : L + WT / 2);
    else if (e.side === 'right') { fr.position.set(e.inset ? xr - 0.06 : xr + WT / 2, 0, e.pos); fr.rotation.y = Math.PI / 2; }
    else { fr.position.set(e.inset ? xl + 0.06 : xl - WT / 2, 0, e.pos); fr.rotation.y = -Math.PI / 2; }
    fr.position.y = e.y || 0;
    this.group.add(fr); fr.updateMatrixWorld(true);
    const d = new G.Door(this, fr, Object.assign({ w: e.w, h: e.h }, o));
    e.door = d; this.doors.push(d);
    if (e.real) {
      this.nextAt = G.nextAt({ origin: this.origin, dir: this.dir }, xl, xr, L, e.side, e.pos, e.y);
      this.exitPt = fr.localToWorld(new V3(0, 1.4, 0));
      this.exitDoor = d;
    }
    return d;
  }
  lamp(x, y, z, o = {}) {
    const color = new THREE.Color(o.color !== undefined ? o.color : (this.theme.lampColor || 0xffc98a));
    const mat = new THREE.MeshBasicMaterial({ color: color.clone() }); this.mats.push(mat);
    const type = o.type || this.theme.lamp || 'pendant';
    let g;
    if (o.parent) { g = new THREE.Group(); g.position.set(x, y, z); o.parent.add(g); g.updateMatrixWorld(true); }
    else g = this.sub(x, z, o.ry || 0, y);
    let ly = -0.3;
    if (type === 'pendant') {
      this.mesh(GEO.cord, M.black, 0, -0.3, 0, g, 1, 0.6, 1);
      this.mesh(GEO.shade, M.shade, 0, -0.68, 0, g);
      this.mesh(GEO.bulb, mat, 0, -0.78, 0, g);
      ly = -0.9;
    } else if (type === 'chandelier') {
      this.mesh(GEO.cord, M.brass, 0, -0.4, 0, g, 1, 0.8, 1);
      this.mesh(GEO.cyl, M.brass, 0, -0.85, 0, g, 0.5, 0.05, 0.5);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; this.mesh(GEO.bulb, mat, Math.cos(a) * 0.5, -0.75, Math.sin(a) * 0.5, g, 0.8, 1.2, 0.8); }
      ly = -0.95;
    } else if (type === 'sconce') {
      this.mesh(GEO.box, M.brass, 0, 0, 0.05, g, 0.12, 0.22, 0.1);
      this.mesh(GEO.shade, M.shade, 0, 0.12, 0.2, g, 0.45, 0.6, 0.45);
      this.mesh(GEO.bulb, mat, 0, 0.08, 0.2, g, 0.8, 0.8, 0.8);
      ly = 0.1;
    } else if (type === 'lantern') {
      this.mesh(GEO.cord, M.black, 0, -0.25, 0, g, 1, 0.5, 1);
      this.mesh(GEO.box, M.rust, 0, -0.55, 0, g, 0.2, 0.06, 0.2);
      this.mesh(GEO.bulb, mat, 0, -0.68, 0, g, 0.9, 1.3, 0.9);
      this.mesh(GEO.box, M.rust, 0, -0.85, 0, g, 0.22, 0.05, 0.22);
      ly = -0.75;
    } else if (type === 'fluor') {
      this.mesh(GEO.box, M.metal, 0, -0.05, 0, g, 0.3, 0.08, 1.4);
      this.mesh(GEO.box, mat, 0, -0.1, 0, g, 0.16, 0.04, 1.3);
      ly = -0.4;
    } else if (type === 'post') {
      this.mesh(GEO.cyl, M.black, 0, 1.6, 0, g, 0.07, 3.2, 0.07);
      this.mesh(GEO.box, M.black, 0, 3.25, 0, g, 0.32, 0.1, 0.32);
      this.mesh(GEO.bulb, mat, 0, 3.05, 0, g, 1.3, 1.6, 1.3);
      this.addCol(0, 1.5, 0, 0.2, 3, 0.2, g);
      ly = 2.9;
    } else if (type === 'floor') {
      this.mesh(GEO.box, mat, 0, 0.02, 0, g, 0.25, 0.04, 0.25);
      ly = 0.3;
    } else if (type === 'bare') {
      this.mesh(GEO.bulb, mat, 0, 0, 0, g);
      ly = 0;
    }
    const L = {
      pos: g.localToWorld(new V3(0, ly, 0)), color, base: o.intensity || this.theme.lampI || 14, dist: o.dist || this.theme.lampD || 11,
      mat, on: !this.dark && !o.off, broken: false, room: this, f: 1, buzz: !!o.buzz, group: g,
    };
    this.lamps.push(L);
    return L;
  }
  breakLights() {
    let any = false;
    for (const L of this.lamps) if (L.on && !L.broken && !L.unbreakable) { L.broken = true; any = true; }
    if (any) { this.dark = true; G.audio.sfx('break'); }
  }
  finish() {
    const p0 = this.l2w(0, 1.6, 0.6);
    this.path = [p0, this.center.clone()];
    if (this.exitPt) this.path.push(this.exitPt.clone());
    const f = this.l2w(0, 0, 1).sub(this.l2w(0, 0, 0));
    this.spawnYaw = G.yawFromDir(f.x, f.z);
    return this;
  }
  isInside(p, m = 0.1) { return G.inBounds(this.bounds, p, m); }
  // Close the entrance once the room behind it has been unloaded.
  plug() {
    if (this.plugged) return;
    this.plugged = true;
    const m = new THREE.Mesh(GEO.doorPanel, this.theme.door || M.door);
    m.position.set(0, DH / 2, 0.075); this.group.add(m);
    this.addCol(0, DH / 2, 0.075, DW + 0.1, DH, 0.15);
  }
  update(dt) {
    if (this.flicker > 0) this.flicker -= dt;
    for (const d of this.doors) d.update(dt);
    this.updaters = this.updaters.filter(u => u(dt) !== false);
  }
  dispose() {
    this.disposed = true;
    G.scene.remove(this.group);
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    if (this.onDispose) this.onDispose();
  }
}
G.Room = Room;

G.nextAt = (at, xl, xr, L, side, pos, ey = 0) => {
  let lx, lz, dd;
  if (side === 'front') { lx = pos; lz = L + WT; dd = 0; }
  else if (side === 'right') { lx = xr + WT; lz = pos; dd = 1; }
  else { lx = xl - WT; lz = pos; dd = 3; }
  const p = G.l2wXZ(at.origin, at.dir, lx, lz);
  return { origin: new V3(p.x, (at.origin.y || 0) + ey, p.z), dir: (at.dir + dd) % 4 };
};

/* ---------- Door ---------- */
class Door {
  constructor(room, fr, o = {}) {
    this.room = room; this.fr = fr; this.o = o;
    this.number = o.number; this.locked = !!o.locked; this.fake = !!o.fake; this.padlock = !!o.padlock;
    this.interior = !!o.interior; this.sealed = !!o.sealed; this.noAuto = !!o.noAuto;
    this.isOpen = false; this.ang = 0; this.target = 0;
    const w = this.w = o.w || DW, h = this.h = o.h || DH;
    const trim = o.trim || room.theme.trim || M.trim;
    room.box(-w / 2 - 0.07, h / 2, 0, 0.14, h + 0.14, WT + 0.12, trim, { parent: fr, collide: false, uv: 1 });
    room.box(w / 2 + 0.07, h / 2, 0, 0.14, h + 0.14, WT + 0.12, trim, { parent: fr, collide: false, uv: 1 });
    room.box(0, h + 0.07, 0, w + 0.28, 0.14, WT + 0.12, trim, { parent: fr, collide: false, uv: 1 });
    this.pivot = new THREE.Group(); this.pivot.position.set(-w / 2, 0, 0); fr.add(this.pivot);
    let pg = GEO.doorPanel;
    if (w !== DW || h !== DH) { pg = new THREE.BoxGeometry(w - 0.04, h - 0.03, 0.07); room.geos.push(pg); }
    const panel = new THREE.Mesh(pg, o.mat || room.theme.door || M.door);
    panel.position.set(w / 2, h / 2 - 0.01, 0); this.pivot.add(panel); this.panel = panel;
    if (!o.noKnob) for (const z of [-0.07, 0.07]) room.mesh(GEO.knob, M.brass, w - 0.15, 1.0, z, this.pivot);
    const text = o.plateText !== undefined ? o.plateText : (this.number !== undefined && G.game.floor ? G.game.floor.plate(this.number) : null);
    if (text && !o.noPlate) {
      const pm = new THREE.Mesh(GEO.plate, new THREE.MeshStandardMaterial({ map: G.plateTex(text), roughness: 0.35, metalness: 0.5 }));
      room.mats.push(pm.material);
      pm.position.set(w / 2, Math.min(1.8, h - 0.4), -0.045); pm.rotation.y = Math.PI; this.pivot.add(pm);
    }
    if (this.locked || this.padlock) { this.lockMesh = room.mesh(GEO.padlock, M.brass, w - 0.15, 0.82, -0.09, this.pivot); }
    this.col = room.addCol(0, h / 2, 0, w, h, WT + 0.02, fr);
    if (this.interior) this.col.isDoor = true;
    this.center = fr.localToWorld(new V3(0, 0, 0));
    this.inward = fr.localToWorld(new V3(0, 0, -1)).sub(this.center);
    this.inter = room.addInter(fr.localToWorld(new V3(0, 1.2, -0.3)), () => this.label(), () => this.tryOpen(true), 2.3);
    this.inter.door = this;
  }
  label() {
    if (this.isOpen) return null;
    if (this.sealed) return this.o.sealedLabel || null;
    if (this.padlock) return 'Unlock padlock';
    if (this.locked) return (G.game.inv.has('key') || G.game.inv.has('lockpick') || (this.o.keyId && G.game.inv.has(this.o.keyId))) ? 'Unlock' : 'Locked';
    return 'Open';
  }
  tryOpen(manual) {
    if (this.isOpen) return;
    if (this.sealed) { if (manual && this.o.sealedMsg) G.ui.msg(this.o.sealedMsg); return; }
    if (this.fake) { if (this.onFake) this.onFake(this); return; }
    if (this.padlock) { if (manual && this.onPadlock) this.onPadlock(this); return; }
    if (this.locked) {
      const inv = G.game.inv;
      if (this.o.keyId) {
        if (inv.has(this.o.keyId)) { inv.remove(this.o.keyId); this.unlock(); }
        else { if (manual) { G.audio.sfx('locked'); G.ui.msg(this.o.lockedMsg || "It's locked."); } return; }
      } else if (inv.has('key')) { inv.remove('key'); this.unlock(); }
      else if (inv.has('lockpick')) { inv.consume('lockpick'); this.unlock(); G.ui.msg('Picked the lock.'); }
      else { if (manual) { G.audio.sfx('locked'); G.ui.msg("It's locked. There must be a key in this room."); } return; }
    }
    this.open();
  }
  unlock() {
    this.locked = false; this.padlock = false;
    if (this.lockMesh) { this.pivot.remove(this.lockMesh); this.lockMesh = null; }
    G.audio.sfx('unlock');
  }
  open(silent) {
    if (this.isOpen) return;
    this.isOpen = true; this.target = -1.75; this.col.on = false;
    if (!silent) G.audio.sfx('door');
    if (!this.interior) G.game.onDoorOpen(this);
    if (this.onOpen) this.onOpen(this);
  }
  close(slam) { this.isOpen = false; this.target = 0; this.col.on = true; if (slam) { G.audio.sfx('slam'); G.player.shake = Math.max(G.player.shake, 0.4); } }
  update(dt) {
    const k = Math.min(1, dt * (this.target ? 5 : 14));
    this.ang += (this.target - this.ang) * k;
    this.pivot.rotation.y = this.ang;
  }
}
G.Door = Door;

/* ---------- layout ---------- */
G.SIZES = {
  hall: { W: [3.6, 4.6], L: [11, 19], sides: ['front', 'left', 'right'] },
  room: { W: [6.5, 9.5], L: [7.5, 11], sides: ['front', 'left', 'right'] },
  big: { W: [10, 13], L: [11, 15], sides: ['front', 'left', 'right'] },
  tunnel: { W: [4, 5.5], L: [14, 24], sides: ['front', 'left', 'right'] },
  cave: { W: [10, 15], L: [12, 18], sides: ['front', 'left', 'right'] },
  small: { W: [5.5, 8], L: [6, 8.5], sides: ['front', 'left', 'right'] },
  garden: { W: [14, 20], L: [20, 30], sides: ['front', 'left', 'right'] },
};
G.chooseLayout = (game, at, o) => {
  const base = game.baseDir || 0;
  for (let t = 0; t < 18; t++) {
    const strict = t < 14;
    const W = o.Wfix || G.rand(o.W[0], o.W[1]), L = o.Lfix || G.rand(o.L[0], o.L[1]);
    const maxOff = Math.max(0, W / 2 - DW / 2 - 0.7);
    const off = o.center ? 0 : G.rand(-maxOff, maxOff) * 0.75;
    const xl = -W / 2 + off, xr = W / 2 + off;
    const fp = G.footprint(at.origin, at.dir, xl - WT, xr + WT, 0.05, L + WT);
    if (strict && game.rooms.some(r => G.overlap(r.bounds, fp))) continue;
    const sides = G.shuffle((o.sides || ['front']).slice());
    if (o.preferFront) sides.sort((a, b) => (b === 'front') - (a === 'front'));
    for (const side of sides) {
      let pos;
      if (side === 'front') pos = o.center ? 0 : G.rand(xl + 1.1, xr - 1.1);
      else { if (L < 6) continue; pos = G.rand(Math.max(2.4, L * 0.55), L - 1.2); }
      const nx = G.nextAt(at, xl, xr, L, side, pos);
      if (nx.dir === (base + 2) % 4) continue;
      const probe = G.footprint(nx.origin, nx.dir, -3, 3, 0.2, 11);
      if (strict && (G.overlap(probe, fp) || game.rooms.some(r => G.overlap(r.bounds, probe)))) continue;
      return { xl, xr, L, W, side, pos };
    }
  }
  return { xl: -2, xr: 2, L: 8, W: 4, side: 'front', pos: 0 };
};

/* ---------- lights ---------- */
G.updateLights = game => {
  const cam = G.camera.position, list = [];
  for (const r of game.rooms) {
    const fl = r.flicker > 0;
    for (const L of r.lamps) {
      let f = 0;
      if (L.on && !L.broken) {
        f = 1;
        if (fl) f = G.random() < 0.45 ? 0.05 : G.random();
        else if (L.buzz) f = G.random() < 0.03 ? 0.2 : 0.9 + G.random() * 0.1;
      }
      L.f = f;
      L.mat.color.copy(L.color).multiplyScalar(f > 0 ? 0.35 + f * 0.75 : 0.04);
      if (f > 0) { L.d2 = L.pos.distanceToSquared(cam); list.push(L); }
    }
  }
  list.sort((a, b) => a.d2 - b.d2);
  for (let i = 0; i < G.lightPool.length; i++) {
    const pl = G.lightPool[i], L = list[i];
    if (L) { pl.position.copy(L.pos); pl.color.copy(L.color); pl.distance = L.dist; pl.intensity = L.base * L.f; }
    else pl.intensity = 0;
  }
};

/* ---------- furniture ---------- */
const F = G.furn = {};
// Every piece is built in a sub-group whose local +z faces into the room; its back sits at z=0.
F.closet = (room, g) => {
  const body = room.theme.closetMat || M.wood, dark = room.theme.closetDoor || M.darkwood;
  room.box(0, 1.2, 0.45, 1.3, 2.4, 0.9, body, { parent: g });
  room.box(0, 2.45, 0.45, 1.42, 0.1, 1.0, M.trim, { parent: g, collide: false });
  const doors = [];
  for (const s of [-1, 1]) {
    const d = room.box(s * 0.32, 1.17, 0.915, 0.6, 2.2, 0.04, dark, { parent: g, collide: false, uv: 1 });
    for (let k = 0; k < 7; k++) room.box(s * 0.32, 1.45 + k * 0.08, 0.94, 0.44, 0.02, 0.01, M.black, { parent: g, collide: false });
    room.mesh(GEO.knob, M.brass, s * 0.08, 1.15, 0.95, g, 0.7, 0.7, 0.7);
    doors.push(d);
  }
  const fwd = g.localToWorld(new V3(0, 0, 1)).sub(g.localToWorld(new V3(0, 0, 0)));
  const spot = { kind: 'closet', room, doors, in: g.localToWorld(new V3(0, 0, 0.45)), out: g.localToWorld(new V3(0, 0, 1.4)), yaw: G.yawFromDir(fwd.x, fwd.z), jack: G.chance(0.025) };
  room.hides.push(spot);
  room.addInter(g.localToWorld(new V3(0, 1.3, 1.0)), () => (G.player.hiding ? null : 'Hide'), () => G.game.hide(spot), 2.1);
};
F.closet.w = 1.3; F.closet.d = 0.95;
F.locker = (room, g) => {
  room.box(0, 1.05, 0.33, 0.8, 2.1, 0.66, M.locker, { parent: g, uv: 1 });
  const d = room.box(0, 1.03, 0.675, 0.72, 2.0, 0.03, M.locker, { parent: g, collide: false, uv: 1 });
  for (let k = 0; k < 5; k++) room.box(0, 1.6 + k * 0.07, 0.695, 0.4, 0.02, 0.01, M.black, { parent: g, collide: false });
  const fwd = g.localToWorld(new V3(0, 0, 1)).sub(g.localToWorld(new V3(0, 0, 0)));
  const spot = { kind: 'locker', room, doors: [d], in: g.localToWorld(new V3(0, 0, 0.33)), out: g.localToWorld(new V3(0, 0, 1.1)), yaw: G.yawFromDir(fwd.x, fwd.z) };
  room.hides.push(spot);
  room.addInter(g.localToWorld(new V3(0, 1.3, 0.8)), () => (G.player.hiding ? null : 'Hide'), () => G.game.hide(spot), 2.0);
};
F.locker.w = 0.85; F.locker.d = 0.72;
F.dresser = (room, g) => {
  const mat = room.theme.dresserMat || M.wood;
  room.box(0, 0.48, 0.27, 1.3, 0.96, 0.54, mat, { parent: g });
  room.box(0, 0.98, 0.28, 1.38, 0.05, 0.6, M.darkwood, { parent: g, collide: false });
  for (let i = 0; i < 3; i++) {
    const y = 0.2 + i * 0.27;
    const dg = new THREE.Group(); dg.position.set(0, y, 0.54); g.add(dg);
    room.box(0, 0, 0.015, 1.18, 0.23, 0.04, M.darkwood, { parent: dg, collide: false, uv: 1 });
    room.box(0, 0, -0.2, 1.1, 0.18, 0.38, mat, { parent: dg, collide: false, uv: 1 });
    room.mesh(GEO.box, M.brass, 0, 0, 0.05, dg, 0.18, 0.03, 0.03);
    const dr = { g: dg, open: false, room };
    room.drawers.push(dr);
    room.addInter(g.localToWorld(new V3(0, y, 0.75)), () => (dr.open ? null : 'Open'), () => {
      if (dr.open) return;
      dr.open = true; G.audio.sfx('drawer'); G.game.noise(G.player.pos, 4);
      room.anim(dg, 'z', 0.85, 0.25);
      G.game.lootDrawer(room, dr);
    }, 1.9);
  }
  if (G.chance(0.35) && !room.theme.noPaintings) {
    const pm = M.painting[G.randi(0, M.painting.length - 1)];
    room.box(0, 1.85, 0.03, 0.78, 0.94, 0.04, M.trim, { parent: g, collide: false, uv: 1 });
    const p = room.mesh(GEO.plane, pm, 0, 1.85, 0.055, g, 0.66, 0.82, 1);
    p.material = pm;
  }
  if (G.chance(0.3)) G.furn.goldPile(room, g, G.rand(-0.4, 0.4), 1.01, 0.3);
  else if (G.chance(0.3)) room.lamp(0.45, 1.08, 0.25, { type: 'bare', intensity: 3, dist: 5, parent: g });
};
F.dresser.w = 1.4; F.dresser.d = 0.62;
F.bed = (room, g) => {
  room.box(0, 0.25, 1.05, 1.7, 0.5, 2.1, M.darkwood, { parent: g });
  room.box(0, 0.58, 1.1, 1.6, 0.18, 1.95, M.sheet, { parent: g, collide: false, uv: 1 });
  room.box(0, 0.7, 0.35, 1.2, 0.14, 0.4, M.white, { parent: g, collide: false, uv: 1 });
  room.box(0, 0.62, 1.45, 1.66, 0.2, 1.1, M.fabric, { parent: g, collide: false, uv: 1 });
  room.box(0, 0.75, 0.05, 1.8, 1.5, 0.1, M.darkwood, { parent: g, uv: 1 });
};
F.bed.w = 1.85; F.bed.d = 2.15;
F.table = (room, g) => {
  room.box(0, 0.78, 0.45, 1.3, 0.06, 0.8, M.wood, { parent: g, collide: false });
  for (const [a, b] of [[-0.58, 0.12], [0.58, 0.12], [-0.58, 0.78], [0.58, 0.78]]) room.box(a, 0.38, b, 0.07, 0.76, 0.07, M.darkwood, { parent: g, collide: false });
  room.addCol(0, 0.4, 0.45, 1.3, 0.8, 0.8, g);
  if (G.chance(0.4)) G.furn.goldPile(room, g, G.rand(-0.4, 0.4), 0.82, 0.45);
  if (G.chance(0.5)) room.lamp(-0.4, 0.88, 0.4, { type: 'bare', intensity: 3, dist: 5, parent: g });
};
F.table.w = 1.4; F.table.d = 0.9;
F.plant = (room, g) => {
  room.mesh(GEO.cyl, M.pot, 0, 0.25, 0.3, g, 0.22, 0.5, 0.22);
  for (let i = 0; i < 6; i++) room.mesh(GEO.sphere, M.leaf, G.rand(-0.2, 0.2), G.rand(0.7, 1.3), 0.3 + G.rand(-0.2, 0.2), g, 0.25, 0.3, 0.25);
  room.addCol(0, 0.5, 0.3, 0.45, 1, 0.45, g);
};
F.plant.w = 0.6; F.plant.d = 0.6;
F.shelf = (room, g) => {
  room.box(0, 1.1, 0.22, 1.5, 2.2, 0.44, M.darkwood, { parent: g });
  room.box(0, 1.1, 0.445, 1.4, 2.05, 0.01, M.books, { parent: g, collide: false, uv: 2 });
};
F.shelf.w = 1.55; F.shelf.d = 0.48;
F.crate = (room, g) => {
  const s = G.rand(0.8, 1.15);
  room.box(0, s / 2, s / 2 + 0.05, s, s, s, M.beam, { parent: g, uv: 1 });
  if (G.chance(0.5)) room.box(G.rand(-0.1, 0.1), s + 0.3, s / 2 + 0.05, 0.6, 0.6, 0.6, M.beam, { parent: g, uv: 1 });
};
F.crate.w = 1.2; F.crate.d = 1.25;
F.barrel = (room, g) => {
  room.mesh(GEO.cyl, M.rust, 0, 0.5, 0.4, g, 0.35, 1, 0.35);
  room.addCol(0, 0.5, 0.4, 0.7, 1, 0.7, g);
};
F.barrel.w = 0.8; F.barrel.d = 0.8;
F.pipes = (room, g) => {
  for (let i = 0; i < 3; i++) { const p = room.mesh(GEO.cyl, M.rust, -0.4 + i * 0.35, room.H / 2, 0.15, g, 0.08, room.H, 0.08); p.castShadow = false; }
  room.addCol(0, room.H / 2, 0.15, 1.1, room.H, 0.3, g);
};
F.pipes.w = 1.2; F.pipes.d = 0.32;
F.planter = (room, g) => {
  room.box(0, 0.35, 0.4, 1.6, 0.7, 0.75, M.stone, { parent: g, uv: 1 });
  for (let i = 0; i < 7; i++) room.mesh(GEO.sphere, M.leaf, G.rand(-0.6, 0.6), G.rand(0.8, 1.4), 0.4 + G.rand(-0.2, 0.2), g, 0.3, 0.4, 0.3);
};
F.planter.w = 1.65; F.planter.d = 0.8;
F.sofa = (room, g) => {
  room.box(0, 0.25, 0.45, 2.0, 0.5, 0.85, M.fabric, { parent: g, uv: 1 });
  room.box(0, 0.65, 0.12, 2.0, 0.6, 0.22, M.fabric, { parent: g, collide: false, uv: 1 });
  for (const s of [-1, 1]) room.box(s * 0.93, 0.5, 0.45, 0.16, 0.5, 0.85, M.fabric, { parent: g, collide: false, uv: 1 });
};
F.sofa.w = 2.05; F.sofa.d = 0.9;
F.toolbox = (room, g) => {
  const save = room.theme.dresserMat; room.theme.dresserMat = M.rust;
  F.dresser(room, g); room.theme.dresserMat = save;
};
F.toolbox.w = 1.4; F.toolbox.d = 0.62;
F.bench = (room, g) => {
  room.box(0, 0.45, 0.35, 1.8, 0.08, 0.5, M.wood, { parent: g, collide: false });
  for (const s of [-1, 1]) room.box(s * 0.75, 0.22, 0.35, 0.08, 0.44, 0.45, M.black, { parent: g, collide: false });
  room.addCol(0, 0.4, 0.35, 1.8, 0.8, 0.5, g);
};
F.bench.w = 1.85; F.bench.d = 0.6;
F.statue = (room, g) => {
  room.box(0, 0.4, 0.5, 0.9, 0.8, 0.9, M.stone, { parent: g, uv: 1 });
  room.mesh(GEO.sphere, M.white, 0, 1.6, 0.5, g, 0.28, 0.6, 0.22);
  room.mesh(GEO.sphere, M.white, 0, 2.35, 0.5, g, 0.18, 0.22, 0.18);
};
F.statue.w = 1; F.statue.d = 1;
F.goldPile = (room, parent, x, y, z) => {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const n = G.randi(3, 7);
  for (let i = 0; i < n; i++) { const c = new THREE.Mesh(GEO.coin, M.gold); c.position.set(G.rand(-0.08, 0.08), i * 0.012, G.rand(-0.08, 0.08)); g.add(c); }
  g.updateMatrixWorld(true);
  const amount = G.randi(4, 18) * (G.game.goldMul || 1);
  const it = room.addInter(g.getWorldPosition(new V3()), () => (it.taken ? null : 'Take gold'), () => {
    if (it.taken) return; it.taken = true; parent.remove(g); G.game.addGold(amount);
  }, 1.8);
};
// A visible room key lying on a surface.
F.keyPickup = (room, parent, x, y, z) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = G.rand(0, Math.PI * 2); parent.add(g);
  const ringGeo = new THREE.TorusGeometry(0.035, 0.01, 6, 14); room.geos.push(ringGeo);
  const ring = new THREE.Mesh(ringGeo, M.gold); ring.rotation.x = Math.PI / 2; g.add(ring);
  const shaft = new THREE.Mesh(GEO.box, M.gold); shaft.scale.set(0.11, 0.012, 0.016); shaft.position.x = 0.09; g.add(shaft);
  for (const tx of [0.12, 0.14]) { const t = new THREE.Mesh(GEO.box, M.gold); t.scale.set(0.01, 0.012, 0.03); t.position.set(tx, 0, 0.015); g.add(t); }
  g.updateMatrixWorld(true);
  const it = room.addInter(g.getWorldPosition(new V3()), () => (it.taken ? null : 'Take key'), () => {
    if (it.taken) return;
    if (G.game.inv.add('key')) { it.taken = true; parent.remove(g); }
  }, 1.9);
  it.obj = g;
  room.keyItem = it;
  return it;
};
F.painting = (room, g) => {
  const pm = M.painting[G.randi(0, M.painting.length - 1)];
  room.box(0, 1.7, 0.03, 0.9, 1.1, 0.05, M.trim, { parent: g, collide: false, uv: 1 });
  room.mesh(GEO.plane, pm, 0, 1.7, 0.06, g, 0.76, 0.96, 1);
};
F.painting.w = 1; F.painting.d = 0.06;

function slotRect(s, w, d) {
  const r = Math.round(s.ry / (Math.PI / 2));
  if (r === 0) return { x0: s.x - w / 2, x1: s.x + w / 2, z0: s.z, z1: s.z + d };
  if (r === 2 || r === -2) return { x0: s.x - w / 2, x1: s.x + w / 2, z0: s.z - d, z1: s.z };
  if (r === 1) return { x0: s.x, x1: s.x + d, z0: s.z - w / 2, z1: s.z + w / 2 };
  return { x0: s.x - d, x1: s.x, z0: s.z - w / 2, z1: s.z + w / 2 };
}
const rectHit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
G.reserve = (room, x0, x1, z0, z1) => room.placed.push({ x0, x1, z0, z1 });
// Place furniture along the walls, avoiding doorways and each other.
G.furnish = (room, set, opts = {}) => {
  const { xl, xr, L } = room, S = [];
  const blocked = (side, p) => room.exits.some(e => e.side === side && Math.abs(e.pos - p) < 1.55);
  for (let z = 1.9; z < L - 1.0; z += 1.75) {
    if (!blocked('left', z)) S.push({ x: xl, z, ry: Math.PI / 2 });
    if (!blocked('right', z)) S.push({ x: xr, z, ry: -Math.PI / 2 });
  }
  for (let x = xl + 1.3; x < xr - 1.0; x += 1.75) {
    if (Math.abs(x) > 1.55) S.push({ x, z: 0.15, ry: 0 });
    if (!blocked('front', x)) S.push({ x, z: L, ry: Math.PI });
  }
  G.shuffle(S);
  const need = (opts.need || []).slice();
  const max = opts.max || 99;
  let count = 0;
  for (const s of S) {
    if (count >= max) break;
    let type = need.length ? need.shift() : G.weighted(set);
    if (type === 'none') continue;
    const Fn = F[type];
    if (!Fn) continue;
    if (Fn.d > 1.5 && (xr - xl) < 7) { if (need.length) continue; type = 'dresser'; }
    const fn = F[type];
    const rect = slotRect(s, fn.w, fn.d);
    if (rect.x0 < xl - 0.01 || rect.x1 > xr + 0.01 || rect.z0 < 0.1 || rect.z1 > L + 0.01 || room.placed.some(p => rectHit(p, rect))) {
      if (opts.need && opts.need.includes(type) && need.length < opts.need.length) need.unshift(type);
      continue;
    }
    room.placed.push(rect);
    fn(room, room.sub(s.x, s.z, s.ry));
    count++;
  }
};

/* ---------- navigation grid for walkers (Figure, Grumbles) ---------- */
class Nav {
  constructor(room, cell = 0.5, rad = 0.45) {
    const b = room.bounds;
    this.x0 = b.x0; this.z0 = b.z0; this.cs = cell;
    this.nx = Math.ceil((b.x1 - b.x0) / cell); this.nz = Math.ceil((b.z1 - b.z0) / cell);
    this.grid = new Uint8Array(this.nx * this.nz);
    const cols = room.colliders.filter(c => c.y0 < 1.5 && c.y1 > 0.3 && c.on);
    for (let i = 0; i < this.nx; i++) for (let j = 0; j < this.nz; j++) {
      const px = this.x0 + (i + 0.5) * cell, pz = this.z0 + (j + 0.5) * cell;
      let bl = false;
      for (const c of cols) {
        const dx = px - G.clamp(px, c.x0, c.x1), dz = pz - G.clamp(pz, c.z0, c.z1);
        if (dx * dx + dz * dz < rad * rad) { bl = true; break; }
      }
      this.grid[j * this.nx + i] = bl ? 1 : 0;
    }
  }
  cell(p) { return [G.clamp(Math.floor((p.x - this.x0) / this.cs), 0, this.nx - 1), G.clamp(Math.floor((p.z - this.z0) / this.cs), 0, this.nz - 1)]; }
  pos(i, j) { return new V3(this.x0 + (i + 0.5) * this.cs, 0, this.z0 + (j + 0.5) * this.cs); }
  free(i, j) { return i >= 0 && j >= 0 && i < this.nx && j < this.nz && !this.grid[j * this.nx + i]; }
  nearestFree(i, j) {
    if (this.free(i, j)) return [i, j];
    for (let r = 1; r < 8; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (this.free(i + a, j + b)) return [i + a, j + b];
    return null;
  }
  path(from, to) {
    const s = this.nearestFree(...this.cell(from)), t = this.nearestFree(...this.cell(to));
    if (!s || !t) return null;
    const N = this.nx * this.nz, prev = new Int32Array(N).fill(-1), si = s[1] * this.nx + s[0], ti = t[1] * this.nx + t[0];
    const q = [si]; prev[si] = si;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let h = 0; h < q.length; h++) {
      const c = q[h]; if (c === ti) break;
      const ci = c % this.nx, cj = (c / this.nx) | 0;
      for (const [a, b] of dirs) {
        const ni = ci + a, nj = cj + b;
        if (!this.free(ni, nj)) continue;
        if (a && b && (!this.free(ci + a, cj) || !this.free(ci, cj + b))) continue;
        const k = nj * this.nx + ni;
        if (prev[k] !== -1) continue;
        prev[k] = c; q.push(k);
      }
    }
    if (prev[ti] === -1) return null;
    const out = [];
    for (let c = ti; c !== si; c = prev[c]) out.push(this.pos(c % this.nx, (c / this.nx) | 0));
    out.reverse();
    // Thin the path: keep every other point.
    return out.filter((p, i) => i % 2 === 1 || i === out.length - 1);
  }
  randomFree() {
    for (let k = 0; k < 200; k++) { const i = G.randi(0, this.nx - 1), j = G.randi(0, this.nz - 1); if (this.free(i, j)) return this.pos(i, j); }
    return this.pos(this.nx >> 1, this.nz >> 1);
  }
}
G.Nav = Nav;

/* ---------- standard procedural room ---------- */
G.buildStandard = (game, n, at, cfg) => {
  const th = cfg.theme, K = G.SIZES[cfg.kind || 'room'];
  const lay = G.chooseLayout(game, at, { W: K.W, L: K.L, sides: cfg.sides || K.sides, preferFront: cfg.dupe || cfg.vacuum, Wfix: cfg.Wfix, Lfix: cfg.Lfix });
  const room = new Room(game, { index: n, origin: at.origin, dir: at.dir, xl: lay.xl, xr: lay.xr, L: lay.L, H: cfg.H || th.H, theme: th });
  room.kind = cfg.kind; room.dark = !!cfg.dark;
  room.exits = [{ side: lay.side, pos: lay.pos, real: true }];
  const fakes = [];
  if ((cfg.dupe || cfg.vacuum) && lay.side === 'front' && lay.W >= 6) {
    const cand = [];
    for (let x = lay.xl + 1.1; x < lay.xr - 1.1; x += 0.4) if (Math.abs(x - lay.pos) > 2.1) cand.push(x);
    G.shuffle(cand);
    const want = cfg.vacuum ? 1 : 2;
    for (const x of cand) { if (fakes.length >= want) break; if (fakes.every(f => Math.abs(f - x) > 2.1)) fakes.push(x); }
    for (const x of fakes) room.exits.push({ side: 'front', pos: x, inset: true, fake: true });
  }
  room.shell({ noBackGap: cfg.noBackGap });
  const realDoor = room.makeExit(room.exits[0], { number: n + 1, locked: cfg.locked, noAuto: fakes.length > 0 });
  if (fakes.length) {
    room.dupe = !!cfg.dupe; room.vacuum = !!cfg.vacuum;
    let wrong = G.shuffle([n, n + 2, n + 3, n - 1].filter(v => v !== n + 1 && v >= 0));
    for (const e of room.exits.filter(e => e.fake)) {
      const d = room.makeExit(e, { number: wrong.pop(), fake: true, noAuto: true, noPlate: !!cfg.vacuum });
      d.onFake = cfg.vacuum ? () => G.game.vacuum(d) : () => G.game.dupe(d);
    }
    if (cfg.vacuum) realDoor.noAuto = true;
  }
  // lamps
  const lampsN = Math.max(1, Math.round(room.L / 7));
  if (th.placeLamps) th.placeLamps(room);
  else {
    const cx = (room.xl + room.xr) / 2, xs = lay.W > 9 ? [cx - lay.W / 4, cx + lay.W / 4] : [cx];
    const chand = th.lamp === 'pendant' && lay.W > 9 && G.chance(0.5);
    for (let i = 0; i < lampsN; i++) {
      const z = room.L * (i + 0.5) / lampsN;
      if (chand) { room.lamp(cx, room.H, z, { type: 'chandelier', intensity: (th.lampI || 14) * 1.6, dist: 15 }); continue; }
      for (const x of xs) room.lamp(x, room.H, z, { type: th.lamp, buzz: th.lamp === 'fluor' && G.chance(0.3) });
    }
  }
  if (th.sconces && G.chance(0.6)) {
    for (const s of [-1, 1]) room.lamp(s < 0 ? room.xl : room.xr, 1.9, room.L * 0.35, { type: 'sconce', ry: s < 0 ? Math.PI / 2 : -Math.PI / 2, intensity: 4, dist: 6 });
  }
  if (th.extras) th.extras(room, cfg);
  const need = (cfg.need || th.need || []).slice();
  if (cfg.locked && !need.includes('dresser') && !need.includes('toolbox')) need.push(th.lootFurn || 'dresser');
  G.furnish(room, th.furn, { need });
  // rug
  if (th.rug && lay.W > 5 && G.chance(0.5)) room.box((room.xl + room.xr) / 2, 0.006, room.L / 2, Math.min(3, lay.W - 2.4), 0.01, Math.min(5, room.L - 2), M.carpet, { collide: false, uv: 2 });
  // Every locked door has its key somewhere in the same room: on a dresser, in a drawer, or on the floor.
  if (cfg.locked) {
    const tops = [...new Set(room.drawers.map(d => d.g.parent))];
    if (tops.length && G.chance(0.55)) F.keyPickup(room, G.pick(tops), G.rand(-0.4, 0.4), 1.02, 0.3);
    else if (room.drawers.length) G.pick(room.drawers).key = true;
    else F.keyPickup(room, room.group, G.rand(room.xl + 0.8, room.xr - 0.8), 0.02, G.rand(1.5, room.L - 1.5));
  }
  if (cfg.after) cfg.after(room);
  return room.finish();
};
})();
