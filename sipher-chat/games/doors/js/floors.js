// Floor definitions: room sequence, special rooms and entity spawn rules per floor.
(() => {
'use strict';
const SP = G.SP, E = G.E;
const FL = G.FLOORS = {};

// Shared: Screech can appear in any dark room.
G.screechTick = (game, dt, rate) => {
  const cur = game.cur, P = G.player;
  if (game.screech || P.hiding || !cur || !cur.dark || game.seek || cur.chase) { game.screechT = 0; return; }
  if (cur.lamps.some(L => L.on && !L.broken && !L.unbreakable)) return;
  game.screechT += dt;
  if (game.screechT > 4 && Math.random() < dt * rate * (game.lightOn ? 0.35 : 1)) {
    game.screechT = 0;
    game.screech = game.spawn(new E.Screech());
  }
};
// Seek chase start/end handling.
G.chaseRoomEnter = (game, room) => {
  if (room.chase && room.chase.i === 0 && !room.chaseStarted && !game.seek) {
    room.chaseStarted = true;
    game.spawn(new E.Seek(room.l2w(0, 0, 0.5)));
    G.ui.msg('RUN!', 2.5, 'run');
    game.chase = true;
  } else if (game.chase && game.seek && !room.chase && !room.isDam) {
    SP.sealPrev(game, room.index);
    game.despawn(game.seek); game.chase = false;
    G.ui.caption('You escaped Seek.', 3); G.audio.sfx('good');
  }
};
const pickApart = (lo, hi, avoid) => { for (let i = 0; i < 50; i++) { const v = G.randi(lo, hi); if (!avoid(v)) return v; } return -1; };

/* ---------- Floor 1: The Hotel ---------- */
FL.hotel = {
  id: 'hotel', name: 'The Hotel', tag: 'FLOOR 1', color: '#d8b46a', face: 'rush', range: 'Doors 0 – 100', next: 'mines',
  desc: 'Check in. A hundred doors of shifting rooms stand between you and the exit. Rush, Ambush, Screech, Eyes, Halt, Seek and the Figure are waiting.',
  start: 0, end: 101, ambient: 'hotel', fog: [0x070402, 0.05],
  plate: n => G.pad(n),
  init() {
    this.chases = [G.randi(27, 34), G.randi(64, 72)];
    const bad = v => v === 50 || this.chases.some(a => v >= a - 7 && v < a + 7);
    this.halts = new Set([pickApart(14, 24, bad), pickApart(40, 48, bad), pickApart(78, 88, bad)].filter(v => v > 0));
    this.lastRush = 0;
  },
  chaseIdx(n) { for (const a of this.chases) if (n >= a && n < a + 6) return n - a; return -1; },
  build(game, n, at) {
    if (n === 0) return SP.reception(game, at);
    if (n === 50) return SP.library(game, at, n);
    if (n === 100) return SP.electrical(game, at, n);
    if (n === 101) return SP.outro(game, at, n, G.THEMES.hotel(), 'hotel');
    const ci = this.chaseIdx(n);
    if (ci >= 0) return SP.chase(game, at, n, G.THEMES.hotel(), ci, 6);
    if (this.halts.has(n)) return SP.halt(game, at, n, G.THEMES.hotel());
    const green = n >= 90;
    const pre = this.chases.find(a => n >= a - 6 && n < a);
    const cfg = {
      theme: green ? G.THEMES.greenhouse() : G.THEMES.hotel(),
      kind: green ? G.weighted({ room: 3, big: 3, hall: 1 }) : G.weighted({ hall: 3, room: 5, big: 2 }),
      locked: n > 2 && n !== 49 && n !== 99 && pre === undefined && G.chance(0.22),
      dark: green || (n > 8 && G.chance(Math.min(0.3, 0.05 + n / 300))),
      dupe: !green && n > 12 && pre === undefined && G.chance(0.07),
    };
    const r = G.buildStandard(game, n, at, cfg);
    if (pre !== undefined) SP.seekEyes(r, (n - (pre - 6) + 1) * 4);
    return r;
  },
  onEnter(game, room) {
    game.hideLimit = room.index >= 90 && room.index < 100 ? 9 : 20;
    if (room.index === 0) setTimeout(() => G.ui.caption('Door 1 is locked. Check the reception desk.', 4), 3500);
    if (room.index === 90) G.ui.caption('The Courtyard Greenhouse. It is dark... watch your step.', 4);
    G.chaseRoomEnter(game, room);
  },
  onDoorOpen(game, door) {
    const n = door.number;
    if (n <= 4 || game.seek || n === 50 || n >= 100) return;
    if (this.chaseIdx(n) >= 0 || this.chases.some(a => n >= a - 2 && n < a) || this.halts.has(n)) return;
    const room = game.roomByIndex(n);
    if (!room) return;
    if (n - this.lastRush > 5 && !game.rush) {
      if (n >= 20 && G.chance(0.05)) { this.lastRush = n; game.spawn(new E.Rusher('ambush')); }
      else if (G.chance(0.11)) { this.lastRush = n; game.spawn(new E.Rusher('rush')); }
    }
    if (n >= 6 && G.chance(0.06)) game.spawn(new E.Gazer(room, 'eyes'));
  },
  update(game, dt) { G.screechTick(game, dt, 0.08); },
};

/* ---------- Floor 2: The Mines ---------- */
FL.mines = {
  id: 'mines', name: 'The Mines', tag: 'FLOOR 2', color: '#e08a48', face: 'grumble', range: 'Doors 100 – 200',
  desc: 'Descend below the Hotel. Dark tunnels, Giggle on the ceilings, Gloombats in the dark, the Grumble Nest and the Dam.',
  start: 100, end: 201, ambient: 'mines', fog: [0x050403, 0.06],
  plate: n => G.pad(n),
  init() {
    this.chases = [G.randi(118, 128), G.randi(168, 178)];
    const bad = v => v === 150 || this.chases.some(a => v >= a - 7 && v < a + 7);
    this.halts = new Set([pickApart(132, 146, bad), pickApart(182, 195, bad)].filter(v => v > 0));
    this.lastRush = 100;
  },
  chaseIdx(n) { for (const a of this.chases) if (n >= a && n < a + 5) return n - a; return -1; },
  build(game, n, at) {
    if (n === 150) return SP.nest(game, at, n);
    if (n === 200) { const r = SP.dam(game, at, n); r.isDam = true; return r; }
    if (n === 201) return SP.outro(game, at, n, G.THEMES.mines(), 'mines');
    const ci = this.chaseIdx(n);
    if (ci >= 0) return SP.chase(game, at, n, G.THEMES.mines(), ci, 5);
    if (this.halts.has(n)) return SP.halt(game, at, n, G.THEMES.mines());
    const pre = this.chases.find(a => n >= a - 5 && n < a);
    const cfg = {
      theme: G.THEMES.mines(),
      kind: n === 100 ? 'cave' : G.weighted({ tunnel: 4, cave: 3, small: 2 }),
      noBackGap: n === 100,
      locked: n > 101 && n !== 149 && n !== 199 && pre === undefined && G.chance(0.18),
      dark: n > 102 && G.chance(0.32),
    };
    const r = G.buildStandard(game, n, at, cfg);
    if (pre !== undefined) SP.seekEyes(r, (n - (pre - 5) + 1) * 4);
    if (r.dark && G.chance(0.65)) {
      for (let i = 0; i < 4; i++) r.mesh(G.geo.sphere, G.mat.black, G.rand(r.xl + 1, r.xr - 1), r.H - 0.1, G.rand(1, r.L - 1), null, 0.35, 0.25, 0.35);
      game.spawn(new E.Gloombats(r));
    }
    if (n >= 104 && G.chance(0.13)) game.spawn(new E.Giggle(r, r.l2w((r.xl + r.xr) / 2 + G.rand(-0.8, 0.8), 0, G.rand(3, r.L - 2))));
    return r;
  },
  onEnter(game, room) {
    game.hideLimit = 20;
    if (room.index === 100) G.ui.caption('THE MINES. Something lives down here.', 4);
    G.chaseRoomEnter(game, room);
  },
  onDoorOpen(game, door) {
    const n = door.number;
    if (n <= 103 || game.seek || n === 150 || n >= 200) return;
    if (this.chaseIdx(n) >= 0 || this.chases.some(a => n >= a - 2 && n < a) || this.halts.has(n)) return;
    const room = game.roomByIndex(n);
    if (!room) return;
    if (n - this.lastRush > 5 && !game.rush) {
      if (n >= 115 && G.chance(0.055)) { this.lastRush = n; game.spawn(new E.Rusher('ambush')); }
      else if (G.chance(0.1)) { this.lastRush = n; game.spawn(new E.Rusher('rush')); }
    }
    if (G.chance(0.05)) game.spawn(new E.Gazer(room, 'eyes'));
  },
  update(game, dt) { G.screechTick(game, dt, 0.08); },
};

/* ---------- Sub-floor: The Backdoor ---------- */
FL.backdoor = {
  id: 'backdoor', name: 'The Backdoor', tag: 'SUB-FLOOR', color: '#d04848', face: 'haste', range: 'Doors -50 – 0',
  desc: 'A hidden floor beneath the Hotel. Haste is coming when the clock runs out — pull time levers, dodge Blitz, avoid Lookman and Vacuum.',
  start: 0, end: 50, ambient: 'backdoor', fog: [0x060203, 0.065], crumbs: true,
  plate: n => (n >= 50 ? '0' : '-' + (50 - n)),
  init() { this.time = 150; this.started = false; this.lastRush = 0; G.ui.timer(true); },
  cleanup() { G.ui.timer(false); G.ui.tint('haste', false); },
  addTime(game) {
    if (game.haste) { game.despawn(game.haste); G.ui.caption('Haste retreats... for now.', 2.5); G.ui.tint('haste', false); this.time = 60; }
    this.time = Math.min(this.time + 90, 420);
    G.ui.msg('+1:30', 1.5); G.audio.sfx('good');
  },
  build(game, n, at) {
    if (n === 0) return SP.bdStart(game, at);
    if (n === 50) return SP.finalRoom(game, at, n, G.THEMES.backdoor(), 'backdoor', 0xff9a70);
    const cfg = {
      theme: G.THEMES.backdoor(), kind: G.weighted({ hall: 3, room: 4, big: 1 }),
      locked: n > 2 && G.chance(0.2), dark: n > 3 && G.chance(0.3), vacuum: n > 3 && G.chance(0.09),
    };
    const r = G.buildStandard(game, n, at, cfg);
    if (G.chance(0.34)) SP.timeLever(game, r);
    if (r.dark && G.chance(0.45)) {
      const side = G.chance(0.5) ? r.xl + 0.25 : r.xr - 0.25;
      r.onEnter = () => game.spawn(new E.Gazer(r, 'lookman', r.l2w(side, 2.3, r.L * G.rand(0.4, 0.8))));
    }
    return r;
  },
  onEnter(game, room) { if (room.index === 0) G.ui.caption("Haste's clock is ticking. Pull green time levers to add time.", 5); },
  onDoorOpen(game, door) {
    this.started = true;
    const n = door.number;
    if (n > 3 && n < 50 && n - this.lastRush > 4 && !game.rush && G.chance(0.12)) { this.lastRush = n; game.spawn(new E.Rusher('blitz')); }
  },
  update(game, dt) {
    if (this.started && !game.haste && !game.escaping) {
      this.time -= dt;
      if (this.time <= 0) { this.time = 0; game.spawn(new E.Haste()); G.ui.tint('haste', true); }
    }
    G.ui.timerSet(this.time, !!game.haste);
    G.screechTick(game, dt, 0.05);
  },
};

/* ---------- Sub-floor: The Rooms ---------- */
FL.rooms = {
  id: 'rooms', name: 'The Rooms', tag: 'SUB-FLOOR', color: '#8ab4c8', face: 'a60', range: 'A-000 – A-1000',
  desc: 'A thousand grey rooms. Hide in lockers when A-60 and A-120 come screaming, and freeze when A-90 appears.',
  start: 0, end: 1000, ambient: 'rooms', fog: [0x030405, 0.07],
  plate: n => 'A-' + G.pad(n, 3),
  init() { this.last = 0; },
  build(game, n, at) {
    if (n === 1000) return SP.finalRoom(game, at, n, G.THEMES.rooms(), 'rooms', 0xffffff);
    const cfg = {
      theme: G.THEMES.rooms(), kind: n === 0 ? 'small' : G.weighted({ small: 4, hall: 3, room: 3, big: 1 }),
      noBackGap: n === 0, dark: n > 5 && G.chance(0.25),
    };
    const r = G.buildStandard(game, n, at, cfg);
    if (r.kind === 'big') {
      for (const [fx, fz] of [[0.3, 0.35], [0.7, 0.35], [0.3, 0.7], [0.7, 0.7]]) {
        const x = G.lerp(r.xl, r.xr, fx), z = r.L * fz;
        if (Math.abs(x) < 1.2) continue;
        r.box(x, r.H / 2, z, 0.8, r.H, 0.8, G.mat.roomsWall, { uv: 4 });
      }
    }
    return r;
  },
  onEnter(game, room) {
    game.hideLimit = 40;
    if (room.index >= 90 && !game.a90 && G.chance(0.05)) game.startA90();
  },
  onDoorOpen(game, door) {
    const n = door.number;
    if (n < 10 || n >= 1000 || game.rush || n - this.last < 4) return;
    if (G.chance(n >= 200 ? 0.09 : 0.07)) {
      this.last = n;
      game.spawn(new E.Rusher(n >= 200 && G.chance(0.35) ? 'a120' : 'a60'));
    }
  },
  update() {},
};

/* ---------- Sub-floor: The Outdoors ---------- */
FL.outdoors = {
  id: 'outdoors', name: 'The Outdoors', tag: 'SUB-FLOOR', color: '#7ac86a', face: 'monument', range: '0m – 600m',
  desc: 'Slip out of the Hotel into the moonlit gardens. Distance markers replace door numbers. Never take your eyes off the Monument.',
  start: 0, end: 20, ambient: 'outdoors', fog: [0x0a1222, 0.03], outdoor: true,
  plate: n => G.pad(n * 30, 4) + 'm',
  init() {},
  build(game, n, at) {
    if (n === 20) return SP.finalRoom(game, at, n, G.THEMES.garden(), 'outdoors', 0xffe0a0);
    const r = G.buildStandard(game, n, at, { theme: G.THEMES.garden(), kind: 'garden', noBackGap: n === 0 });
    if (n >= 2 && G.chance(0.55)) game.spawn(new E.Monument(r, r.l2w(G.rand(r.xl + 2, r.xr - 2), 0, G.rand(r.L * 0.55, r.L - 3))));
    if (n >= 1) for (let i = 0, k = G.randi(1, 4); i < k; i++) game.spawn(new E.Snare(r, r.l2w(G.rand(r.xl + 1.5, r.xr - 1.5), 0, G.rand(3, r.L - 3))));
    return r;
  },
  onEnter(game, room) { if (room.index === 0) G.ui.caption('THE OUTDOORS. The Monument only moves when you are not looking.', 5); },
  onDoorOpen() {},
  update() {},
};

G.FLOOR_ORDER = ['hotel', 'mines', 'backdoor', 'rooms', 'outdoors'];
})();
