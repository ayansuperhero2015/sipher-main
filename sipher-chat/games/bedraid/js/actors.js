// Actors: the player and the bots share this body: physics, inventory, combat, building.
(() => {
'use strict';
const V3 = G.V3, wd = G.world;
const HW = 0.3, HEIGHT = 1.8, SNEAK_H = 1.5;
const GRAV = 30, JUMP_V = 8.7;
const ARMOR_RED = { leather: 0, chain: 0.2, iron: 0.35, diamond: 0.5 };
const HAND_DMG = 8;
let nextId = 1;

class Actor {
  constructor(o) {
    this.id = nextId++;
    this.name = o.name; this.team = o.team; this.isPlayer = !!o.isPlayer;
    this.pos = new V3(); this.vel = new V3(); this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.sneak = false; this.sprint = false;
    this.maxHp = 100; this.hp = 100; this.alive = true; this.eliminated = false; this.respawnAt = 0;
    this.slots = new Array(9).fill(null); this.sel = 0;
    this.res = { iron: 0, gold: 0, diamond: 0, emerald: 0 };
    this.armor = 'leather'; this.pickTier = 0; this.axeTier = 0; this.shears = false;
    this.effects = { speed: 0, heal: 0, slow: 0 };
    this.lastHit = null; this.atkCd = 0; this.iframes = 0; this.useCd = 0;
    this.breaking = null; this.bowDraw = 0;
    this.stats = { kills: 0, finals: 0, beds: 0, deaths: 0 };
    this.fallStart = null;
    this.avatar = G.makeAvatar({ team: this.team });
    this.avatar.root.visible = !this.isPlayer;
    G.scene.add(this.avatar.root);
    this.tagDirty = true;
  }
  get tm() { return G.game.teams[this.team]; }
  get eye() { return new V3(this.pos.x, this.pos.y + (this.sneak ? 1.32 : 1.62), this.pos.z); }
  get height() { return this.sneak ? SNEAK_H : HEIGHT; }
  lookDir() { const cp = Math.cos(this.pitch); return new V3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }

  /* ---------- inventory ---------- */
  held() { return this.slots[this.sel]; }
  count(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.count; return n; }
  add(id, n = 1) {
    const d = G.ITEMS[id];
    for (const s of this.slots) if (s && s.id === id && s.count < d.stack) { const k = Math.min(n, d.stack - s.count); s.count += k; n -= k; if (!n) break; }
    while (n > 0) {
      const i = this.slots.indexOf(null);
      if (i < 0) return false;
      const k = Math.min(n, d.stack); this.slots[i] = { id, count: k }; n -= k;
    }
    this.invChanged();
    return true;
  }
  remove(id, n = 1) {
    for (let i = this.slots.length - 1; i >= 0 && n > 0; i--) {
      const s = this.slots[i]; if (!s || s.id !== id) continue;
      const k = Math.min(n, s.count); s.count -= k; n -= k; if (!s.count) this.slots[i] = null;
    }
    this.invChanged();
  }
  replaceKind(kind, id) {
    const i = this.slots.findIndex(s => s && G.ITEMS[s.id].kind === kind);
    if (i >= 0) this.slots[i] = { id, count: 1 }; else this.add(id, 1);
    this.invChanged();
  }
  firstBlockSlot() { return this.slots.findIndex(s => s && G.ITEMS[s.id].kind === 'block'); }
  blockCount() { let n = 0; for (const s of this.slots) if (s && G.ITEMS[s.id].kind === 'block') n += s.count; return n; }
  bestSword() { let best = null; for (const s of this.slots) if (s && G.ITEMS[s.id].kind === 'sword' && (!best || G.ITEMS[s.id].dmg > G.ITEMS[best.id].dmg)) best = s; return best; }
  invChanged() { if (this.isPlayer) G.ui.dirty = true; }
  giveStarter() {
    this.slots.fill(null);
    this.add('sword_wood', 1);
    if (this.pickTier) this.add('pick' + this.pickTier, 1);
    if (this.axeTier) this.add('axe' + this.axeTier, 1);
    if (this.shears) this.add('shears', 1);
    this.sel = 0;
  }

  /* ---------- physics ---------- */
  collides(x, y, z, h = this.height) { return wd.boxHits(x - HW, y, z - HW, x + HW, y + h, z + HW); }
  supported(x, z) { return wd.boxHits(x - HW + 0.02, this.pos.y - 0.6, z - HW + 0.02, x + HW - 0.02, this.pos.y - 0.01, z + HW - 0.02); }
  speedNow() {
    let s = this.sneak ? 1.6 : this.sprint ? 6.0 : 4.6;
    if (this.effects.speed > G.game.time) s *= 1.35;
    if (this.effects.slow > G.game.time) s *= 0.55;
    if (this.bowDraw > 0) s *= 0.5;
    return s;
  }
  // wish = desired horizontal direction (unit or zero), jump = wants to jump
  physics(dt, wx, wz, jump) {
    const sp = this.speedNow();
    const tx = wx * sp, tz = wz * sp;
    const acc = this.onGround ? 45 : 9;
    const k = Math.min(1, acc * dt / Math.max(sp, 1));
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;
    if (jump && this.onGround) { this.vel.y = JUMP_V * (this.effects.speed > G.game.time ? 1.12 : 1); this.onGround = false; }
    this.vel.y = Math.max(this.vel.y - GRAV * dt, -60);
    // uncrouch only if there is headroom
    if (!this.sneak && this.collides(this.pos.x, this.pos.y, this.pos.z, HEIGHT)) this.sneak = true;
    const steps = Math.ceil(Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z)) * dt / 0.4) || 1;
    const sdt = dt / steps;
    const wasGround = this.onGround;
    this.onGround = false;
    for (let s = 0; s < steps; s++) {
      // Y
      let ny = this.pos.y + this.vel.y * sdt;
      if (this.collides(this.pos.x, ny, this.pos.z)) {
        if (this.vel.y < 0) { this.onGround = true; ny = Math.floor(ny) + this.groundTop(ny); if (this.collides(this.pos.x, ny, this.pos.z)) ny = this.pos.y; }
        else ny = this.pos.y;
        this.vel.y = 0;
      }
      this.pos.y = ny;
      // X / Z, with sneak edge protection
      const guard = (this.sneak || this.bridging) && (this.onGround || wasGround);
      let nx = this.pos.x + this.vel.x * sdt;
      if (this.collides(nx, this.pos.y, this.pos.z) || (guard && !this.supported(nx, this.pos.z))) { nx = this.pos.x; this.vel.x = 0; this.hitWall = true; }
      this.pos.x = nx;
      let nz = this.pos.z + this.vel.z * sdt;
      if (this.collides(this.pos.x, this.pos.y, nz) || (guard && !this.supported(this.pos.x, nz))) { nz = this.pos.z; this.vel.z = 0; this.hitWall = true; }
      this.pos.z = nz;
    }
    if (!this.onGround && this.collides(this.pos.x, this.pos.y - 0.02, this.pos.z)) this.onGround = true;
    // fall damage
    if (!this.onGround) { if (this.fallStart === null || this.pos.y > this.fallStart) this.fallStart = this.pos.y; }
    else if (this.fallStart !== null) {
      const h = this.fallStart - this.pos.y; this.fallStart = null;
      if (h > 4.5) this.damage(Math.floor((h - 4) * 6), null, 'fall');
    }
    if (this.pos.y < G.VOID_Y && this.alive) this.die('void');
  }
  // the top of the block we landed in, as an offset within its cell
  groundTop(y) {
    const fy = Math.floor(y); let top = 0;
    for (const [dx, dz] of [[-HW, -HW], [HW, -HW], [-HW, HW], [HW, HW]]) top = Math.max(top, G.solidH(this.pos.x + dx, fy, this.pos.z + dz));
    return top || 1;
  }
  overlapsCell(x, y, z) {
    return this.alive && this.pos.x + HW > x && this.pos.x - HW < x + 1 && this.pos.z + HW > z && this.pos.z - HW < z + 1 && this.pos.y + this.height > y && this.pos.y < y + 1;
  }

  /* ---------- building ---------- */
  canPlace(x, y, z) {
    if (wd.get(x, y, z) || !G.canBuildAt(x, y, z)) return false;
    for (const a of G.game.actors) if (a.overlapsCell(x, y, z)) return false;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (wd.get(x + dx, y + dy, z + dz)) return true;
    return false;
  }
  placeBlock(x, y, z, slotIdx = this.sel) {
    const s = this.slots[slotIdx]; if (!s) return false;
    const d = G.ITEMS[s.id]; if (d.kind !== 'block') return false;
    if (!this.canPlace(x, y, z)) return false;
    wd.set(x, y, z, d.block === 'team' ? G.WOOL(this.team) : d.block, 1);
    s.count--; if (!s.count) this.slots[slotIdx] = null;
    this.invChanged();
    G.audio.place(new V3(x, y, z));
    this.avatar.swing = 1;
    return true;
  }
  breakTime(x, y, z) {
    const id = wd.get(x, y, z), b = G.BLOCKS[id];
    let speed = 1;
    if (b.tool === 'pick' && this.pickTier) speed = G.ITEMS['pick' + this.pickTier].speed;
    else if (b.tool === 'axe' && this.axeTier) speed = G.ITEMS['axe' + this.axeTier].speed;
    else if (b.tool === 'shears' && this.shears) speed = 4;
    else if (b.tool === 'pick' && !this.pickTier) speed = 0.6;
    speed *= 1 + 0.25 * this.tm.up.haste;
    if (!this.onGround) speed *= 0.6;
    return b.hard / speed;
  }
  canBreak(x, y, z) {
    const id = wd.get(x, y, z); if (!id) return false;
    if (G.BLOCKS[id].bed) return wd.bedTeamAt(x, y, z) !== this.team;
    return wd.isPlaced(x, y, z);
  }
  // Called every frame while the dig button is held on (x,y,z). Returns progress 0..1.
  dig(dt, x, y, z) {
    if (!this.canBreak(x, y, z)) { this.breaking = null; return 0; }
    if (!this.breaking || this.breaking.x !== x || this.breaking.y !== y || this.breaking.z !== z) this.breaking = { x, y, z, t: 0, snd: 0 };
    const br = this.breaking;
    br.t += dt; br.snd -= dt;
    if (br.snd <= 0) { br.snd = 0.22; G.audio.dig(new V3(x, y, z)); this.avatar.swing = 1; }
    const need = this.breakTime(x, y, z);
    if (br.t >= need) { G.game.breakBlock(x, y, z, this); this.breaking = null; return 1; }
    return br.t / need;
  }

  /* ---------- combat ---------- */
  meleeDamage() {
    const s = this.bestSword();
    const held = this.held();
    const d = held && G.ITEMS[held.id].kind === 'sword' ? G.ITEMS[held.id].dmg : s ? G.ITEMS[s.id].dmg * 0.5 : HAND_DMG;
    return d + (held && G.ITEMS[held.id].kind === 'sword' ? this.tm.up.sharp * 5 : 0);
  }
  attack(target) {
    if (this.atkCd > 0 || !target.alive || target.team === this.team) return false;
    this.atkCd = 0.42; this.avatar.swing = 1;
    let dmg = this.meleeDamage();
    const crit = !this.onGround && this.vel.y < -1;
    if (crit) dmg *= 1.25;
    const dx = target.pos.x - this.pos.x, dz = target.pos.z - this.pos.z, l = Math.hypot(dx, dz) || 1;
    const kb = this.sprint ? 8 : 6;
    const hit = target.damage(dmg, this, 'melee', { x: dx / l * kb, y: 5.2, z: dz / l * kb });
    if (hit) { this.lastLanded = G.game.time; G.audio.hit(target.pos); if (crit) G.fx.crit(target.pos); }
    return hit;
  }
  damage(amount, from, kind, kb) {
    if (!this.alive || G.game.state !== 'play') return false;
    if (kind === 'melee' && this.iframes > 0) return false;
    if (from && from.team === this.team && kind !== 'tnt') return false;
    let red = ARMOR_RED[this.armor] + this.tm.up.prot * 0.06;
    if (kind === 'fall' || kind === 'void') red = 0;
    const dmg = amount * (1 - Math.min(0.8, red));
    this.hp -= dmg; this.iframes = kind === 'melee' ? 0.38 : 0.1;
    if (kb) { this.vel.x = kb.x; this.vel.z = kb.z; this.vel.y = Math.max(this.vel.y, kb.y); this.onGround = false; }
    if (from && from !== this) this.lastHit = { by: from, t: G.game.time };
    this.avatar.hurt = 1; this.tagDirty = true;
    if (this.isPlayer) { G.audio.hurt(); G.ui.hurtFlash(); }
    if (this.bot) this.bot.onHurt(from);
    if (this.hp <= 0) this.die(kind, from);
    return true;
  }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); this.tagDirty = true; }
  die(kind, from) {
    if (!this.alive) return;
    this.alive = false; this.hp = 0; this.stats.deaths++;
    let killer = from;
    if ((!killer || killer === this) && this.lastHit && G.game.time - this.lastHit.t < 12) killer = this.lastHit.by;
    if (killer === this) killer = null;
    G.game.onDeath(this, killer, kind);
  }
  update(dt) {
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.useCd = Math.max(0, this.useCd - dt);
    if (!this.alive) return;
    // passive regeneration, faster with a healing aura on your own island
    const home = G.game.map.teams[this.team];
    const onIsland = G.dist2(this.pos.x, this.pos.z, home.cx, home.cz) < 13 * 13;
    let regen = 1.0;
    if (this.tm.up.heal && onIsland) regen += 3;
    if (this.effects.heal > G.game.time) regen += 10;
    if (!this.lastHit || G.game.time - this.lastHit.t > 5 || this.effects.heal > G.game.time) {
      if (this.hp < this.maxHp) { this.heal(regen * dt); }
    }
    if (this.tagDirty && !this.isPlayer) { this.avatar.drawTag(this.name, this.hp, this.maxHp); this.tagDirty = false; }
  }
  syncAvatar(dt) {
    const av = this.avatar;
    av.root.position.copy(this.pos);
    av.root.rotation.y = this.yaw + Math.PI; // avatars are built facing +z, the camera looks down -z
    av.headG.rotation.x = -this.pitch * 0.6;
    const held = this.held();
    const hid = held ? held.id : null;
    if (av.heldId !== hid) {
      let m = hid ? G.itemMesh(hid, this.team) : null;
      if (m) {
        const k = G.ITEMS[hid].kind;
        if (k === 'sword' || k === 'pick' || k === 'axe') { m.scale.setScalar(0.85); m.rotation.set(-Math.PI / 2 + 0.2, 0, 0); m.position.set(0, -0.05, 0.05); }
        else if (hid === 'bow') { m.rotation.set(0, Math.PI / 2, 0); }
      }
      av.setHeld(hid, m);
    }
    if (av.armorTier !== this.armor) av.setArmor(this.armor);
    av.animate(dt, Math.hypot(this.vel.x, this.vel.z), this.onGround, this.sneak);
  }
}
G.Actor = Actor;

// Ray vs actor bounding box (slab test). Returns distance or -1.
G.rayActor = (o, d, a, maxD) => {
  const x0 = a.pos.x - HW - 0.1, x1 = a.pos.x + HW + 0.1, y0 = a.pos.y, y1 = a.pos.y + a.height + 0.1, z0 = a.pos.z - HW - 0.1, z1 = a.pos.z + HW + 0.1;
  let tmin = 0, tmax = maxD;
  for (const [oo, dd, lo, hi] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
    if (Math.abs(dd) < 1e-8) { if (oo < lo || oo > hi) return -1; continue; }
    let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd; if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return -1;
  }
  return tmin;
};
G.ACTOR_HW = HW;
})();
