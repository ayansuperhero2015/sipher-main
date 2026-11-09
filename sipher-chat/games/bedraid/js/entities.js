// Entities: generators, projectiles, TNT, explosions, particles, shopkeepers and bed models.
(() => {
'use strict';
const V3 = G.V3, wd = G.world, S = G.SURF;

/* ---------- text sprites ---------- */
G.textSprite = (lines, o = {}) => {
  const c = document.createElement('canvas'); c.width = o.w || 512; c.height = o.h || 128;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: o.depthTest !== false }));
  sp.scale.set((o.scale || 2) * c.width / c.height, o.scale || 2, 1);
  sp.userData.set = (ls) => {
    const k = c.getContext('2d'); k.clearRect(0, 0, c.width, c.height);
    k.textAlign = 'center'; k.textBaseline = 'middle';
    const n = ls.length;
    ls.forEach((l, i) => {
      const fs = l.size || 46;
      k.font = `${l.font || '900'} ${fs}px ${l.family || 'Rubik, sans-serif'}`;
      const y = c.height / 2 + (i - (n - 1) / 2) * (c.height / Math.max(n, 1.6));
      k.lineWidth = 8; k.strokeStyle = 'rgba(0,0,0,0.8)'; k.strokeText(l.text, c.width / 2, y);
      k.fillStyle = l.color || '#fff'; k.fillText(l.text, c.width / 2, y);
    });
    t.needsUpdate = true;
  };
  sp.userData.set(lines);
  return sp;
};

/* ---------- particles ---------- */
const BLOCK_COL = { 1: 0x56b83a, 2: 0x8a5a35, 3: 0x8c8f94, 4: 0xb98a4e, 5: 0x6e4a22, 6: 0x3c9a30, 7: 0xe8e2b0, 8: 0x2a1f3a, 9: 0xcfe9ff, 10: 0xb36a4a, 15: 0x4a4f5c, 16: 0xb33a3a, 17: 0x9aa3b5, 18: 0x9c4a3a };
G.TEAMS.forEach(t => { BLOCK_COL[11 + t.id] = t.color; });
const parts = [];
const pGeo = new THREE.BoxGeometry(1, 1, 1);
const fx = G.fx = {
  burst(pos, color, n = 10, o = {}) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      const s = (o.size || 0.12) * G.rand(0.6, 1.3); m.scale.setScalar(s);
      m.position.set(pos.x + G.rand(-0.35, 0.35), pos.y + G.rand(-0.35, 0.35), pos.z + G.rand(-0.35, 0.35));
      G.scene.add(m);
      const sp = o.speed || 3;
      parts.push({ m, v: new V3(G.rand(-1, 1) * sp, G.rand(0.3, 1.4) * sp, G.rand(-1, 1) * sp), life: o.life || G.rand(0.5, 0.9), max: o.life || 0.9, grav: o.grav !== undefined ? o.grav : 14 });
    }
  },
  block(x, y, z, id) { fx.burst(new V3(x + 0.5, y + 0.5, z + 0.5), BLOCK_COL[id] || 0xaaaaaa, 12); },
  crit(pos) { fx.burst(new V3(pos.x, pos.y + 1.3, pos.z), 0xfff27a, 8, { size: 0.07, speed: 2.5, grav: 2 }); },
  blood(pos) { fx.burst(new V3(pos.x, pos.y + 1.1, pos.z), 0xd02020, 6, { size: 0.08, speed: 2 }); },
  smoke(pos, n = 18) { fx.burst(pos, 0x777777, n, { size: 0.45, speed: 4, grav: -2, life: 1.2 }); fx.burst(pos, 0xff9a2e, n, { size: 0.3, speed: 6, grav: 0, life: 0.5 }); },
  update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { G.scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); continue; }
      p.v.y -= p.grav * dt; p.m.position.addScaledVector(p.v, dt);
      if (p.grav > 0 && wd.get(p.m.position.x, p.m.position.y, p.m.position.z)) { p.v.multiplyScalar(0.3); p.m.position.y = Math.floor(p.m.position.y) + 1.02; }
      p.m.material.opacity = Math.min(1, p.life / p.max * 2);
    }
  },
  clear() { for (const p of parts) G.scene.remove(p.m); parts.length = 0; }
};

/* ---------- generators ---------- */
const GEN = {
  iron: { every: [1.1, 0.9, 0.75], cap: 48 },
  gold: { every: [6.5, 5.5, 4.5], cap: 12 },
  diamond: { every: [30, 22, 15], cap: 4 },
  emerald: { every: [55, 40, 27], cap: 2 }
};
class Gen {
  constructor(kind, pos, team = -1) {
    this.kind = kind; this.pos = pos; this.team = team; this.tier = 1;
    this.pile = { iron: 0, gold: 0, diamond: 0, emerald: 0 };
    this.timer = { iron: 1, gold: 4, diamond: GEN.diamond.every[0] * 0.5, emerald: GEN.emerald.every[0] * 0.5 };
    this.group = new THREE.Group(); this.group.position.copy(pos); G.scene.add(this.group);
    this.shown = {};
    for (const k of G.RES) {
      const g = new THREE.Group(); this.group.add(g); this.shown[k] = g;
      const n = k === 'iron' ? 4 : k === 'gold' ? 3 : 2;
      for (let i = 0; i < n; i++) { const m = G.resMesh(k); m.position.set(Math.cos(i * 2.4) * 0.35, 0.05 + i * 0.08, Math.sin(i * 2.4) * 0.35); m.rotation.y = i; m.visible = false; g.add(m); }
    }
    if (kind === 'diamond' || kind === 'emerald') {
      const big = G.resMesh(kind); big.scale.setScalar(2.2); big.position.y = 2.6; this.group.add(big); this.big = big;
      this.label = G.textSprite([{ text: '', color: G.RES_COLOR[kind] }, { text: '' }], { scale: 0.9 });
      this.label.position.y = 4.1; this.group.add(this.label);
      const l = new THREE.PointLight(kind === 'diamond' ? 0x4fe3e0 : 0x3be36b, 6, 6); l.position.y = 2.6; this.group.add(l);
    }
  }
  rates() {
    const out = {};
    if (this.team >= 0) {
      const f = G.game.teams[this.team].up.forge;
      out.iron = GEN.iron.every[0] / (1 + 0.5 * f); out.gold = GEN.gold.every[0] / (1 + 0.5 * f);
      if (f >= 3) out.emerald = 45 / (1 + 0.5 * (f - 3));
    } else out[this.kind] = GEN[this.kind].every[this.tier - 1];
    return out;
  }
  update(dt) {
    const r = this.rates();
    for (const k in r) {
      this.timer[k] -= dt;
      if (this.timer[k] <= 0) { this.timer[k] += r[k]; if (this.pile[k] < (this.team >= 0 && k === 'emerald' ? 2 : GEN[k].cap)) this.pile[k]++; }
    }
    // pick up: anyone standing on the generator takes everything
    for (const a of G.game.actors) {
      if (!a.alive) continue;
      if (G.dist2(a.pos.x, a.pos.z, this.pos.x, this.pos.z) < 1.4 * 1.4 && Math.abs(a.pos.y - this.pos.y) < 1.6) {
        for (const k of G.RES) if (this.pile[k]) {
          a.res[k] += this.pile[k];
          if (a.isPlayer) { G.audio.pickup(k); G.ui.dirty = true; G.ui.pickup(k, this.pile[k]); }
          this.pile[k] = 0;
        }
      }
    }
    const t = G.game.time;
    for (const k of G.RES) {
      const g = this.shown[k], n = this.pile[k];
      g.children.forEach((m, i) => { m.visible = n > i * (k === 'iron' ? 8 : 1); m.position.y = 0.08 + i * 0.08 + Math.sin(t * 2 + i) * 0.04; m.rotation.y += dt * 1.5; });
    }
    if (this.big) {
      this.big.rotation.y += dt * 1.6; this.big.position.y = 2.6 + Math.sin(t * 1.5) * 0.15;
      const left = Math.ceil(this.timer[this.kind]);
      const roman = ['I', 'II', 'III'][this.tier - 1];
      const key = left + ':' + this.tier;
      if (this.labelKey !== key) { this.labelKey = key; this.label.userData.set([{ text: (this.kind === 'diamond' ? 'Diamond ' : 'Emerald ') + roman, color: G.RES_COLOR[this.kind], size: 48 }, { text: 'Spawns in ' + left + 's', size: 38, color: '#ffe08a' }]); }
    }
  }
}
G.Gen = Gen;

/* ---------- projectiles ---------- */
const projs = [];
const tnts = [];
G.projectiles = projs; G.tnts = tnts;
function addProj(kind, owner, pos, vel, mesh, o = {}) {
  G.scene.add(mesh); mesh.position.copy(pos);
  projs.push(Object.assign({ kind, owner, pos: pos.clone(), vel, mesh, life: o.life || 6, grav: o.grav !== undefined ? o.grav : 18 }, o));
}
G.spawnArrow = (owner, pos, vel, power) => {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.7), new THREE.MeshLambertMaterial({ color: 0x8a6a3a })); g.add(shaft);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), new THREE.MeshLambertMaterial({ color: 0xdddddd })); tip.position.z = -0.38; g.add(tip);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.14), new THREE.MeshLambertMaterial({ color: 0xffffff })); fl.position.z = 0.3; g.add(fl);
  addProj('arrow', owner, pos, vel, g, { power, grav: 20, life: 8 });
};
G.spawnThrown = (kind, owner, pos, vel) => {
  const m = G.itemMesh(kind, owner.team);
  if (kind === 'fireball') { const l = new THREE.PointLight(0xff8a2a, 5, 7); m.add(l); }
  addProj(kind, owner, pos, vel, m, { grav: kind === 'fireball' ? 0 : kind === 'egg' ? 4 : 20, life: kind === 'egg' ? 1.6 : 6 });
};
G.spawnTNT = (owner, x, y, z) => {
  const m = G.model('tnt', 0, { fit: [0.98, 0.98, 0.98], lambert: true }) || G.blockMesh(10, 0.98);
  const g = new THREE.Group(); g.add(m); g.position.set(x + 0.5, y, z + 0.5); G.scene.add(g);
  const mats = []; m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); mats.push(o.material); } });
  tnts.push({ owner, x, y, z, g, mats, fuse: 3, snd: 0 });
};
// Explosion: damages and flings actors, breaks placed blocks that are not blast-proof.
G.explode = (pos, radius, maxDmg, owner) => {
  G.audio.explode(pos); fx.smoke(pos, 14);
  const r = Math.ceil(radius);
  for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y, z); if (d > radius) continue;
    const bx = Math.floor(pos.x) + x, by = Math.floor(pos.y) + y, bz = Math.floor(pos.z) + z;
    const id = wd.get(bx, by, bz);
    if (!id || !wd.isPlaced(bx, by, bz)) continue;
    const b = G.BLOCKS[id]; if (b.blast || b.bed) continue;
    // blast glass between the explosion and the block shields it
    if (d > radius * 0.75 && G.chance(0.5)) continue;
    if (shielded(pos, bx + 0.5, by + 0.5, bz + 0.5)) continue;
    wd.set(bx, by, bz, 0); if (G.chance(0.3)) fx.block(bx, by, bz, id);
  }
  for (const a of G.game.actors) {
    if (!a.alive) continue;
    const c = new V3(a.pos.x, a.pos.y + 0.9, a.pos.z), d = c.distanceTo(pos);
    if (d > radius * 1.6) continue;
    const f = 1 - d / (radius * 1.6);
    const dir = c.clone().sub(pos); dir.y = Math.max(dir.y, 0.4); dir.normalize();
    const self = a === owner;
    a.damage(maxDmg * f * (self ? 0.35 : 1), self ? null : owner, 'tnt', { x: dir.x * 16 * f, y: 7 + 6 * f, z: dir.z * 16 * f });
  }
};
function shielded(from, x, y, z) {
  const d = new V3(x, y, z).sub(from), len = d.length(); d.normalize();
  const h = wd.raycast(from, d, len - 0.6);
  return h && G.BLOCKS[h.id].blast;
}
G.updateProjectiles = (dt) => {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; p.life -= dt;
    if (p.stuck) { if (p.life <= 0) { G.scene.remove(p.mesh); projs.splice(i, 1); } continue; }
    p.vel.y -= p.grav * dt;
    const step = p.vel.clone().multiplyScalar(dt), len = step.length(), dir = step.clone().normalize();
    let done = false;
    // actors
    for (const a of G.game.actors) {
      if (!a.alive || a === p.owner || a.team === p.owner.team) continue;
      const t = G.rayActor(p.pos, dir, a, len);
      if (t >= 0) { hitActor(p, a); done = true; break; }
    }
    if (!done) {
      const h = wd.raycast(p.pos, dir, len);
      if (h) { p.pos.addScaledVector(dir, Math.max(0, h.dist - 0.05)); hitBlock(p, h); done = p.kind !== 'arrow' || true; }
    }
    if (p.kind === 'egg' && !p.dead) {
      // lay a bridge of the owner's wool just below the egg's path
      const bx = Math.floor(p.pos.x), by = Math.floor(p.pos.y) - 2, bz = Math.floor(p.pos.z);
      const key = bx + ',' + by + ',' + bz;
      if (key !== p.lastKey && by > 2 && G.canBuildAt(bx, by, bz) && !wd.get(bx, by, bz) && !G.game.actors.some(a => a.overlapsCell(bx, by, bz))) {
        wd.set(bx, by, bz, G.WOOL(p.owner.team), 1); p.lastKey = key; if (G.chance(0.4)) G.audio.place(p.pos);
      }
    }
    if (p.dead || (done && p.kind !== 'arrow') || p.life <= 0 || p.pos.y < G.VOID_Y) { G.scene.remove(p.mesh); projs.splice(i, 1); continue; }
    if (!p.stuck) {
      p.pos.add(step); p.mesh.position.copy(p.pos);
      if (p.kind === 'arrow') p.mesh.lookAt(p.pos.clone().sub(p.vel));
      else p.mesh.rotation.y += dt * 8;
      if (p.kind === 'fireball' && G.chance(dt * 30)) fx.burst(p.pos, 0xff9a2e, 1, { size: 0.15, speed: 0.5, grav: -1, life: 0.4 });
    }
  }
  for (let i = tnts.length - 1; i >= 0; i--) {
    const t = tnts[i]; t.fuse -= dt; t.snd -= dt;
    if (t.snd <= 0) { t.snd = 0.5; G.audio.fuse(t.g.position); }
    const flash = Math.floor(t.fuse * 6) % 2 === 0;
    t.mats.forEach(m => { if (m.emissive) m.emissive.setScalar(flash ? 0.6 : 0); });
    t.g.scale.setScalar(1 + (t.fuse < 0.6 ? (0.6 - t.fuse) * 0.25 : 0));
    if (t.fuse <= 0) { G.scene.remove(t.g); tnts.splice(i, 1); G.explode(new V3(t.x + 0.5, t.y + 0.5, t.z + 0.5), 3.6, 48, t.owner); }
  }
};
function hitActor(p, a) {
  if (p.kind === 'arrow') {
    const sp = p.vel.length(), dmg = 6 + 22 * p.power;
    const kb = p.vel.clone().setY(0).normalize().multiplyScalar(3.5);
    if (a.damage(dmg, p.owner, 'arrow', { x: kb.x, y: 3, z: kb.z })) { p.owner.lastLanded = G.game.time; if (p.owner.isPlayer) G.ui.hitmarker(!a.alive); G.audio.arrowHit(a.pos); fx.blood(a.pos); if (p.owner.isPlayer) G.audio.kill(); }
    p.dead = true; void sp;
  } else if (p.kind === 'fireball') { G.explode(p.pos.clone(), 2.6, 22, p.owner); p.dead = true; }
  else if (p.kind === 'pearl') { landPearl(p); }
  else if (p.kind === 'egg') p.dead = true;
}
function hitBlock(p, h) {
  if (p.kind === 'arrow') { p.stuck = true; p.life = 3; p.mesh.position.copy(p.pos); G.audio.arrowHit(p.pos); }
  else if (p.kind === 'fireball') { G.explode(p.pos.clone(), 2.6, 22, p.owner); p.dead = true; }
  else if (p.kind === 'pearl') { p.pos.add(new V3(h.nx, h.ny, h.nz).multiplyScalar(0.5)); landPearl(p); }
  else p.dead = true;
}
function landPearl(p) {
  p.dead = true;
  const o = p.owner; if (!o.alive) return;
  let y = Math.floor(p.pos.y);
  // find a spot where the owner fits
  for (let k = 0; k < 4 && o.collides(p.pos.x, y, p.pos.z); k++) y++;
  o.pos.set(p.pos.x, y, p.pos.z); o.vel.set(0, 0, 0); o.fallStart = null;
  G.audio.pearl(o.pos); fx.burst(new V3(o.pos.x, o.pos.y + 1, o.pos.z), 0x1f8f7a, 14, { speed: 2, grav: 0 });
  o.damage(5, null, 'fall');
}
G.clearProjectiles = () => { for (const p of projs) G.scene.remove(p.mesh); projs.length = 0; for (const t of tnts) G.scene.remove(t.g); tnts.length = 0; };

/* ---------- shopkeepers and beds ---------- */
// Shopkeepers are blocky characters like the players, in a merchant outfit: apron, hat and a
// counter in front of them, so they read as shops instead of floating NPCs.
G.makeKeeper = (pos, yaw, label, color, kind = 'item', team = 0) => {
  const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = yaw;
  const item = kind === 'item';
  const av = G.makeAvatar({ team, shirt: item ? 0xf3efe6 : 0x2c3e57, pants: 0x3a2c22, skin: item ? 0xe0a878 : 0xf5c99b, face: item ? 0 : 2 });
  av.drawTag('', 1, 1, false);
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.04), lam(item ? 0xc8862a : 0x2a9d8f));
  apron.position.set(0, 0.95, 0.2); av.body.add(apron);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), lam(item ? 0x5a3c1a : 0x1f2a3c));
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.44), lam(item ? 0x7a5126 : 0x2a9d8f));
  brim.position.y = 0.44; crown.position.y = 0.58; av.headG.add(brim, crown);
  av.armL.rotation.x = -0.5; av.armR.rotation.x = -0.5; // hands resting on the counter
  av.root.traverse(m => { if (m.isMesh) m.castShadow = true; });
  g.add(av.root);
  // counter: planks top on a dark base, with the shop's goods on it
  const top = G.blockMesh(4, 1); top.scale.set(1.5, 0.18, 0.6); top.position.set(0, 1.02, 0.62);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.92, 0.5), lam(0x4a3220)); base.position.set(0, 0.46, 0.62);
  for (const m of [top, base]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  const goods = item ? [G.itemMesh('sword_iron'), G.blockMesh(G.WOOL(team), 0.3)] : [G.resMesh('diamond'), G.resMesh('diamond')];
  goods.forEach((m, i) => { if (!m) return; m.position.set(i ? 0.42 : -0.38, 1.12, 0.62); if (item && !i) { m.scale.setScalar(0.55); m.rotation.set(Math.PI / 2, 0, 0.6); m.position.y = 1.14; } if (m.isMesh) m.position.y = 1.26; g.add(m); });
  const tag = G.textSprite([{ text: label, color, size: 52, font: '400', family: '"Lilita One", sans-serif' }, { text: 'E  ·  RIGHT CLICK', size: 28, color: '#f4efe4', font: '800' }], { scale: 0.8 });
  tag.position.y = 2.65; g.add(tag);
  g.userData.av = av;
  G.scene.add(g);
  return g;
};
G.makeBedModel = (team, a, b) => {
  const t = G.TEAMS[team];
  const dx = b.x - a.x, dz = b.z - a.z;
  // tint by part: the frame becomes dark wood, the blanket takes the team colour, sheet and pillow stay white
  const PART = { lambert3: 0x6b4426, lambert4: 0xf3f0ea, lambert5: t.color, lambert6: 0xffffff };
  const m = G.model('bed', 0, { fit: [0.98, 0.62, 1.96], tint: (mesh, mat) => { const k = Object.keys(PART).find(n => mat.name.endsWith(n)); return k ? PART[k] : null; } });
  const g = new THREE.Group();
  g.position.set((a.x + b.x) / 2 + 0.5, a.y, (a.z + b.z) / 2 + 0.5);
  if (m) { g.add(m); g.rotation.y = Math.atan2(dx, dz); }
  else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 2), new THREE.MeshLambertMaterial({ color: 0x7a4b2a })); base.position.y = 0.15; g.add(base);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.26, 1.5), new THREE.MeshLambertMaterial({ color: t.color })); sheet.position.set(0, 0.42, -0.24); g.add(sheet);
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.4), new THREE.MeshLambertMaterial({ color: 0xffffff })); pil.position.set(0, 0.4, 0.75); g.add(pil);
    g.rotation.y = Math.atan2(dx, dz);
  }
  G.scene.add(g);
  return g;
};
})();
