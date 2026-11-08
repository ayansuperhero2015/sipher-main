// Main: renderer, sky, the match itself, player controls, camera and view model.
(() => {
'use strict';
const V3 = G.V3, wd = G.world, S = G.SURF;
const $ = id => document.getElementById(id);

/* ---------- renderer & scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
$('game').appendChild(renderer.domElement);
const scene = G.scene = new THREE.Scene();
const SKY_TOP = new THREE.Color(0x4f9be8), SKY_BOT = new THREE.Color(0xbfe3ff);
scene.fog = new THREE.Fog(0xbfe3ff, 70, 190);
const camera = G.camera = new THREE.PerspectiveCamera(G.settings.fov, window.innerWidth / window.innerHeight, 0.05, 400);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xdff0ff, 0x6a5a40, 1.15));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6); sun.position.set(40, 80, 25); scene.add(sun);
// gradient sky dome
{
  const g = new THREE.SphereGeometry(300, 24, 16), cols = [];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = G.clamp(p.getY(i) / 300 * 1.6 + 0.35, 0, 1); const c = SKY_BOT.clone().lerp(SKY_TOP, t); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; camera.add(sky); sky.position.set(0, 0, 0);
  // sun disc
  const sd = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false, transparent: true, opacity: 0.95 }));
  sd.position.copy(sun.position).normalize().multiplyScalar(280); sd.lookAt(0, 0, 0); camera.add(sd);
}
// blocky clouds
const clouds = new THREE.Group(); scene.add(clouds);
{
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, emissive: 0x666666 });
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Group();
    const n = G.randi(2, 5);
    for (let k = 0; k < n; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(G.rand(6, 14), 2, G.rand(5, 10)), mat); b.position.set(G.rand(-6, 6), 0, G.rand(-4, 4)); c.add(b); }
    c.position.set(G.rand(-150, 280), G.rand(62, 72), G.rand(-150, 280)); clouds.add(c);
  }
}
wd.initMeshing(scene);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = vmCam.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
});

/* ---------- view model (held item drawn in its own pass so it never clips into walls) ---------- */
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
vmScene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a60, 1.4));
const vmSun = new THREE.DirectionalLight(0xffffff, 1.2); vmSun.position.set(1, 2, 1); vmScene.add(vmSun);
const vm = new THREE.Group(); vmScene.add(vm);
const vmArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.55), new THREE.MeshLambertMaterial({ color: 0xf5c99b }));
const vmSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.25), new THREE.MeshLambertMaterial({ color: 0xffffff }));
vmArm.add(vmSleeve); vmSleeve.position.z = 0.16;
const vmItem = new THREE.Group();
vm.add(vmArm, vmItem);
let vmHeld = undefined, vmSwing = 0, vmBob = 0, vmEquip = 0;
function setVM(id, team) {
  vmHeld = id; vmItem.clear(); vmEquip = 1;
  vmSleeve.material.color.setHex(G.TEAMS[team].color);
  if (!id) { vmArm.position.set(0.42, -0.42, -0.55); vmArm.rotation.set(0.25, 0.15, 0); vmArm.visible = true; return; }
  vmArm.visible = false;
  const m = G.itemMesh(id, team); if (!m) return;
  const k = G.ITEMS[id].kind;
  vmItem.add(m);
  if (k === 'sword' || k === 'pick' || k === 'axe') { m.scale.setScalar(0.62); m.rotation.set(-0.35, Math.PI / 2 + 0.5, 0.15); m.position.set(0, -0.22, 0); vmItem.position.set(0.5, -0.36, -0.78); vmItem.rotation.set(0, 0, 0); }
  else if (k === 'block' || id === 'tower') { m.scale.setScalar(0.42); vmItem.position.set(0.48, -0.42, -0.85); vmItem.rotation.set(0.1, 0.7, 0); }
  else if (id === 'bow') { m.scale.setScalar(0.55); m.rotation.set(0, Math.PI / 2, 0.15); m.position.y = -0.2; vmItem.position.set(0.36, -0.3, -0.8); vmItem.rotation.set(0, -0.1, 0); }
  else { m.scale.setScalar(1.6); vmItem.position.set(0.42, -0.48, -0.75); vmItem.rotation.set(0, 0.5, 0); }
  vmItem.userData.base = vmItem.position.clone();
}
function updateVM(dt, p) {
  const held = p.held(), id = held ? held.id : null;
  if (id !== vmHeld) setVM(id, p.team);
  vmSwing = Math.max(0, vmSwing - dt * 4.5);
  vmEquip = Math.max(0, vmEquip - dt * 5);
  const sp = Math.hypot(p.vel.x, p.vel.z);
  if (p.onGround) vmBob += dt * sp * 1.9;
  const bx = Math.cos(vmBob) * 0.018 * Math.min(1, sp / 4), by = -Math.abs(Math.sin(vmBob)) * 0.025 * Math.min(1, sp / 4);
  const sw = Math.sin((1 - vmSwing) * Math.PI) * (vmSwing > 0 ? 1 : 0);
  vm.position.set(bx, by - vmEquip * 0.35, 0);
  vm.rotation.set(-sw * 0.9, sw * 0.35, -sw * 0.2);
  if (id === 'bow' && p.bowDraw > 0) { vm.position.z = Math.min(1, p.bowDraw) * 0.12; vm.position.x = -Math.min(1, p.bowDraw) * 0.08; }
  vm.visible = !thirdPerson && p.alive;
}

/* ---------- block highlight & cracks ---------- */
const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
hl.visible = false; scene.add(hl);
const crackGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
const crack = new THREE.Mesh(crackGeo, new THREE.MeshBasicMaterial({ map: G.atlas.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
crack.visible = false; scene.add(crack);
let crackStage = -1;
function setCrack(stage) {
  if (stage === crackStage) return; crackStage = stage;
  const [u0, v0, u1, v1] = G.atlas.uv('crack' + stage), uv = crackGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  uv.needsUpdate = true;
}

/* ---------- the match ---------- */
const game = G.game = {
  state: 'menu', time: 0, actors: [], bots: [], gens: [], teams: [], map: null, player: null, keepers: [], bedModels: [], decor: [],
  evIdx: 0, opts: null, modeName: '', sudden: false,
  nextEvent() { return G.EVENTS[this.evIdx] || null; },
  start(opts) {
    this.cleanup();
    this.opts = opts; this.time = 0; this.evIdx = 0; this.sudden = false; this.endAt = 0; this.towers = [];
    this.modeName = { solo: 'Solos', duo: 'Duos', squad: 'Squads' }[opts.mode];
    this.map = G.buildMap();
    wd.buildAll();
    this.teams = G.TEAMS.map(t => ({ id: t.id, bedAlive: true, eliminated: false, up: { sharp: 0, prot: 0, forge: 0, haste: 0, heal: 0, trap: 0 } }));
    // beds, shopkeepers, generators
    for (const m of this.map.teams) {
      this.bedModels[m.team] = G.makeBedModel(m.team, m.bed[0], m.bed[1]);
      this.keepers.push(G.makeKeeper(m.shop.pos, m.shop.yaw, 'ITEM SHOP', '#ffe27a'));
      this.keepers.push(G.makeKeeper(m.upg.pos, m.upg.yaw, 'TEAM UPGRADES', '#7af0ff'));
      m.shop.team = m.upg.team = m.team;
      this.gens.push(new G.Gen('team', m.gen, m.team));
    }
    for (const p of this.map.diamond) this.gens.push(new G.Gen('diamond', p));
    for (const p of this.map.emerald) this.gens.push(new G.Gen('emerald', p));
    // scenery islands with Sketchfab trees
    for (const d of this.map.decor) {
      const g = new THREE.Group(); g.position.set(d.x, d.y, d.z);
      const top = new THREE.Mesh(new THREE.BoxGeometry(d.s * 2, 1, d.s * 2), new THREE.MeshLambertMaterial({ color: 0x56b83a })); g.add(top);
      for (let k = 1; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(d.s * 2 * (1 - k * 0.22), 2, d.s * 2 * (1 - k * 0.22)), new THREE.MeshLambertMaterial({ color: k === 1 ? 0x8a5a35 : 0x8c8f94 })); b.position.y = -0.5 - k * 2 + 1; g.add(b); }
      const tr = G.model('tree', d.s * 1.3); if (tr) { tr.position.y = 0.5; g.add(tr); }
      scene.add(g); this.decor.push(g);
    }
    // actors
    const per = { solo: 1, duo: 2, squad: 4 }[opts.mode];
    const names = [...G.BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let t = 0; t < 4; t++) for (let k = 0; k < per; k++) {
      const isP = t === opts.team && k === 0;
      const a = new G.Actor({ name: isP ? 'You' : names.pop(), team: t, isPlayer: isP });
      this.actors.push(a);
      if (isP) this.player = a;
      else { const role = per === 1 ? (G.chance(0.5) ? 'rush' : 'defend') : k % 2 === 1 ? 'defend' : 'rush'; this.bots.push(new G.Bot(a, opts.diff, role)); }
      this.spawn(a);
    }
    G.buildIcons(this.player.team);
    this.state = 'play';
    thirdPerson = false; spectate = null;
    $('hud').classList.remove('hidden');
    G.ui.dirty = true; G.ui.render();
    G.ui.announce('BED RAID', `Protect your bed and destroy the enemy beds!`, G.TEAMS[this.player.team].css, 4500);
    G.audio.event();
    G.lockPointer();
  },
  cleanup() {
    for (const a of this.actors) { scene.remove(a.avatar.root); a.avatar.dispose(); }
    for (const gn of this.gens) scene.remove(gn.group);
    for (const k of this.keepers) scene.remove(k);
    for (const b of this.bedModels) if (b) scene.remove(b);
    for (const d of this.decor) scene.remove(d);
    this.actors = []; this.bots = []; this.gens = []; this.keepers = []; this.bedModels = []; this.decor = [];
    G.clearProjectiles(); G.fx.clear();
    this.player = null;
  },
  quit() { this.cleanup(); this.state = 'menu'; $('hud').classList.add('hidden'); G.ui.respawn(null); document.exitPointerLock && document.exitPointerLock(); G.ui.menu(); },
  spawn(a) {
    const m = this.map.teams[a.team];
    a.alive = true; a.hp = a.maxHp; a.lastHit = null; a.fallStart = null; a.breaking = null; a.bowDraw = 0;
    a.effects = { speed: 0, heal: 0, slow: 0 };
    a.pos.copy(m.spawn).add(new V3(G.rand(-0.8, 0.8), 0, G.rand(-0.5, 0.5)));
    a.vel.set(0, 0, 0); a.yaw = m.spawnYaw; a.pitch = 0;
    a.giveStarter();
    a.avatar.root.visible = !a.isPlayer || thirdPerson;
    a.tagDirty = true;
    if (a.bot) a.bot.onRespawn();
  },
  respawnAfterDeath(a) {
    // tools drop one tier; armour and shears stay
    a.pickTier = Math.max(a.pickTier ? 1 : 0, a.pickTier - 1);
    a.axeTier = Math.max(a.axeTier ? 1 : 0, a.axeTier - 1);
    this.spawn(a);
    if (a.isPlayer) { G.ui.respawn(null); G.ui.dirty = true; spectate = null; }
  },
  onDeath(v, killer, kind) {
    const final = !this.teams[v.team].bedAlive;
    const how = { void: killer ? 'was knocked into the void by' : 'fell into the void', fall: killer ? 'was knocked off a ledge by' : 'fell to their death', melee: 'was slain by', arrow: 'was shot by', tnt: 'was blown up by' }[kind] || 'was killed by';
    G.ui.feed(`${G.ui.name(v)} ${v.isPlayer ? how.replace(/^was /, 'were ').replace(/their/, 'your') : how}${killer ? ' ' + G.ui.name(killer) : ''}${final ? ' <span class="final">FINAL KILL!</span>' : ''}`);
    G.fx.burst(new V3(v.pos.x, v.pos.y + 1, v.pos.z), G.TEAMS[v.team].color, 16, { size: 0.15 });
    v.avatar.root.visible = false;
    if (killer) {
      killer.stats.kills++; if (final) killer.stats.finals++;
      for (const k of G.RES) killer.res[k] += v.res[k];
      if (killer.isPlayer) {
        G.audio.kill(); G.ui.dirty = true;
        const got = G.RES.filter(k => v.res[k]).map(k => `<span style="color:${G.RES_COLOR[k]}">+${v.res[k]} ${k}</span>`).join(' ');
        if (got) G.ui.toast(got);
      }
    }
    for (const k of G.RES) v.res[k] = 0;
    v.slots.fill(null);
    if (v.isPlayer) { G.audio.death(); G.ui.dirty = true; spectate = { pos: camera.position.clone(), yaw: v.yaw, pitch: Math.max(v.pitch, -0.5) }; }
    if (final) {
      v.eliminated = true;
      if (v.isPlayer) G.ui.respawn(0, true);
      this.checkTeams();
    } else {
      v.respawnAt = this.time + (v.isPlayer ? 5 : 5);
    }
  },
  checkTeams() {
    for (const tm of this.teams) {
      if (tm.eliminated) continue;
      const left = this.actors.some(a => a.team === tm.id && !a.eliminated);
      if (!left) {
        tm.eliminated = true;
        G.ui.feed(`<b style="color:${G.TEAMS[tm.id].css}">TEAM ${G.TEAMS[tm.id].name.toUpperCase()}</b> has been eliminated!`);
      }
    }
    const alive = this.teams.filter(t => !t.eliminated);
    if (alive.length <= 1) this.endMatch(alive.length ? alive[0].id : null);
  },
  endMatch(team) {
    if (this.state !== 'play') return;
    this.state = 'end';
    const win = team === this.player.team;
    G.ui.announce(win ? 'VICTORY!' : team === null ? 'DRAW' : 'GAME OVER', team !== null ? `${G.TEAMS[team].name} team wins` : '', win ? '#ffe27a' : '#ff6b5e', 4000);
    win ? G.audio.win() : G.audio.lose();
    setTimeout(() => { document.exitPointerLock && document.exitPointerLock(); G.ui.end(win, team); }, 3500);
  },
  breakBlock(x, y, z, actor) {
    const id = wd.get(x, y, z);
    if (G.BLOCKS[id].bed) return this.breakBed(wd.bedTeamAt(x, y, z), actor);
    wd.set(x, y, z, 0);
    G.fx.block(x, y, z, id); G.audio.breakBlock(new V3(x + 0.5, y + 0.5, z + 0.5));
  },
  breakBed(team, actor) {
    const tm = this.teams[team]; if (!tm || !tm.bedAlive) return;
    tm.bedAlive = false;
    for (const b of this.map.teams[team].bed) { wd.set(b.x, b.y, b.z, 0); G.fx.burst(new V3(b.x + 0.5, b.y + 0.4, b.z + 0.5), G.TEAMS[team].color, 18, { size: 0.16 }); }
    if (this.bedModels[team]) { scene.remove(this.bedModels[team]); this.bedModels[team] = null; }
    const mine = team === this.player.team;
    G.audio.bedBroken(mine);
    if (actor) actor.stats.beds++;
    G.ui.feed(`<span class="bedmsg">BED DESTRUCTION</span> <b style="color:${G.TEAMS[team].css}">${G.TEAMS[team].name} Bed</b> ${actor ? 'was broken by ' + G.ui.name(actor) : 'was destroyed'}`);
    if (mine) G.ui.announce('BED DESTROYED!', 'You will no longer respawn!', '#ff5a4a', 3500);
    else if (actor && actor.isPlayer) G.ui.announce('BED DESTROYED!', `You broke the ${G.TEAMS[team].name} bed!`, G.TEAMS[team].css, 2500);
    // a team with nobody waiting to respawn and no bed is out
    for (const a of this.actors) if (a.team === team && !a.alive && !a.eliminated) { a.eliminated = true; if (a.isPlayer) G.ui.respawn(0, true); }
    this.checkTeams();
  },
  destroyAllBeds() { for (const tm of this.teams) if (tm.bedAlive) this.breakBed(tm.id, null); },
  suddenDeath() {
    this.sudden = true;
    for (const g of this.gens) g.tier = 3;
    G.ui.announce('SUDDEN DEATH', 'Natural regeneration is off. Finish it!', '#ff5a4a', 4000);
  },
  /* ---------- shopping ---------- */
  buy(a, e) {
    if (!e) return false;
    let cost = e.cost;
    if (e.tool) {
      const tier = (e.tool === 'pick' ? a.pickTier : a.axeTier) + 1;
      if (tier > 4) return false;
      cost = G.TOOL_COST[tier];
      if (!G.ui.canAfford(a, cost)) return false;
      pay(a, cost);
      if (e.tool === 'pick') a.pickTier = tier; else a.axeTier = tier;
      a.replaceKind(e.tool, e.tool + tier);
      return true;
    }
    if (!G.ui.canAfford(a, cost)) return false;
    if (e.armor) {
      const order = ['leather', 'chain', 'iron', 'diamond'];
      if (order.indexOf(a.armor) >= order.indexOf(e.armor)) return false;
      pay(a, cost); a.armor = e.armor; G.ui.dirty = a.isPlayer || G.ui.dirty; return true;
    }
    const d = G.ITEMS[e.id];
    if (d.kind === 'sword') {
      const b = a.bestSword(); if (b && G.ITEMS[b.id].dmg >= d.dmg) return false;
      pay(a, cost);
      // the new sword replaces the old one in the same slot
      const i = a.slots.findIndex(s => s && G.ITEMS[s.id].kind === 'sword');
      if (i >= 0) a.slots[i] = { id: e.id, count: 1 }; else a.add(e.id, 1);
      a.invChanged(); return true;
    }
    if (e.id === 'shears') { if (a.shears) return false; pay(a, cost); a.shears = true; a.add('shears', 1); return true; }
    if (!a.add(e.id, e.n)) { if (a.isPlayer) G.ui.toast('Your hotbar is full!', '#ff6b5e'); return false; }
    pay(a, cost);
    return true;
  },
  buyUpgrade(a, id) {
    const u = G.UPGRADES.find(x => x.id === id), tm = this.teams[a.team];
    const lvl = tm.up[id]; if (lvl >= u.max) return false;
    const c = u.cost[lvl]; if (a.res.diamond < c) return false;
    a.res.diamond -= c; tm.up[id]++; if (id === 'trap') tm.trapArmed = true;
    if (a.isPlayer) G.ui.dirty = true;
    if (a.team === this.player.team) G.ui.feed(`${G.ui.name(a)} bought <b style="color:#7af0ff">${u.name}${u.max > 1 ? ' ' + ['I', 'II', 'III', 'IV'][lvl] : ''}</b>`);
    return true;
  },
  /* ---------- items ---------- */
  useItem(a, id) {
    if (a.useCd > 0 || !a.count(id)) return false;
    a.useCd = 0.5;
    if (id === 'gapple') { a.remove(id, 1); a.effects.heal = this.time + 4; a.heal(10); G.audio.eat(); return true; }
    if (id === 'speed') { a.remove(id, 1); a.effects.speed = this.time + 30; G.audio.eat(); return true; }
    if (id === 'tower') return this.buildTower(a);
    if (id === 'fireball' || id === 'pearl' || id === 'egg') {
      a.remove(id, 1);
      const d = a.lookDir(), e = a.eye.add(d.clone().multiplyScalar(0.6));
      const sp = id === 'fireball' ? 20 : id === 'egg' ? 17 : 26;
      if (id === 'egg') { d.y = Math.max(-0.05, Math.min(d.y, 0.08)); d.normalize(); }
      G.spawnThrown(id, a, e, d.multiplyScalar(sp));
      a.avatar.swing = 1; G.audio.swing();
      return true;
    }
    return false;
  },
  buildTower(a) {
    a.remove('tower', 1);
    const bx = Math.floor(a.pos.x), by = Math.floor(a.pos.y), bz = Math.floor(a.pos.z);
    a.pos.x = bx + 0.5; a.pos.z = bz + 0.5; a.vel.x = a.vel.z = 0;
    this.towers.push({ team: a.team, a, bx, by, bz, step: 0, t: 0 });
    return true;
  },
  // pop-up towers grow one ring every 0.12 s (a door is left open at the bottom, facing you)
  updateTowers(dt) {
    const ring = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (let i = this.towers.length - 1; i >= 0; i--) {
      const tw = this.towers[i]; tw.t -= dt;
      if (tw.t > 0) continue;
      tw.t = 0.12;
      const wool = G.WOOL(tw.team), { bx, by, bz, step } = tw;
      for (const [dx, dz] of ring) { const x = bx + dx, y = by + step, z = bz + dz; if (!wd.get(x, y, z) && G.canBuildAt(x, y, z)) wd.set(x, y, z, wool, 1); }
      // lift the owner up the middle as it grows, like pillaring
      const a = tw.a;
      if (a && a.alive && step >= 1 && step <= 4 && Math.floor(a.pos.x) === bx && Math.floor(a.pos.z) === bz && !a.collides(a.pos.x, by + step, a.pos.z)) {
        if (!wd.get(bx, by + step - 1, bz)) { a.pos.y = by + step; a.vel.y = 0; a.fallStart = null; wd.set(bx, by + step - 1, bz, wool, 1); }
      }
      G.audio.place(new V3(bx, by + step, bz));
      if (++tw.step > 4) this.towers.splice(i, 1);
    }
  },
  fireBow(a, power) {
    if (!a.count('arrow')) { if (a.isPlayer) G.ui.toast('No arrows!', '#ff6b5e'); return; }
    a.remove('arrow', 1);
    const d = a.lookDir(), e = a.eye.add(d.clone().multiplyScalar(0.5));
    G.spawnArrow(a, e, d.multiplyScalar(14 + 30 * power), power);
    G.audio.bow(a.pos);
  },
  update(dt) {
    if (this.state !== 'play' && this.state !== 'end') return;
    if (this.state === 'play') {
      this.time += dt;
      const ev = this.nextEvent();
      if (ev && this.time >= ev.t) {
        this.evIdx++; ev.fn(this);
        if (ev.name !== 'Game End') { G.ui.announce(ev.name.toUpperCase(), ev.name.startsWith('Diamond') || ev.name.startsWith('Emerald') ? 'Generators have been upgraded!' : '', '#ffe27a', 3000); G.audio.event(); }
      }
    }
    for (const a of this.actors) {
      if (!a.alive && !a.eliminated && this.state === 'play') {
        if (a.isPlayer) G.ui.respawn(a.respawnAt - this.time, false);
        if (this.time >= a.respawnAt) this.respawnAfterDeath(a);
      }
      if (this.sudden && a.alive) a.lastHit = a.lastHit || { by: null, t: this.time };
      a.update(dt);
    }
    for (const b of this.bots) b.update(dt);
    // players push each other apart a little so nobody stands inside anybody else
    const A = this.actors;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i], b = A[j];
      if (!a.alive || !b.alive || Math.abs(a.pos.y - b.pos.y) > 1.6) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.62 || d < 1e-4) continue;
      const push = (0.62 - d) * 0.5 * Math.min(1, dt * 10), nx = dx / d * push, nz = dz / d * push;
      if (!a.collides(a.pos.x - nx, a.pos.y, a.pos.z - nz) && (a.onGround ? a.supported(a.pos.x - nx, a.pos.z - nz) : true)) { a.pos.x -= nx; a.pos.z -= nz; }
      if (!b.collides(b.pos.x + nx, b.pos.y, b.pos.z + nz) && (b.onGround ? b.supported(b.pos.x + nx, b.pos.z + nz) : true)) { b.pos.x += nx; b.pos.z += nz; }
    }
    for (const gn of this.gens) gn.update(dt);
    // bed alarm trap
    for (const tm of this.teams) {
      if (!tm.trapArmed || !tm.bedAlive) continue;
      const bed = this.map.teams[tm.id].bed[0];
      const intr = this.actors.find(a => a.alive && a.team !== tm.id && G.dist2(a.pos.x, a.pos.z, bed.x + 0.5, bed.z + 0.5) < 7 * 7 && Math.abs(a.pos.y - bed.y) < 5);
      if (intr) {
        tm.trapArmed = false; tm.up.trap = 0;
        intr.effects.slow = this.time + 8;
        if (tm.id === this.player.team) { G.ui.announce('ALARM!', `${G.TEAMS[intr.team].name} player at your bed!`, '#ff5a4a', 2500); G.audio.alarm(); }
        if (intr.isPlayer) G.ui.toast('You set off a bed alarm!', '#ff6b5e');
        for (const b of this.bots) if (b.a.team === tm.id && b.a.alive) b.onHurt(intr);
      }
    }
    G.updateProjectiles(dt);
    this.updateTowers(dt);
    for (const a of this.actors) if (a.alive) a.syncAvatar(dt);
  }
};
function pay(a, c) { for (const k in c) a.res[k] -= c[k]; if (a.isPlayer) G.ui.dirty = true; }
// sudden death: no natural regen (lastHit trick above keeps regen paused)

/* ---------- input ---------- */
let locked = false, thirdPerson = false, spectate = null;
G.debugLock = (v = true) => { locked = v; }; // for automated testing only
G.lockPointer = () => { const c = renderer.domElement; if (c.requestPointerLock) { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } };
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked && game.state === 'play' && !G.ui.shopOpen()) G.ui.pause(true);
  if (locked) { G.ui.pause(false); $('clicklock').classList.add('hidden'); }
});
renderer.domElement.addEventListener('click', () => { if (game.state === 'play' && !locked && !G.ui.shopOpen()) G.lockPointer(); });
$('clicklock').addEventListener('click', () => G.lockPointer());
document.addEventListener('mousemove', e => {
  if (!locked) return;
  const k = 0.0022 * G.settings.sens;
  if (spectate) { spectate.yaw -= e.movementX * k; spectate.pitch = G.clamp(spectate.pitch - e.movementY * k, -1.55, 1.55); return; }
  const p = game.player; if (!p || !p.alive) return;
  p.yaw -= e.movementX * k; p.pitch = G.clamp(p.pitch - e.movementY * k, -1.55, 1.55);
});
document.addEventListener('mousedown', e => {
  if (!locked) return;
  if (e.button === 0) { G.mouse.l = true; G.mouse.lPressed = true; }
  if (e.button === 2) { G.mouse.r = true; G.mouse.rPressed = true; }
});
document.addEventListener('mouseup', e => { if (e.button === 0) G.mouse.l = false; if (e.button === 2) { G.mouse.r = false; G.mouse.rReleased = true; } });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('wheel', e => {
  const p = game.player; if (!locked || !p) return;
  p.sel = (p.sel + (e.deltaY > 0 ? 1 : 8)) % 9; p.bowDraw = 0; G.ui.dirty = true;
}, { passive: true });
document.addEventListener('keydown', e => {
  if (e.code === 'Tab' || e.code === 'F5' || (e.ctrlKey && /Key[WSDA]/.test(e.code))) e.preventDefault();
  G.keys[e.code] = true;
  const p = game.player;
  if (game.state !== 'play' || !p) return;
  if (e.code === 'KeyE' || (e.code === 'Escape' && G.ui.shopOpen())) {
    if (G.ui.shopOpen()) { G.ui.closeShop(); return; }
    const k = nearShop(p); if (k && p.alive) G.ui.openShop(k);
    return;
  }
  if (G.ui.shopOpen()) return;
  if (/^Digit[1-9]$/.test(e.code)) { p.sel = +e.code.slice(5) - 1; p.bowDraw = 0; G.ui.dirty = true; }
  if (e.code === 'F5') { thirdPerson = !thirdPerson; p.avatar.root.visible = thirdPerson && p.alive; }
});
document.addEventListener('keyup', e => { G.keys[e.code] = false; });
window.addEventListener('blur', () => { G.keys = {}; G.mouse.l = G.mouse.r = false; });

function nearShop(p) {
  const m = game.map.teams[p.team];
  if (p.pos.distanceTo(m.shop.pos) < 3.6) return 'item';
  if (p.pos.distanceTo(m.upg.pos) < 3.6) return 'upgrade';
  // you may use any team's shop you can reach
  for (const t of game.map.teams) { if (p.pos.distanceTo(t.shop.pos) < 3.2) return 'item'; }
  return null;
}
// what the player's crosshair points at
function aim(p) {
  const o = p.eye, d = p.lookDir();
  const blk = wd.raycast(o, d, 5);
  let act = null, ad = 3.4;
  for (const a of game.actors) {
    if (a === p || !a.alive) continue;
    const t = G.rayActor(o, d, a, 3.4);
    if (t >= 0 && t < ad) { ad = t; act = a; }
  }
  if (act && blk && blk.dist < ad) act = null;
  let keeper = null;
  const m = game.map.teams[p.team];
  for (const s of [{ k: 'item', p: m.shop.pos }, { k: 'upgrade', p: m.upg.pos }]) {
    const c = s.p.clone().add(new V3(0, 1, 0)), toC = c.clone().sub(o), along = toC.dot(d);
    if (along > 0 && along < 4.2 && toC.addScaledVector(d, -along).length() < 0.7) keeper = s.k;
  }
  return { blk, act, keeper, o, d };
}

let placeCd = 0, stepT = 0;
function playerControl(dt) {
  const p = game.player, K = G.keys;
  const active = locked && p.alive && !G.ui.shopOpen() && game.state === 'play';
  let wx = 0, wz = 0;
  if (active) {
    const f = (K.KeyW ? 1 : 0) - (K.KeyS ? 1 : 0), r = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0);
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    wx = -sy * f + cy * r; wz = -cy * f - sy * r;
    const l = Math.hypot(wx, wz); if (l > 0) { wx /= l; wz /= l; }
    p.sneak = !!(K.ShiftLeft || K.ShiftRight);
    if ((K.ControlLeft || K.ControlRight) && f > 0) p.sprint = true;
    if (f <= 0 || p.sneak) p.sprint = false;
  } else { p.sprint = false; }
  if (p.alive) {
    p.physics(dt, wx, wz, active && K.Space);
    if (p.onGround && Math.hypot(p.vel.x, p.vel.z) > 1) { stepT -= dt * Math.hypot(p.vel.x, p.vel.z); if (stepT <= 0) { stepT = 2.2; G.audio.step(); } }
  }
  if (!active) { hl.visible = false; crack.visible = false; G.ui.breakRing(0); G.mouse.lPressed = G.mouse.rPressed = false; G.mouse.rReleased = false; if (!G.mouse.r) p.bowDraw = 0; return; }
  const A = aim(p), held = p.held(), hd = held ? G.ITEMS[held.id] : null;
  placeCd -= dt;
  // highlight
  if (A.blk && !A.act) { hl.visible = true; hl.position.set(A.blk.x + 0.5, A.blk.y + 0.5, A.blk.z + 0.5); if (G.BLOCKS[A.blk.id].bed) { hl.scale.set(1, 0.58, 1); hl.position.y = A.blk.y + 0.29; } else hl.scale.set(1, 1, 1); }
  else hl.visible = false;
  // left: attack or dig
  if (G.mouse.l) {
    if (A.act && (G.mouse.lPressed || p.atkCd <= 0)) {
      if (p.attack(A.act)) vmSwing = 1; else if (G.mouse.lPressed) { vmSwing = 1; G.audio.swing(); }
      p.breaking = null;
    } else if (A.blk && !A.act) {
      const f = p.dig(dt, A.blk.x, A.blk.y, A.blk.z);
      if (f > 0 && f < 1) { vmSwing = Math.max(vmSwing, 0.6); crack.visible = true; crack.position.copy(hl.position); crack.scale.copy(hl.scale); setCrack(Math.min(5, Math.floor(f * 6))); }
      else crack.visible = false;
      G.ui.breakRing(f > 0 && f < 1 ? f : 0);
      if (G.mouse.lPressed && !p.canBreak(A.blk.x, A.blk.y, A.blk.z)) { vmSwing = 1; G.audio.swing(); }
    } else if (G.mouse.lPressed) { vmSwing = 1; G.audio.swing(); }
  } else { p.breaking = null; crack.visible = false; G.ui.breakRing(0); }
  // right: shop, place, use, bow
  if (G.mouse.rPressed && A.keeper) { G.ui.openShop(A.keeper); G.mouse.rPressed = false; G.mouse.r = false; return; }
  if (hd && hd.kind === 'bow') {
    if (G.mouse.r && p.count('arrow')) { p.bowDraw += dt; G.ui.bowCharge(p.bowDraw); }
    if (G.mouse.rReleased && p.bowDraw > 0.12) { game.fireBow(p, Math.min(1, p.bowDraw)); p.bowDraw = 0; }
    if (!G.mouse.r) { p.bowDraw = 0; G.ui.bowCharge(0); }
    if (G.mouse.rPressed && !p.count('arrow')) G.ui.toast('No arrows!', '#ff6b5e');
  } else { p.bowDraw = 0; G.ui.bowCharge(0); }
  if (hd && hd.kind === 'block' && G.mouse.r && placeCd <= 0) {
    let done = false, x, y, z;
    if (A.blk) { x = A.blk.x + A.blk.nx; y = A.blk.y + A.blk.ny; z = A.blk.z + A.blk.nz; }
    // looking steeply down while standing: bridge forward instead of walling yourself in
    const bridging = p.pitch < -0.55 && p.onGround && (!A.blk || y >= Math.floor(p.pos.y + 0.01));
    if (A.blk && !bridging) done = p.placeBlock(x, y, z);
    // bridge assist: looking down past an edge places the next block in front of your feet
    if (!done && p.pitch < -0.55) {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), fy = Math.floor(p.pos.y + 0.01) - 1;
      for (const k of [0.55, 0.95, 1.35]) {
        const bx = Math.floor(p.pos.x + fx * k), bz = Math.floor(p.pos.z + fz * k);
        if (!wd.get(bx, fy, bz)) { done = p.placeBlock(bx, fy, bz); if (!done && Math.abs(fx) > 0.3 && Math.abs(fz) > 0.3) done = p.placeBlock(bx, fy, Math.floor(p.pos.z)) || p.placeBlock(Math.floor(p.pos.x), fy, bz); break; }
      }
    }
    // nothing to bridge onto but looking at a block: fall back to normal placement (e.g. walls below you)
    if (!done && bridging && A.blk && y < Math.floor(p.pos.y + 0.01)) done = p.placeBlock(x, y, z);
    if (done) { placeCd = G.mouse.rPressed ? 0.1 : 0.15; vmSwing = 0.8; }
    else if (G.mouse.rPressed && A.blk) { placeCd = 0.1; if (!G.canBuildAt(x, y, z)) G.ui.toast(y >= G.BUILD_MAX ? 'Build height limit!' : "You can't build here!", '#ff6b5e'); }
  }
  if (hd && hd.kind === 'tnt' && G.mouse.rPressed && A.blk) {
    const x = A.blk.x + A.blk.nx, y = A.blk.y + A.blk.ny, z = A.blk.z + A.blk.nz;
    if (!wd.get(x, y, z) && G.canBuildAt(x, y, z)) { p.remove('tnt', 1); G.spawnTNT(p, x, y, z); G.audio.place(new V3(x, y, z)); vmSwing = 1; }
  }
  if (hd && (hd.kind === 'use' || hd.kind === 'throw') && G.mouse.rPressed) { if (game.useItem(p, held.id)) vmSwing = 1; }
  G.mouse.lPressed = G.mouse.rPressed = false; G.mouse.rReleased = false;
  // prompt near shops
  const k = nearShop(p);
  const pr = $('prompt');
  if (k && !pr.classList.contains('show')) { pr.textContent = k === 'item' ? 'Press E — Item Shop' : 'Press E — Team Upgrades'; pr.classList.add('near'); }
  else if (!k) pr.classList.remove('near');
}

function updateCamera(dt) {
  const p = game.player;
  if (spectate && (!p.alive)) {
    const K = G.keys, s = spectate;
    if (locked && (p.eliminated || game.state === 'end')) {
      const sp = (K.ControlLeft ? 30 : 14) * dt, sy = Math.sin(s.yaw), cy = Math.cos(s.yaw);
      const f = (K.KeyW ? 1 : 0) - (K.KeyS ? 1 : 0), r = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0);
      s.pos.x += (-sy * f + cy * r) * sp; s.pos.z += (-cy * f - sy * r) * sp;
      s.pos.y += ((K.Space ? 1 : 0) - (K.ShiftLeft ? 1 : 0)) * sp;
    } else if (!p.eliminated) {
      // waiting to respawn: hover above your island
      const m = game.map.teams[p.team];
      s.pos.lerp(new V3(m.cx - m.fwd[0] * 10, S + 12, m.cz - m.fwd[1] * 10), dt * 1.5);
      s.yaw = G.lerp(s.yaw, m.spawnYaw, dt); s.pitch = G.lerp(s.pitch, -0.6, dt);
    }
    camera.position.copy(s.pos);
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
    return;
  }
  const e = p.eye;
  camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
  if (thirdPerson) {
    const back = p.lookDir().multiplyScalar(-1);
    const h = wd.raycast(e, back, 4.2);
    const d = h ? Math.max(0.3, h.dist - 0.25) : 4;
    camera.position.copy(e).addScaledVector(back, d);
  } else camera.position.copy(e);
  const sprintF = p.sprint ? 8 : 0;
  const want = G.settings.fov + sprintF + (p.effects.speed > game.time ? 6 : 0);
  if (Math.abs(camera.fov - want) > 0.05) { camera.fov = G.lerp(camera.fov, want, Math.min(1, dt * 8)); camera.updateProjectionMatrix(); }
}

/* ---------- loop ---------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  tick(dt, now / 1000);
}
// one simulation + render step (also driven by automated tests while the page is in the background)
G.tick = (dt = 1 / 30) => tick(dt, performance.now() / 1000);
function tick(dt, t) {
  clouds.children.forEach((c, i) => { c.position.x += dt * (1.2 + (i % 3) * 0.3); if (c.position.x > 300) c.position.x = -160; });
  if (game.state === 'play' || game.state === 'end') {
    if (game.player) playerControl(dt);
    game.update(dt);
    if (game.player) { updateCamera(dt); updateVM(dt, game.player); }
    G.fx.update(dt);
    wd.update();
    G.ui.render();
    for (const k of game.keepers) k.children[0] && (k.children[0].position.y = Math.sin(t * 2 + k.id) * 0.02);
  } else {
    // menu: slow orbit around the islands
    camera.position.set(64 + Math.cos(t * 0.05) * 70, S + 26, 64 + Math.sin(t * 0.05) * 70);
    camera.lookAt(64, S - 4, 64);
    vm.visible = false;
  }
  renderer.clear();
  renderer.render(scene, camera);
  if (game.state === 'play' && game.player && game.player.alive && !thirdPerson) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}

G.boot = () => {
  // build a preview world behind the menu
  game.map = G.buildMap(); wd.buildAll();
  for (const m of game.map.teams) game.bedModels[m.team] = G.makeBedModel(m.team, m.bed[0], m.bed[1]);
  for (const m of game.map.teams) { game.keepers.push(G.makeKeeper(m.shop.pos, m.shop.yaw, 'ITEM SHOP', '#ffe27a')); game.keepers.push(G.makeKeeper(m.upg.pos, m.upg.yaw, 'TEAM UPGRADES', '#7af0ff')); }
  for (const p of game.map.diamond) game.gens.push(new G.Gen('diamond', p));
  for (const p of game.map.emerald) game.gens.push(new G.Gen('emerald', p));
  G.game.time = 0;
  $('loading').classList.add('hidden');
  G.ui.menu();
  requestAnimationFrame(frame);
};
})();
