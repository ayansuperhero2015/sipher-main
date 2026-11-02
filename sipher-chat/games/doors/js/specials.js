// Themes and hand-built special rooms (Reception, Library, Electrical, Halt, Seek chase, Nest, Dam, ...).
(() => {
'use strict';
const V3 = THREE.Vector3;
const M = G.mat, GEO = G.geo;

G.THEMES = {
  hotel: () => ({
    name: 'hotel', wall: G.pick([M.wallA, M.wallB, M.wallC, M.wallD, M.wallA]), floor: G.chance(0.3) ? M.carpet : G.pick([M.floor, M.floor2]), ceil: M.ceil, H: 3.6,
    door: M.door, lamp: 'pendant', lampColor: 0xffc98a, lampI: 14, sconces: true, rug: true, surface: 'wood',
    furn: { closet: 4, dresser: 5, bed: 1.3, table: 1.4, plant: 1.2, shelf: 1, painting: 1.6, none: 2 },
  }),
  greenhouse: () => ({
    name: 'greenhouse', wall: M.hedge, wallUV: 3, floor: M.tile, ceil: M.glass, H: 4.4, door: M.door, lamp: 'pendant', lampColor: 0xb8ffb0, lampI: 6,
    furn: { planter: 4, closet: 2.5, plant: 2, none: 2 }, need: ['closet'], noPaintings: true, surface: 'grass',
    extras(room) {
      const n = G.randi(2, 5);
      for (let i = 0; i < n; i++) {
        const x = G.rand(room.xl + 1, room.xr - 1), z = G.rand(2, room.L - 2);
        G.game.spawn(new G.E.Snare(room, room.l2w(x, 0, z)));
      }
    },
  }),
  mines: () => ({
    name: 'mines', wall: G.pick([M.rock, M.rock, M.rockDark]), floor: M.dirt, ceil: M.rockDark, H: 3.9, door: M.doorDark, trim: M.beam,
    lamp: 'lantern', lampColor: 0xffa860, lampI: 17, lampD: 13, surface: 'dirt', noPaintings: true, lootFurn: 'toolbox',
    furn: { locker: 3.5, toolbox: 4, crate: 3, barrel: 2, none: 2.5 }, need: ['locker'], closetMat: M.locker,
    extras(room) {
      for (let z = 2.5; z < room.L - 1; z += 3.2) {
        const blocked = s => room.exits.some(e => e.side === s && Math.abs(e.pos - z) < 1.3);
        if (!blocked('left')) room.box(room.xl + 0.14, room.H / 2, z, 0.26, room.H, 0.26, M.beam, { uv: 1 });
        if (!blocked('right')) room.box(room.xr - 0.14, room.H / 2, z, 0.26, room.H, 0.26, M.beam, { uv: 1 });
        room.box((room.xl + room.xr) / 2, room.H - 0.15, z, room.xr - room.xl, 0.3, 0.3, M.beam, { collide: false, uv: 1 });
        G.reserve(room, room.xl, room.xl + 0.3, z - 0.3, z + 0.3); G.reserve(room, room.xr - 0.3, room.xr, z - 0.3, z + 0.3);
      }
      if (room.kind === 'tunnel') for (const s of [-0.55, 0.55]) room.box(s, 0.04, room.L / 2, 0.08, 0.08, room.L, M.metal, { collide: false });
    },
  }),
  backdoor: () => ({
    name: 'backdoor', wall: M.concreteDark, floor: M.grate, floorUV: 2, ceil: M.concreteDark, H: 3.4, door: M.doorDark,
    lamp: 'pendant', lampColor: 0xff7a48, lampI: 8, surface: 'metal', noPaintings: true, closetMat: M.rust, closetDoor: M.metal, dresserMat: M.rust,
    furn: { closet: 4, dresser: 3, pipes: 2, shelf: 1, crate: 1, none: 2 },
  }),
  rooms: () => ({
    name: 'rooms', wall: M.roomsWall, floor: M.roomsFloor, ceil: M.roomsCeil, H: 3.4, door: M.doorDark, trim: M.metal,
    lamp: 'fluor', lampColor: 0xdfe8ff, lampI: 11, surface: 'concrete', noPaintings: true,
    furn: { locker: 5, pipes: 1, none: 3 }, need: ['locker', 'locker'],
  }),
  garden: () => ({
    name: 'garden', wall: M.hedge, wallUV: 3, floor: M.grass, ceil: null, noCeil: true, H: 4.6, door: M.gate, trim: M.black,
    lamp: 'post', lampColor: 0xffd9a0, lampI: 18, lampD: 15, surface: 'grass', noPaintings: true,
    furn: { bench: 2, statue: 1, plant: 2, none: 5 },
    placeLamps(room) {
      for (let z = 3; z < room.L - 1; z += 9) {
        room.lamp(room.xl + 0.6, 0, z, { type: 'post' });
        room.lamp(room.xr - 0.6, 0, z + 4.5, { type: 'post' });
        G.reserve(room, room.xl, room.xl + 1, z - 0.5, z + 0.5); G.reserve(room, room.xr - 1, room.xr, z + 4, z + 5);
      }
    },
    extras(room) {
      // hedge blocks and a fountain to break the space up
      const cx = (room.xl + room.xr) / 2;
      for (let i = 0; i < G.randi(1, 3); i++) {
        const x = G.rand(room.xl + 3, room.xr - 3), z = G.rand(5, room.L - 5);
        if (Math.abs(x) < 2 && z < 7) continue;
        room.box(x, 1.2, z, G.rand(1.5, 3), 2.4, G.rand(1.5, 3), M.hedge, { uv: 3 });
      }
      if (G.chance(0.4)) {
        const z = room.L / 2;
        room.mesh(GEO.cyl, M.stone, cx, 0.35, z, null, 1.6, 0.7, 1.6);
        room.mesh(GEO.cyl, M.water, cx, 0.66, z, null, 1.45, 0.05, 1.45);
        room.mesh(GEO.cyl, M.stone, cx, 1.2, z, null, 0.18, 1.2, 0.18);
        room.addCol(cx, 0.5, z, 3.2, 1, 3.2);
      }
      // fireflies
      const n = 40, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = G.rand(room.xl, room.xr); pos[i * 3 + 1] = G.rand(0.5, 3); pos[i * 3 + 2] = G.rand(0, room.L); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); room.geos.push(geo);
      const mat = new THREE.PointsMaterial({ color: 0xfff08a, size: 0.07, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      room.mats.push(mat);
      const pts = new THREE.Points(geo, mat); room.group.add(pts);
      let t = G.random() * 10;
      room.updaters.push(dt => { t += dt; pts.position.y = Math.sin(t * 0.7) * 0.2; pts.position.x = Math.sin(t * 0.3) * 0.3; mat.opacity = 0.6 + Math.sin(t * 3) * 0.3; });
    },
  }),
};

const SP = G.SP = {};
const mk = (game, n, at, lay, th, H) => new G.Room(game, { index: n, origin: at.origin, dir: at.dir, xl: lay.xl, xr: lay.xr, L: lay.L, H: H || th.H, theme: th });
const sealPrev = (game, n) => {
  const prev = game.roomByIndex(n - 1);
  if (prev && prev.exitDoor) { prev.exitDoor.close(true); prev.exitDoor.sealed = true; }
};
SP.sealPrev = sealPrev;
const exitLocal = (r, e, y = 2.7, inset = 0.4) => {
  if (e.side === 'front') return new V3(e.pos, y, r.L - inset);
  if (e.side === 'right') return new V3(r.xr - inset, y, e.pos);
  return new V3(r.xl + inset, y, e.pos);
};

// Wall lever: base + handle; onPull fires once.
SP.lever = (room, x, z, ry, label, onPull) => {
  const g = room.sub(x, z, ry);
  room.box(0, 1.3, 0.06, 0.35, 0.55, 0.12, M.metal, { parent: g, collide: false, uv: 1 });
  const h = new THREE.Group(); h.position.set(0, 1.3, 0.14); g.add(h);
  room.mesh(GEO.box, M.rust, 0, 0.18, 0, h, 0.05, 0.36, 0.05);
  room.mesh(GEO.sphere, new THREE.MeshStandardMaterial({ color: 0xaa1a1a, roughness: 0.4 }), 0, 0.38, 0, h, 0.06, 0.06, 0.06);
  h.rotation.x = 0.7;
  const it = room.addInter(g.localToWorld(new V3(0, 1.3, 0.4)), () => (it.used ? null : label), () => {
    if (it.used) return; it.used = true;
    G.audio.sfx('lever');
    let t = 0; room.updaters.push(dt => { t += dt * 4; h.rotation.x = 0.7 - Math.min(1, t) * 1.4; return t < 1; });
    onPull();
  }, 2);
  return it;
};

/* ---------- Hotel: Reception (room 0) ---------- */
SP.reception = (game, at) => {
  const th = G.THEMES.hotel(); th.wall = M.wallC; th.floor = M.carpet;
  const r = new G.Room(game, { index: 0, origin: at.origin, dir: at.dir, xl: -6, xr: 6, L: 14, H: 4.6, theme: th });
  r.exits = [{ side: 'front', pos: 0, real: true }];
  r.shell({ noBackGap: true });
  // Door 1 always starts locked; its key waits on the reception desk.
  r.makeExit(r.exits[0], { number: 1, locked: true });
  G.furn.keyPickup(r, r.group, -3.6, 1.17, 8.4);
  // elevator behind the spawn
  r.box(0, 1.5, 0.2, 2.6, 3.0, 0.1, M.metal, { collide: false, uv: 1 });
  for (const s of [-1, 1]) r.box(s * 0.6, 1.3, 0.27, 1.15, 2.6, 0.05, M.metal, { collide: false, uv: 1 });
  r.box(0, 3.1, 0.27, 2.8, 0.25, 0.08, M.brass, { collide: false, uv: 1 });
  // reception desk
  r.box(-3.8, 0.55, 7.5, 1.0, 1.1, 5, M.darkwood);
  r.box(-3.8, 1.13, 7.5, 1.25, 0.06, 5.2, M.wood, { collide: false });
  r.mesh(GEO.sphere, M.brass, -3.6, 1.2, 6.2, null, 0.09, 0.06, 0.09);
  r.box(-5.85, 2.2, 7.5, 0.1, 1.4, 4, M.darkwood, { collide: false });
  for (let i = 0; i < 12; i++) r.mesh(GEO.box, M.brass, -5.78, 1.7 + (i % 3) * 0.4, 6 + Math.floor(i / 3) * 0.9, null, 0.05, 0.12, 0.08);
  G.reserve(r, -6, -3, 4.5, 10.5);
  r.lamp(0, 4.6, 4.5, { type: 'chandelier', intensity: 20, dist: 15 });
  r.lamp(0, 4.6, 10.5, { type: 'chandelier', intensity: 20, dist: 15 });
  G.furnish(r, { plant: 2, sofa: 2, painting: 2, shelf: 1, none: 1 }, { need: ['sofa', 'sofa', 'plant', 'plant', 'closet', 'dresser'] });
  r.box(0, 0.006, 7, 3.5, 0.01, 8, M.carpet, { collide: false });
  return r.finish();
};

/* ---------- outro (victory corridor) ---------- */
SP.outro = (game, at, n, th, text) => {
  const lay = G.chooseLayout(game, at, { Wfix: 4, Lfix: 14, center: true, sides: ['front'] });
  const r = mk(game, n, at, lay, th, th.H || 3.6);
  r.shell();
  r.box(0, 1.6, r.L - 0.1, 3.6, 3.2, 0.1, new THREE.MeshBasicMaterial({ color: 0xffffff }), { collide: false });
  r.lamp(0, 2.0, r.L - 1.2, { type: 'bare', color: 0xffffff, intensity: 60, dist: 22 });
  r.onEnter = () => { game.escaping = true; setTimeout(() => game.win(text), 1200); G.ui.fade(true, 1.2); };
  return r.finish();
};

/* ---------- Halt hallway ---------- */
SP.halt = (game, at, n, base) => {
  const th = Object.assign({}, base, { lampColor: 0x5aa8ff, lampI: 7, sconces: false });
  const lay = G.chooseLayout(game, at, { Wfix: 3.8, Lfix: 46, center: true, sides: ['front'] });
  const r = mk(game, n, at, lay, th, 3.4);
  r.exits = [{ side: 'front', pos: 0, real: true }];
  r.shell(); r.makeExit(r.exits[0], { number: n + 1 });
  for (let z = 4; z < r.L; z += 9) r.lamp(0, r.H, z, { type: 'pendant' });
  const h = { phase: 'wait', t: 3, z: 0 };
  h.sprite = G.faceSprite('halt', 1.9); h.sprite.visible = false; r.group.add(h.sprite);
  r.onEnter = () => { sealPrev(game, n); G.audio.sfx('halt'); G.ui.caption('Something cold lingers in this hallway...', 3); };
  r.onDispose = () => G.ui.tint('halt', false);
  r.updaters.push(dt => {
    G.ui.tint('halt', game.cur === r);
    if (game.cur !== r) h.sprite.visible = false;
    if (game.cur !== r || game.state !== 'play') return;
    const pl = r.w2l(G.player.pos);
    if (h.phase === 'wait') {
      h.t -= dt;
      if (h.t <= 0 && pl.z < r.L - 7) {
        h.phase = 'front'; h.z = Math.min(r.L - 1, pl.z + 9); h.t = G.rand(3.2, 4.5);
        h.sprite.visible = true; G.ui.msg('TURN AROUND', 2, 'halt'); G.audio.sfx('halt');
      }
    } else {
      h.z -= 2.7 * dt; h.t -= dt;
      h.sprite.position.set(Math.sin(performance.now() / 300) * 0.25, 1.7, h.z);
      if (Math.abs(h.z - pl.z) < 1.1) {
        game.damage(40, 'halt'); h.phase = 'wait'; h.t = G.rand(3, 5); h.sprite.visible = false; G.player.shake = 0.6;
      } else if (h.t <= 0) {
        h.phase = 'wait'; h.t = G.rand(3.5, 6); h.sprite.visible = false; G.ui.msg('KEEP GOING', 1.5, 'halt');
      }
    }
  });
  return r.finish();
};

/* ---------- Seek: eyes on walls before the chase ---------- */
SP.seekEyes = (room, count) => {
  for (let i = 0; i < count; i++) {
    const side = G.pick(['l', 'r']), z = G.rand(1, room.L - 1), y = G.rand(0.8, room.H - 0.6), s = G.rand(0.35, 0.8);
    const m = new THREE.Mesh(GEO.plane, M.seekEye);
    m.scale.set(s * 1.4, s, 1);
    if (side === 'l') { m.position.set(room.xl + 0.02, y, z); m.rotation.y = Math.PI / 2; }
    else { m.position.set(room.xr - 0.02, y, z); m.rotation.y = -Math.PI / 2; }
    room.group.add(m);
  }
};
/* ---------- Seek chase corridors ---------- */
SP.chase = (game, at, n, th, i, total) => {
  const last = i === total - 1;
  const lay = last ? G.chooseLayout(game, at, { Wfix: 9, Lfix: 34, center: true, sides: ['front'] })
    : G.chooseLayout(game, at, { W: [4.4, 5.2], L: [22, 30], sides: ['front', 'left', 'right'] });
  const r = mk(game, n, at, lay, th, th.H);
  r.chase = { i, last };
  r.exits = [{ side: lay.side, pos: lay.pos, real: true }];
  r.shell(); r.makeExit(r.exits[0], { number: n + 1 });
  const ep = exitLocal(r, r.exits[0]);
  r.lamp(ep.x, ep.y, ep.z, { type: 'bare', color: 0x5ab4ff, intensity: 12, dist: 9 });
  const cx = (r.xl + r.xr) / 2, W = r.xr - r.xl;
  for (let z = 5; z < r.L; z += 8) r.lamp(cx, r.H, z, { color: 0xff9050, intensity: 7, buzz: true });
  if (!last) {
    SP.seekEyes(r, G.randi(6, 14));
    for (let z = 6; z < r.L - 4; z += G.rand(4.5, 6.5)) {
      if (r.exits[0].side !== 'front' && Math.abs(r.exits[0].pos - z) < 2.6) continue;
      const kind = G.pick(['shelfL', 'shelfR', 'beam', 'shelfL', 'shelfR']);
      if (kind === 'beam') {
        r.box(cx, 1.5, z, W, 0.36, 0.3, M.darkwood, { uv: 1 });
        r.box(cx - W / 2 + 0.5, 0.4, z + 0.3, 1.0, 0.8, 0.5, M.darkwood, { uv: 1 });
      } else {
        const s = kind === 'shelfL' ? -1 : 1;
        r.box(cx + s * (W / 2 - 1.15), 0.65, z, 2.3, 1.3, 0.5, M.darkwood, { uv: 1 });
        r.box(cx + s * (W / 2 - 1.15), 0.65, z - 0.26, 2.2, 1.2, 0.01, M.books, { collide: false });
      }
    }
  } else {
    // The burning hall: stay in the lit lane or the hands take you.
    for (const s of [-1, 1]) {
      for (let z = 1.5; z < r.L - 1; z += 1.8) r.box(s * 3.2, 0.12, z, 2.4, 0.24, 1.4, M.fire, { collide: false });
      for (let z = 3; z < r.L - 2; z += 7) r.lamp(s * 3.0, 0.9, z, { type: 'bare', color: 0xff6a20, intensity: 10, dist: 8, buzz: true });
      r.box(s * 1.55, 0.012, r.L / 2, 0.12, 0.02, r.L - 2, M.blueGlow, { collide: false });
    }
    const hands = [];
    for (let k = 0; k < 18; k++) {
      const s = G.chance(0.5) ? -1 : 1, g = r.sub(s * G.rand(2.2, 4.2), G.rand(3, r.L - 3), 0);
      const hgt = G.rand(1.6, 2.8);
      r.mesh(GEO.box, M.black, 0, hgt / 2, 0, g, 0.16, hgt, 0.16);
      for (let f = 0; f < 4; f++) r.mesh(GEO.box, M.black, (f - 1.5) * 0.06, hgt + 0.12, 0, g, 0.03, 0.22, 0.03);
      g.rotation.z = -s * G.rand(0.2, 0.6);
      hands.push({ g, ph: G.random() * 7, base: g.rotation.z });
    }
    let fire = null;
    r.updaters.push(dt => {
      const t = performance.now() / 1000;
      hands.forEach(h => { h.g.rotation.z = h.base + Math.sin(t * 2 + h.ph) * 0.25; });
      if (game.cur === r) { if (!fire) { fire = G.audio.loop('fire'); fire.set(0.5); } }
      else if (fire) { fire.stop(); fire = null; }
      if (game.cur === r && game.seek && game.state === 'play') {
        const pl = r.w2l(G.player.pos);
        if (Math.abs(pl.x) > 1.8 && pl.z > 1.2 && pl.z < r.L - 1) game.kill('hands');
      }
    });
    r.onDispose = () => { if (fire) fire.stop(); };
  }
  return r.finish();
};

/* ---------- Hotel: Library (door 50) ---------- */
const SHAPES = ['▲', '●', '■', '◆', '★', '✚', '☾', '♥'];
SP.library = (game, at, n) => {
  const th = G.THEMES.hotel(); th.wall = M.wallA; th.floor = M.floor2;
  const lay = G.chooseLayout(game, at, { Wfix: 22, Lfix: 28, center: true, sides: ['front'] });
  const r = mk(game, n, at, lay, th, 6.5);
  r.exits = [{ side: 'front', pos: 0, real: true }];
  r.shell();
  const door = r.makeExit(r.exits[0], { number: n + 1, padlock: true });
  const shelves = [];
  for (const x of [-8.6, -5.6, -2.6, 2.6, 5.6, 8.6]) for (const zc of [6.5, 13.5, 20.5]) {
    r.box(x, 1.6, zc, 0.8, 3.2, 5, M.darkwood, { uv: 2 });
    for (const s of [-1, 1]) r.box(x + s * 0.405, 1.6, zc, 0.01, 3.0, 4.8, M.books, { collide: false, uv: 2 });
    r.box(x, 3.25, zc, 0.95, 0.1, 5.1, M.trim, { collide: false });
    shelves.push({ x, zc });
  }
  for (const z of [10, 17]) {
    r.box(0, 0.78, z, 1.6, 0.06, 2.6, M.wood, { collide: false });
    r.addCol(0, 0.4, z, 1.6, 0.8, 2.6);
    r.lamp(0, 0.85, z, { type: 'bare', intensity: 3, dist: 5, color: 0xffd080 });
  }
  // desk with the code paper near the entrance
  r.box(4.2, 0.4, 2.0, 1.8, 0.8, 0.9, M.darkwood);
  r.mesh(GEO.plane, M.paper, 4.2, 0.81, 2.0, null, 0.4, 0.5, 1).rotation.x = -Math.PI / 2;
  // puzzle
  const digits = {}; SHAPES.forEach(s => { digits[s] = G.randi(0, 9); });
  const order = G.shuffle(SHAPES.slice()).slice(0, 5);
  const pz = r.puzzle = { digits, order, code: order.map(s => digits[s]).join(''), found: {} };
  r.addInter(r.l2w(4.2, 0.9, 2.0), 'Read paper', () => G.ui.paper(pz), 2.2);
  const spots = G.shuffle(shelves.flatMap(s => [-1, 1].map(side => ({ ...s, side })))).slice(0, SHAPES.length);
  SHAPES.forEach((shape, i) => {
    const s = spots[i], z = s.zc + G.rand(-2, 2), y = G.rand(0.7, 1.9), x = s.x + s.side * 0.43;
    const b = r.box(x, y, z, 0.06, 0.26, 0.18, M.bookGlow, { collide: false, uv: 1 });
    const it = r.addInter(r.l2w(x, y, z), () => (it.taken ? null : 'Take book'), () => {
      if (it.taken) return; it.taken = true; b.visible = false;
      pz.found[shape] = digits[shape]; G.audio.sfx('pickup'); game.noise(G.player.pos, 6);
      G.ui.book(shape, digits[shape]); G.ui.hints(pz);
    }, 1.7);
  });
  for (const [x, z, ry] of [[-8, 0.15, 0], [8, 0.15, 0], [-7.5, r.L, Math.PI], [7.5, r.L, Math.PI]]) G.furn.closet(r, r.sub(x, z, ry));
  for (const [x, z] of [[-5, 4], [5, 4], [-5, 24], [5, 24], [0, 13.5], [-9.8, 10], [9.8, 17]]) r.lamp(x, r.H, z, { type: 'pendant', intensity: 13, dist: 13 });
  door.onPadlock = d => G.ui.padlock(5, code => {
    if (code === pz.code) { d.unlock(); d.open(); G.ui.msg('The padlock clicks open.', 2); G.ui.hints(null); }
    else { G.audio.sfx('bad'); game.noise(d.center, 40); G.ui.msg('Wrong code... it heard that.', 2); }
  });
  r.onEnter = () => {
    sealPrev(game, n);
    game.spawn(new G.E.Figure(r, r.l2w(0, 0, 14), { intro: 3 }));
    G.ui.caption('The Figure is blind, but it hears everything. Crouch [C] and find the books.', 6);
    G.ui.hints(pz);
  };
  r.onLeave = () => G.ui.hints(null);
  return r.finish();
};

/* ---------- Hotel: Courtyard warehouse + Electrical Room (door 100) ---------- */
SP.electrical = (game, at, n) => {
  const th = { name: 'warehouse', wall: M.concrete, floor: M.concreteDark, ceil: M.concreteDark, H: 7, door: M.doorDark, trim: M.metal, lamp: 'fluor', lampColor: 0xcfd8ff, lampI: 8, surface: 'concrete', noPaintings: true };
  const lay = G.chooseLayout(game, at, { Wfix: 24, Lfix: 34, center: true, sides: ['front'] });
  const r = mk(game, n, at, lay, th, 7);
  r.exits = [{ side: 'front', pos: 0, real: true, w: 4, h: 4 }];
  r.shell();
  const gate = r.makeExit(r.exits[0], { number: n + 1, w: 4, h: 4, mat: M.metal, noKnob: true, noPlate: true, sealed: true, sealedLabel: 'Gate (no power)', sealedMsg: 'The gate needs power. Find the Electrical Room.' });
  // electrical room (x 5..12, z 22..30)
  const ex0 = 5, ez0 = 22, ez1 = 30, eh = 3.2;
  r.box(ex0, eh / 2, (ez0 + 25.3) / 2, 0.2, eh, 25.3 - ez0, M.concrete);
  r.box(ex0, eh / 2, (26.7 + ez1) / 2, 0.2, eh, ez1 - 26.7, M.concrete);
  r.box(ex0, (DH() + eh) / 2, 26, 0.2, eh - DH(), 1.4, M.concrete, { collide: false });
  r.box((ex0 + 12) / 2, eh / 2, ez0, 12 - ex0, eh, 0.2, M.concrete);
  r.box((ex0 + 12) / 2, eh / 2, ez1, 12 - ex0, eh, 0.2, M.concrete);
  r.box((ex0 + 12) / 2, eh + 0.05, (ez0 + ez1) / 2, 12 - ex0, 0.1, ez1 - ez0, M.concreteDark, { collide: false });
  const fr = r.sub(ex0, 26, -Math.PI / 2);
  const ed = new G.Door(r, fr, { interior: true, locked: true, keyId: 'ekey', plateText: 'ELECTRICAL', lockedMsg: 'Locked. The Electrical Room key must be in one of these boxes.' });
  r.doors.push(ed);
  ed.onOpen = () => { r.nav = new G.Nav(r); };
  r.lamp(9, eh, 26, { type: 'bare', color: 0xff3020, intensity: 6, dist: 8 });
  // breaker box
  r.box(11.85, 1.5, 26, 0.2, 1.3, 1.0, M.metal, { uv: 1 });
  let powered = false;
  r.addInter(r.l2w(11.6, 1.5, 26), () => (powered ? null : 'Use breaker box'), () => {
    G.ui.breaker(() => {
      powered = true;
      G.audio.sfx('alarm'); G.ui.msg('POWER RESTORED. RUN!', 3, 'run');
      r.lamps.forEach(L => { L.base *= 2; L.on = true; L.broken = false; });
      gate.sealed = false; gate.isOpen = true; gate.col.on = false;
      r.anim(gate.pivot, 'y', 4.3, 3);
      G.audio.sfx('slam');
      game.figures.forEach(f => { f.enraged = true; f.state = 'chase'; });
      G.player.boost = 1.25;
    });
  }, 2);
  G.reserve(r, ex0 - 1.5, 12, ez0 - 1.5, ez1 + 0.5);
  G.reserve(r, -3, 3, 0, 4); G.reserve(r, -4, 4, r.L - 4, r.L);
  // crate stacks + searchable boxes
  const boxes = [];
  for (let k = 0, tries = 0; k < 16 && tries < 200; tries++) {
    const w = G.rand(1.6, 3), d = G.rand(1.6, 3), x = G.rand(r.xl + 1.5, r.xr - 1.5), z = G.rand(4, r.L - 4);
    const rect = { x0: x - w / 2 - 1.2, x1: x + w / 2 + 1.2, z0: z - d / 2 - 1.2, z1: z + d / 2 + 1.2 };
    if (r.placed.some(p => p.x0 < rect.x1 && p.x1 > rect.x0 && p.z0 < rect.z1 && p.z1 > rect.z0)) continue;
    r.placed.push(rect);
    const h = G.rand(1.6, 3.4);
    r.box(x, h / 2, z, w, h, d, M.beam, { uv: 1.5 });
    boxes.push(r.l2w(x + w / 2 + 0.35, 0.3, z));
    k++;
  }
  const keyIdx = G.randi(0, Math.max(0, boxes.length - 1));
  boxes.slice(0, 9).forEach((p, i) => {
    const lp = r.w2l(p);
    const m = r.box(lp.x, 0.3, lp.z, 0.6, 0.6, 0.6, M.wood, { uv: 1 });
    const it = r.addInter(p.clone().setY(0.6), () => (it.done ? null : 'Search box'), () => {
      if (it.done) return; it.done = true; m.scale.y = 0.6; G.audio.sfx('drawer'); game.noise(G.player.pos, 7);
      if (i === keyIdx % Math.min(9, boxes.length)) { game.inv.add('ekey'); G.ui.msg('Found the Electrical Room Key!', 2.5); }
      else if (G.chance(0.4)) game.addGold(G.randi(5, 15));
      else G.ui.msg('Nothing useful.', 1.2);
    }, 1.8);
  });
  for (let z = 5; z < r.L; z += 9) for (const x of [-6, 6]) r.lamp(x, r.H, z, { type: 'fluor', intensity: 7, dist: 12, buzz: true });
  r.onEnter = () => {
    sealPrev(game, n);
    game.spawn(new G.E.Figure(r, r.l2w(-4, 0, 18), { intro: 2.5 }));
    G.ui.caption('Find the Electrical Room key and restore the power.', 6);
  };
  return r.finish();
};
const DH = () => G.DH;

/* ---------- Mines: The Nest (door 150) ---------- */
SP.nest = (game, at, n) => {
  const th = G.THEMES.mines(); th.wall = M.rockDark; th.lampI = 9;
  const lay = G.chooseLayout(game, at, { Wfix: 26, Lfix: 36, center: true, sides: ['front'] });
  const r = mk(game, n, at, lay, th, 7);
  r.exits = [{ side: 'front', pos: 0, real: true, w: 3, h: 3.2 }];
  r.shell();
  const gate = r.makeExit(r.exits[0], { number: n + 1, w: 3, h: 3.2, mat: M.rust, noKnob: true, sealed: true, sealedLabel: 'Gate (sealed)', sealedMsg: 'Pull all three levers to raise the gate.' });
  G.reserve(r, -3, 3, 0, 5); G.reserve(r, -3, 3, r.L - 4, r.L);
  for (let k = 0, tries = 0; k < 12 && tries < 200; tries++) {
    const s = G.rand(1.4, 2.6), x = G.rand(r.xl + 2, r.xr - 2), z = G.rand(5, r.L - 5);
    const rect = { x0: x - s / 2 - 1.3, x1: x + s / 2 + 1.3, z0: z - s / 2 - 1.3, z1: z + s / 2 + 1.3 };
    if (r.placed.some(p => p.x0 < rect.x1 && p.x1 > rect.x0 && p.z0 < rect.z1 && p.z1 > rect.z0)) continue;
    r.placed.push(rect);
    r.box(x, r.H / 2, z, s, r.H, s * G.rand(0.8, 1.2), M.rock, { uv: 3 });
    k++;
  }
  // grumble nests decor
  for (let k = 0; k < 6; k++) r.mesh(GEO.sphere, M.rockDark, G.rand(r.xl + 2, r.xr - 2), 0, G.rand(8, r.L - 6), null, 1.2, 0.35, 1.2);
  let pulled = 0;
  const pull = () => {
    pulled++; game.noise(G.player.pos, 16);
    G.ui.msg(`Lever ${pulled}/3`, 1.5);
    if (pulled === 3) {
      gate.sealed = false; gate.isOpen = true; gate.col.on = false;
      r.anim(gate.pivot, 'y', 3.4, 2.5); G.audio.sfx('slam'); G.ui.msg('The gate is opening!', 2.5);
    }
  };
  SP.lever(r, r.xl, r.L * 0.3, Math.PI / 2, 'Pull lever', pull);
  SP.lever(r, r.xr, r.L * 0.55, -Math.PI / 2, 'Pull lever', pull);
  SP.lever(r, r.xl, r.L * 0.82, Math.PI / 2, 'Pull lever', pull);
  for (const [x, z, ry] of [[r.xl, 8, Math.PI / 2], [r.xr, 14, -Math.PI / 2], [r.xl, 22, Math.PI / 2], [r.xr, 28, -Math.PI / 2], [-8, 0.15, 0], [8, 0.15, 0]]) G.furn.locker(r, r.sub(x, z, ry));
  for (let z = 4; z < r.L; z += 8) for (const x of [-7, 7]) r.lamp(x, r.H, z, { type: 'lantern', intensity: 8, dist: 10 });
  r.onEnter = () => {
    sealPrev(game, n);
    for (let k = 0; k < 3; k++) { const nav = r.nav || (r.nav = new G.Nav(r)); let p; do { p = nav.randomFree(); } while (r.w2l(p).z < 12); game.spawn(new G.E.Grumble(r, p)); }
    G.ui.caption('The Nest. Grumbles see well — stay out of their sight and pull the three levers.', 6);
  };
  return r.finish();
};

/* ---------- Mines: The Dam (door 200) ---------- */
SP.dam = (game, at, n) => {
  const th = { name: 'dam', wall: M.concrete, floor: M.concreteDark, ceil: M.concreteDark, H: 9, door: M.doorDark, trim: M.metal, lamp: 'fluor', lampColor: 0xd8e4ff, lampI: 10, surface: 'concrete', noPaintings: true };
  const lay = G.chooseLayout(game, at, { Wfix: 22, Lfix: 50, center: true, sides: ['front'] });
  const r = mk(game, n, at, lay, th, 9);
  r.exits = [{ side: 'front', pos: 0, real: true, w: 3.5, h: 3.5 }];
  r.shell();
  const gate = r.makeExit(r.exits[0], { number: n + 1, w: 3.5, h: 3.5, mat: M.rust, noKnob: true, noPlate: true, sealed: true, sealedLabel: 'Floodgate', sealedMsg: 'Turn all three valves to open the floodgate.' });
  for (let z = 8; z < r.L - 4; z += 8) for (const x of [-5.5, 5.5]) r.box(x, r.H / 2, z, 1.4, r.H, 1.4, M.concrete, { uv: 3 });
  for (let z = 4; z < r.L; z += 10) for (const x of [-5.5, 5.5]) r.lamp(x, r.H, z, { type: 'fluor', intensity: 9, dist: 13, buzz: true });
  // water channel along the right wall
  r.box(r.xr - 1.5, -0.05, r.L / 2, 3, 0.02, r.L, M.water, { collide: false });
  const water = r.box(0, -0.5, r.L / 2, r.xr - r.xl, 0.05, r.L, M.water, { collide: false });
  let turned = 0, seeked = false;
  const valve = (x, z, ry) => {
    const g = r.sub(x, z, ry);
    r.box(0, 1.3, 0.25, 0.3, 0.3, 0.5, M.metal, { parent: g, uv: 1 });
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 6, 16), new THREE.MeshStandardMaterial({ color: 0xaa2020, metalness: 0.6, roughness: 0.4 }));
    wheel.position.set(0, 1.3, 0.52); g.add(wheel); r.mats.push(wheel.material); r.geos.push(wheel.geometry);
    const it = r.addInter(g.localToWorld(new V3(0, 1.3, 0.8)), () => (it.done || game.channel ? null : 'Turn valve'), () => {
      game.startChannel(2.4, g.localToWorld(new V3(0, 0, 0.9)), dt => { wheel.rotation.z += dt * 4; if (G.random() < dt * 3) G.audio.sfx('valve'); }, () => {
        it.done = true; turned++; G.audio.sfx('lever'); G.ui.msg(`Valve ${turned}/3`, 1.5);
        if (turned === 1 && !seeked) {
          seeked = true;
          game.spawn(new G.E.Seek(r.l2w(0, 0, 1.5), { speed: 4.0, rise: 2.6 }));
          G.ui.msg('SEEK HAS FOUND YOU', 2.5, 'run'); game.chase = true;
        }
        if (turned === 3) {
          gate.sealed = false; gate.isOpen = true; gate.col.on = false;
          r.anim(gate.pivot, 'y', 3.8, 2.5); G.audio.sfx('splash'); G.ui.msg('THE FLOODGATE IS OPEN. GET OUT!', 3, 'run');
          r.anim(water, 'y', 0.35, 14);
        }
      });
    }, 2);
  };
  valve(r.xl, 15, Math.PI / 2); valve(r.xr, 28, -Math.PI / 2); valve(r.xl, 41, Math.PI / 2);
  for (const [x, z, ry] of [[r.xl, 22, Math.PI / 2], [r.xr, 36, -Math.PI / 2]]) G.furn.locker(r, r.sub(x, z, ry));
  let wloop = null;
  r.onEnter = () => {
    sealPrev(game, n);
    wloop = G.audio.loop('water'); wloop.set(0.4);
    G.ui.caption('The Dam. Turn the three valves to open the floodgate.', 6);
  };
  r.onLeave = () => { if (wloop) wloop.stop(); };
  r.onDispose = () => { if (wloop) wloop.stop(); };
  return r.finish();
};

/* ---------- Backdoor ---------- */
SP.bdStart = (game, at) => {
  const th = G.THEMES.backdoor();
  const r = new G.Room(game, { index: 0, origin: at.origin, dir: at.dir, xl: -4, xr: 4, L: 10, H: 3.6, theme: th });
  r.exits = [{ side: 'front', pos: 0, real: true }];
  r.shell({ noBackGap: true }); r.makeExit(r.exits[0], { number: 1 });
  // Haste's clock
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#120808'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill();
  x.strokeStyle = '#a02020'; x.lineWidth = 8; x.stroke();
  x.fillStyle = '#d04040'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.fillRect(128 + Math.cos(a) * 95 - 4, 128 + Math.sin(a) * 95 - 4, 8, 8); }
  x.strokeStyle = '#e05050'; x.lineWidth = 6; x.beginPath(); x.moveTo(128, 128); x.lineTo(128, 50); x.moveTo(128, 128); x.lineTo(180, 140); x.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true }); r.mats.push(mat);
  r.mesh(GEO.plane, mat, 0, 2.3, 0.17, null, 1.4, 1.4, 1);
  r.lamp(0, r.H, 5, { intensity: 10 });
  G.furnish(r, th.furn, { need: ['closet', 'dresser'] });
  return r.finish();
};
SP.timeLever = (game, room) => {
  const side = G.chance(0.5) ? 'left' : 'right';
  const z = G.rand(1.8, room.L - 1.5);
  if (room.exits.some(e => e.side === side && Math.abs(e.pos - z) < 1.5)) return;
  SP.lever(room, side === 'left' ? room.xl : room.xr, z, side === 'left' ? Math.PI / 2 : -Math.PI / 2, 'Pull time lever', () => game.floor.addTime(game));
  room.lamp(side === 'left' ? room.xl + 0.3 : room.xr - 0.3, 2.2, z, { type: 'bare', color: 0x40ff60, intensity: 3, dist: 4 });
};

/* ---------- generic end rooms ---------- */
SP.finalRoom = (game, at, n, th, text, color = 0xffffff) => {
  const lay = G.chooseLayout(game, at, { Wfix: 8, Lfix: 12, center: true, sides: ['front'] });
  const r = mk(game, n, at, lay, th, th.H);
  r.shell();
  r.lamp(0, r.H, 6, { type: 'bare', color, intensity: 40, dist: 20 });
  r.onEnter = () => { game.escaping = true; setTimeout(() => game.win(text), 1500); G.ui.fade(true, 1.5); };
  return r.finish();
};
})();
