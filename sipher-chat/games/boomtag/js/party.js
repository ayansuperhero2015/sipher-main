// Party mode: play Boom Tag with friends from Sipher.
//
// Sipher opens the game with window.SIPHER_PARTY = { id, name } and shares
// the Firebase sign-in, so this talks to the Realtime Database:
//   parties/{id}/meta            { host, game, run, mode (map id), roster: { uid: 1 } }
//   parties/{id}/world           written by the leader: setup (bots, spawns) and live (the match, 10x a second)
//   parties/{id}/players/{uid}   each player's own position and state
//   parties/{id}/looks/{uid}     avatars (games/shared/avatar.js)
//   parties/{id}/events/{run}    abilities sent to the leader; power-ups and knocks sent back
//
// The leader's game runs the match exactly like a solo game: the timer, who
// starts with the bomb, every pass, explosions, power-ups and the bots (it
// sees friends as puppets moved by their updates). Everyone else's game
// moves only its own player and shows the leader's match (G.netClient).
// Abilities that touch other players are carried out by the leader's game.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";
import { auth, rtdb } from "../../../js/firebase.js";

const PARTY = window.SIPHER_PARTY;
const SA = window.SipherAvatar;
const A = G.audio;
const SEND_MS = 100;
const STALE_MS = 15000;
const REMOTE_ABILITIES = new Set(["freeze", "shockwave", "decoy", "toss"]);
const $ = (id) => document.getElementById(id);
const root = (path) => ref(rtdb, `parties/${PARTY.id}/${path}`);
const TAB = Math.random().toString(36).slice(2, 10);
const r2 = (v) => Math.round(v * 100) / 100;

let me = null;
let meta = {};
let players = {};
let looks = {};
let world = {};
let myRun = 0;
let joinedAt = 0;
let launching = false;
let clockOffset = 0;
let stopEvents = null;
let liveAt = 0; // when the leader's last match update arrived
const serverNow = () => Date.now() + clockOffset;
const isHost = () => me && meta.host === me.uid;
const inMatch = () => myRun && G.match;

/* ---------- events ---------- */

function emit(ev) {
  if (!me || !myRun) return;
  push(root(`events/${myRun}`), { ...ev, by: me.uid, tab: TAB, at: serverTimestamp() }).catch(() => {});
}

function listenEvents(run) {
  if (stopEvents) stopEvents();
  stopEvents = onChildAdded(root(`events/${run}`), (snap) => {
    const ev = snap.val();
    if (run !== myRun || !ev || ev.tab === TAB || (ev.at || 0) < joinedAt - 1500) return;
    try {
      if (isHost() && ev.t === "abil") hostAbility(ev);
      // Power-ups and knocks only count when they come from the leader's game.
      else if (ev.to === me.uid && ev.by === meta.host && ev.t === "pow" && G.POWERUPS[ev.kind]) fromLeader(() => G.applyPowerup(G.player, ev.kind));
      else if (ev.to === me.uid && ev.by === meta.host && ev.t === "fx") applyFx(ev);
    } catch (err) {
      console.warn("Couldn't apply", ev, err);
    }
  });
}

/* ---------- who is who ---------- */

const keyOf = (a) => (a === G.player ? me?.uid : a.key);
const byKey = (k) => (k === me?.uid ? G.player : G.actors.find((a) => a.key === k) || null);

// Everything about other players arrives over the network, and the game
// shows names and colours inside HTML, so only safe values get through.
const safeName = (s) => String(s || "Friend").replace(/[<>&"'`\\]/g, "").slice(0, 20) || "Friend";
const safeAbility = (s) => (G.ABILITIES[s] ? s : "dash");
const safeHat = (s) => (G.HATS[s] ? s : "none");
const safeShirt = (c) => {
  if (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) return parseInt(c.slice(1), 16);
  return Number.isInteger(c) ? c & 0xffffff : 0x8a8a8a;
};
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function addPuppet(key, info) {
  const a = G.makeActor({
    name: safeName(info.name),
    ability: safeAbility(info.ability),
    hat: safeHat(info.hat),
    shirt: safeShirt(info.shirt),
    look: info.look || null,
  });
  a.key = key;
  a.puppet = true;
  a.remote = info.remote ? key : null;
  a.target = new G.V3();
  a.tyaw = 0;
  return a;
}

// Puppets glide to their latest position instead of running physics.
const realStep = G.stepActor;
G.stepActor = (a, dt) => {
  if (!a.puppet) return realStep(a, dt);
  const f = a.fx;
  for (const k of ["speed", "jump", "slow", "frozen", "stun", "invis"]) f[k] = Math.max(0, f[k] - dt);
  a.passCd = Math.max(0, a.passCd - dt);
  a.noBackT = Math.max(0, a.noBackT - dt);
  a.knockT = Math.max(0, a.knockT - dt);
  a.cd = Math.max(0, a.cd - dt);
  if (a.bomb) a.held += dt;
  const before = a.pos.clone();
  if (before.distanceTo(a.target) > 8) a.pos.copy(a.target);
  else a.pos.lerp(a.target, 1 - Math.exp(-dt * 14));
  const hs = Math.hypot(a.pos.x - before.x, a.pos.z - before.z) / Math.max(dt, 1e-3);
  a.grounded = Math.abs(a.target.y - a.pos.y) < 0.08 && !a.air;
  a.yaw += G.angleWrap(a.tyaw - a.yaw) * Math.min(1, dt * 14);
  const av = a.av;
  av.root.position.copy(a.pos);
  av.root.rotation.y = a.yaw;
  av.animate(dt, a.grounded ? hs : 0, a.grounded, a);
  av.ice.visible = f.frozen > 0;
  av.bubble.visible = !!f.shield;
  av.setOpacity(f.invis > 0 ? (G.player && G.player.alive && G.hdist(G.player.pos, a.pos) < 3 ? 0.25 : 0.04) : 1);
};

function movePuppetsFromPlayers() {
  for (const a of G.actors) {
    if (!a.remote) continue;
    const p = players[a.remote];
    if (!p || typeof p.x !== "number" || p.run !== myRun) continue;
    a.target.set(p.x, p.y, p.z);
    a.tyaw = p.yaw || 0;
    a.air = !p.g;
    if (p.inv) a.fx.invis = Math.max(a.fx.invis, 0.2);
    if (p.ab) a.ability = safeAbility(p.ab);
  }
}

/* ---------- the leader's game ---------- */

// A friend used an ability that touches other players: do it here.
function hostAbility(ev) {
  const a = byKey(ev.by);
  if (!a || !a.alive || !REMOTE_ABILITIES.has(ev.id)) return;
  a.ability = ev.id;
  a.pos.set(ev.x, ev.y, ev.z);
  a.target.copy(a.pos);
  a.input.x = ev.mx || 0;
  a.input.z = ev.mz || 0;
  a.aim.set(ev.ax || 0, 0, ev.az || 1);
  a.cd = 0;
  a.fx.frozen = a.fx.stun = 0;
  G.useAbility(a);
  a.input.x = a.input.z = 0;
}

// Power-ups a friend's puppet picks up go to that friend.
const realPowerup = G.applyPowerup;
let fromHost = false;
const fromLeader = (fn) => { fromHost = true; try { fn(); } finally { fromHost = false; } };
G.applyPowerup = (a, kind) => {
  if (G.netClient && !fromHost) return; // the leader decides pickups
  realPowerup(a, kind);
  if (a.remote && isHost()) emit({ t: "pow", to: a.remote, kind });
};

// Knocks, freezes and stuns that land on a friend's puppet are sent to them.
function sendPuppetHits() {
  for (const a of G.actors) {
    if (!a.remote) continue;
    const f = a.fx, last = a.lastSent || { knock: 0, frozen: 0, stun: 0 };
    const knock = a.knockT > last.knock + 0.05, frozen = f.frozen > last.frozen + 0.05, stun = f.stun > last.stun + 0.05;
    if (knock || frozen || stun) {
      emit({
        t: "fx", to: a.remote,
        v: knock ? [r2(a.vel.x), r2(a.vel.y), r2(a.vel.z)] : null, k: knock ? r2(a.knockT) : 0,
        fr: frozen ? r2(f.frozen) : 0, st: stun ? r2(f.stun) : 0,
      });
      a.vel.set(0, 0, 0);
    }
    a.lastSent = { knock: a.knockT, frozen: f.frozen, stun: f.stun };
  }
}

function applyFx(ev) {
  const p = G.player;
  if (!p || !p.alive) return;
  const cap = (v, m) => Math.max(-m, Math.min(m, num(v)));
  if (Array.isArray(ev.v)) { p.vel.set(cap(ev.v[0], 25), cap(ev.v[1], 25), cap(ev.v[2], 25)); p.knockT = cap(ev.k, 1); p.grounded = false; }
  if (ev.fr) { p.fx.frozen = Math.max(p.fx.frozen, cap(ev.fr, 3)); p.vel.set(0, p.vel.y, 0); G.ui.toast("Frozen"); A.frozen(p.pos); }
  if (ev.st) p.fx.stun = Math.max(p.fx.stun, cap(ev.st, 1));
}

// Flags: 1 alive, 2 bomb, 4 frozen, 8 shield, 16 invisible, 32 stunned.
function flagsOf(a) {
  return (a.alive ? 1 : 0) | (a.bomb ? 2 : 0) | (a.fx.frozen > 0 ? 4 : 0) | (a.fx.shield ? 8 : 0) | (a.fx.invis > 0 ? 16 : 0) | (a.fx.stun > 0 ? 32 : 0);
}

function sendLive() {
  const m = G.match;
  if (!m || !isHost() || !myRun) return;
  const acts = {};
  for (const a of G.actors) {
    const k = keyOf(a);
    if (!k) continue;
    acts[k] = [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z), r2(a.yaw), flagsOf(a), a.place || 0, a.passes, a.survived, a.grounded ? 1 : 0];
  }
  const live = {
    run: myRun, st: m.state, rd: m.round, fu: r2(m.fuse), mf: r2(m.maxFuse), t: r2(m.t), mod: G.mod.id || null, a: acts,
    pu: G.ent.pups.map((p) => [p.kind, r2(p.pos.x), r2(p.pos.y), r2(p.pos.z)]),
    tr: G.ent.traps.map((t) => [r2(t.pos.x), r2(t.pos.y), r2(t.pos.z)]),
    dc: G.ent.decoys.filter((d) => d.alive).map((d) => [r2(d.pos.x), r2(d.pos.y), r2(d.pos.z), r2(Math.atan2(d.dir.x, d.dir.z)), keyOf(d.owner) || ""]),
  };
  set(root("world/live"), live).catch(() => {});
}

/* ---------- everyone else's game ---------- */

// Our own use of an ability that touches others goes to the leader.
const realUse = G.useAbility;
G.useAbility = (a) => {
  if (!G.netClient || a !== G.player || !REMOTE_ABILITIES.has(a.ability)) return realUse(a);
  if (!a.alive || a.cd > 0 || a.fx.frozen > 0 || a.fx.stun > 0) return false;
  if (a.ability === "toss" && !a.bomb) { G.ui.toast("Only works while you hold the bomb!"); A.deny(); return false; }
  const aim = G.aimDir(a), mv = G.moveDir(a);
  emit({ t: "abil", id: a.ability, x: r2(a.pos.x), y: r2(a.pos.y), z: r2(a.pos.z), ax: r2(aim.x), az: r2(aim.z), mx: r2(mv.x), mz: r2(mv.z) });
  a.cd = G.ABILITIES[a.ability].cd;
  G.fx.puff(a.pos, 0xffffff, 8);
  return true;
};
// Passes happen in the leader's game only.
const realPass = G.passBomb;
G.passBomb = (...args) => (G.netClient ? false : realPass(...args));

let seen = null; // what we last showed, to announce changes
const meshes = { pu: new Map(), tr: new Map(), dc: new Map() };

function applyLive(dt) {
  const L = world.live, m = G.match;
  if (!L || L.run !== myRun || !m) return;
  const prev = seen || { st: L.st, rd: L.rd, flags: {}, count: 99 };
  m.state = L.st; m.round = L.rd; m.fuse = L.fu; m.maxFuse = L.mf || 1; m.t = L.t;
  const mod = G.MODS.find((x) => x.id === L.mod);
  G.mod = { id: L.mod || null, grav: mod?.grav || 1, speed: mod?.speed || 1 };
  const flags = {};
  for (const [k, raw] of Object.entries(L.a || {})) {
    const v = (Array.isArray(raw) ? raw : []).map(num);
    let a = byKey(k);
    if (!a) {
      const bot = (world.setup?.bots || []).find((b) => b[0] === k);
      const p = players[k];
      a = addPuppet(k, bot ? { name: bot[1], shirt: bot[2], hat: bot[3], ability: bot[4] } : { name: p?.name, look: looks[k], remote: true, shirt: SA.clean(looks[k]).shirt });
      a.pos.set(v[0], v[1], v[2]);
      a.target.copy(a.pos);
    }
    const f = v[4] | 0;
    flags[k] = f;
    a.place = v[5] | 0; a.passes = v[6] | 0; a.survived = v[7] | 0;
    if (a !== G.player) {
      // Friends' players come straight from their own updates; bots and the leader from the leader.
      if (!a.remote) { a.target.set(v[0], v[1], v[2]); a.tyaw = v[3]; a.air = !v[8]; }
      a.fx.frozen = f & 4 ? Math.max(a.fx.frozen, 0.2) : 0;
      a.fx.shield = !!(f & 8);
      if (f & 16) a.fx.invis = Math.max(a.fx.invis, 0.2);
    } else {
      a.fx.shield = !!(f & 8);
    }
    const alive = !!(f & 1), bomb = !!(f & 2);
    if (a.bomb !== bomb) {
      G.setBomb(a, bomb);
      if (bomb && a === G.player && m.state === "round") { A.gotBomb(); G.ui.flashBomb(); }
    }
    if (a.alive && !alive) explode(a);
    a.alive = alive;
  }
  // Announce what changed: passes, a new round, the countdown, the end.
  if (prev.flags) {
    const gave = Object.keys(flags).filter((k) => (prev.flags[k] & 2) && !(flags[k] & 2) && (flags[k] & 1));
    const got = Object.keys(flags).filter((k) => !(prev.flags[k] & 2) && (flags[k] & 2));
    if (L.st === "round" && prev.st === "round" && gave.length && got.length) {
      for (let i = 0; i < Math.min(gave.length, got.length); i++) {
        const from = byKey(gave[i]), to = byKey(got[i]);
        if (!from || !to) continue;
        A.pass(to.pos);
        G.ui.feed(`<b class="${from === G.player ? "me" : ""}">${from.name}</b><span class="arrow">→</span><b class="${to === G.player ? "me" : ""}">${to.name}</b>`, "bomb");
        if (from === G.player) G.ui.toast("Passed. Get away from them");
      }
    }
  }
  if (L.st === "round" && (prev.st !== "round" || L.rd !== prev.rd)) {
    if (G.player.alive && G.player.bomb) { A.gotBomb(); G.ui.flashBomb(); }
    else if (mod) { A.mod(); G.ui.announce(mod.name, mod.sub, 2.4, "mod"); }
    else { A.round(); G.ui.announce("ROUND " + L.rd, "The bomb is live. RUN!", 1.8); }
  }
  if (L.st === "intermission") {
    const c = Math.ceil(L.t);
    if (c !== prev.count && c <= 3 && c >= 1) { A.countdown(false); G.ui.announce(String(c), L.rd ? "Next round" : "Get ready", 0.8); }
    prev.count = c;
  }
  if (L.st === "round") {
    const iv = L.fu > 10 ? 1 : L.fu > 5 ? 0.5 : L.fu > 2 ? 0.25 : 0.12;
    if (m.lastBeep - L.fu >= iv || m.lastBeep < L.fu) { m.lastBeep = L.fu; A.tick(L.fu < 5); }
  }
  if (L.st === "over" && prev.st !== "over") endForUs();
  seen = { st: L.st, rd: L.rd, flags, count: prev.count };
  syncEntities(L);
}

function explode(a) {
  A.explode(a.pos); A.oof(a.pos);
  G.fx.explosion(a.pos); G.fx.debris(a.av, a.pos);
  a.av.root.visible = false;
  G.setBomb(a, false);
  G.ui.feed(`<b class="${a === G.player ? "me" : ""}">${a.name}</b> exploded`, "out");
  if (a === G.player) {
    a.vel.set(0, 0, 0);
    G.ui.announce("KABOOM!", "You held the bomb too long", 2.6, "bad");
    A.lose();
    G.specTarget = null;
    G.nextSpec();
  }
}

function endForUs() {
  const p = G.player;
  const winner = G.actors.find((a) => a.place === 1) || G.alive()[0] || null;
  if (winner) {
    winner.av.cheer = 99;
    G.specTarget = winner;
    G.ui.announce(winner === p ? "YOU WIN!" : winner.name + " WINS!", "Last one standing", 3, winner === p ? "win" : "");
    if (winner === p) A.win();
  }
  const survive = p.survived * 10, pass = p.passes * 3, bonus = { 1: 100, 2: 50, 3: 25 }[p.place] || 0;
  const result = { place: p.place, survive, pass, bonus, total: survive + pass + bonus };
  G.save.coins += result.total; G.save.games++;
  if (p.place === 1) G.save.wins++;
  G.persist();
  G.match.result = result;
  setTimeout(() => {
    if (!G.match || G.match.shown) return;
    G.match.shown = true;
    if (document.pointerLockElement) { G.leaving = true; document.exitPointerLock(); G.leaving = false; }
    G.ui.showEnd(result);
  }, 3000);
}

// Power-ups, traps and decoys as the leader's game has them (shown only:
// the leader's game decides pickups, springs traps and pops decoys).
const pupGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
function pupMesh(kind, x, y, z) {
  const P = G.POWERUPS[kind] || G.POWERUPS.speed;
  const g = new THREE.Group();
  const cube = new THREE.Mesh(pupGeo, new THREE.MeshBasicMaterial({ map: G.iconTex(kind, "#" + new THREE.Color(P.color).getHexString()) }));
  g.add(cube);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex(), color: P.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  glow.scale.set(2.4, 2.4, 1);
  g.add(glow);
  g.position.set(x, y + 1, z);
  G.scene.add(g);
  const p = { kind, mesh: g, cube, pos: new G.V3(x, y, z), life: 1e9, t: Math.random() * 6 };
  G.ent.pups.push(p);
  return { mesh: g, done: () => { const i = G.ent.pups.indexOf(p); if (i >= 0) G.ent.pups.splice(i, 1); } };
}

function syncEntities(L) {
  const keep = (kind, list, keyOfItem, make) => {
    const map = meshes[kind], live = new Set();
    for (const it of list || []) {
      const k = keyOfItem(it);
      live.add(k);
      if (!map.has(k)) map.set(k, make(it));
    }
    for (const [k, obj] of map) if (!live.has(k)) { G.scene.remove(obj.mesh); if (obj.done) obj.done(); map.delete(k); }
  };
  keep("pu", L.pu, (it) => it.join(","), ([kind, x, y, z]) => pupMesh(kind, x, y, z));
  keep("tr", L.tr, (it) => it.join(","), ([x, y, z]) => {
    G.ent.addTrap({ pos: new G.V3(x, y, z) });
    return { mesh: G.ent.traps.pop().mesh };
  });
  // Decoys move, so they're known by whose decoy they are.
  keep("dc", L.dc, (d) => d[4] || "?", (d) => {
    const owner = byKey(d[4]);
    const av = owner ? G.makeAvatar({ shirt: owner.shirt, hat: owner.hat, look: owner.remote ? looks[owner.remote] : owner === G.player ? SA.cfg : null })
      : G.makeAvatar({ shirt: 0x8a8a8a, hat: "none" });
    if (owner) av.drawTag(owner.name, false, false);
    G.scene.add(av.root);
    return { mesh: av.root, av };
  });
  for (const d of L.dc || []) {
    const obj = meshes.dc.get(d[4] || "?");
    if (obj) { obj.av.root.position.set(d[0], d[1], d[2]); obj.av.root.rotation.y = d[3]; obj.av.animate(1 / 60, 9, true, null); }
  }
}

// Client games don't pick up power-ups themselves.
const realEntUpdate = G.ent.update;
G.ent.update = (dt, live) => {
  if (!G.netClient) return realEntUpdate(dt, live);
  for (const p of G.ent.pups) {
    p.t += dt;
    p.mesh.position.y = p.pos.y + 1 + Math.sin(p.t * 3) * 0.15;
    p.cube.rotation.y += dt * 1.8;
  }
};

/* ---------- the game loop ---------- */

const realUpdate = G.update;
G.update = (dt, sim) => {
  if (inMatch()) {
    movePuppetsFromPlayers();
    if (G.netClient) applyLive(dt);
    // A party match keeps running while you look at the pause menu.
    const paused = G.paused;
    G.paused = false;
    try {
      realUpdate(dt, sim);
    } finally {
      G.paused = paused;
    }
    if (isHost()) sendPuppetHits();
    if (G.netClient && G.match && serverNow() - liveAt > 12000 && G.match.state !== "over") {
      note("The party leader left the match.");
      G.quitToMenu();
    }
    return;
  }
  return realUpdate(dt, sim);
};
setInterval(sendLive, SEND_MS);

const realFast = G.fastForward;
G.fastForward = () => (inMatch() ? note("You can't skip ahead in a party match.") : realFast());

/* ---------- starting matches together ---------- */

function lobbyPlayers() {
  const now = serverNow();
  return Object.entries(players)
    .filter(([, p]) => now - (p.at || 0) < STALE_MS)
    .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
}

const realStart = G.startMatch;
G.startMatch = () => {
  if (launching) return realStart();
  if (!me) return note("Still connecting to the party…");
  if (!isHost()) return note("Only the party leader starts the match. Hang tight!");
  // The leader's game sets up the match like a solo one, then adds friends.
  G.netClient = false;
  launching = true;
  try { realStart(); } finally { launching = false; }
  const run = (meta.run || 0) + 1;
  myRun = run;
  joinedAt = serverNow();
  const roster = { [me.uid]: 1 };
  const spawns = {};
  for (const [uid, p] of lobbyPlayers()) {
    if (uid === me.uid) continue;
    roster[uid] = 1;
    const a = addPuppet(uid, { name: p.name, look: looks[uid], remote: true, shirt: SA.clean(looks[uid]).shirt, ability: p.ab });
    const n = G.nav.randomNode();
    G.placeAt(a, n);
    a.target.copy(a.pos);
    spawns[uid] = [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z)];
  }
  const bots = G.actors.filter((a) => a.bot).map((a, i) => { a.key = "b" + i; return [a.key, a.name, a.shirt, a.hat || "none", a.ability]; });
  const changes = {
    "meta/run": run,
    "meta/mode": G.match.def.id,
    "meta/roster": roster,
    "world/setup": { run, map: G.match.def.id, bots, spawns },
  };
  if (meta.run) changes[`events/${meta.run}`] = null;
  update(ref(rtdb, `parties/${PARTY.id}`), changes).catch((err) => note("Couldn't start: " + err.message));
  listenEvents(run);
  sendLive();
};

function launchAsGuest() {
  const setup = world.setup;
  if (!setup || setup.run !== meta.run) return; // the setup arrives right after
  myRun = meta.run;
  if (!meta.roster?.[me.uid]) return note("A match started without you. You'll be in the next one.");
  joinedAt = serverNow();
  liveAt = serverNow();
  const def = G.MAPS.find((d) => d.id === setup.map) || G.MAPS[0];
  G.netClient = true;
  G.camera.clearViewOffset();
  G.mod = { id: null, grav: 1, speed: 1 };
  G.buildMap(def); G.buildNav();
  G.clearActors(); G.ent.clear(); G.fx.clear();
  for (const m of Object.values(meshes)) m.clear();
  seen = null;
  const s = G.save;
  G.player = G.makeActor({ name: "You", isPlayer: true, ability: s.ability, hat: s.hat, shirt: G.SHIRTS[s.shirt] });
  const sp = setup.spawns?.[me.uid];
  if (sp) G.placeAt(G.player, { x: sp[0], y: sp[1], z: sp[2] });
  else G.placeAt(G.player, G.nav.randomNode());
  G.cam.yaw = G.player.yaw = Math.atan2(-G.player.pos.x, -G.player.pos.z);
  G.match = { state: "intermission", t: 5, round: 0, fuse: 0, maxFuse: 1, time: 0, lastBeep: 0, lastCount: 99, over: false, def };
  G.specTarget = null; G.paused = false; G.leaving = false;
  $("menu").classList.add("hidden");
  $("end").classList.add("hidden");
  G.ui.startHud();
  G.ui.announce(def.name, "First bomb drops in 5…", 2.5);
  G.ui.feed(`Welcome to <b>${def.name}</b>! ${def.desc}`);
  G.lock();
  listenEvents(myRun);
}

function maybeLaunch() {
  if (isHost() || !meta.run || meta.run <= myRun) return;
  if (G.match && G.match.state !== "over" && G.netClient === false) return;
  launchAsGuest();
}

const realQuit = G.quitToMenu;
G.quitToMenu = (...args) => {
  G.netClient = false;
  return realQuit(...args);
};

/* ---------- sending our own state ---------- */

let lastSent = "";
let sendAt = 0;
const joinedTime = Date.now();

function myState() {
  const p = G.player;
  const s = {
    name: String(PARTY.name || "Player").slice(0, 64),
    run: myRun,
    state: inMatch() ? "play" : "lobby",
    joined: joinedTime,
    ab: G.save.ability,
  };
  if (inMatch() && p) {
    Object.assign(s, {
      x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), yaw: r2(p.yaw),
      g: p.grounded ? 1 : 0, inv: p.fx.invis > 0 ? 1 : 0, al: p.alive ? 1 : 0,
    });
  }
  return s;
}

function send(force) {
  if (!me) return;
  const s = myState();
  const key = JSON.stringify(s);
  if (!force && key === lastSent && Date.now() - sendAt < 5000) return;
  lastSent = key;
  sendAt = Date.now();
  set(root(`players/${me.uid}`), { ...s, at: serverTimestamp() }).catch(() => {});
}
setInterval(send, SEND_MS);

// Friends who left mid-match are out.
setInterval(() => {
  if (!isHost() || !inMatch()) return;
  const now = serverNow();
  for (const a of G.actors) {
    if (!a.remote || !a.alive) continue;
    const p = players[a.remote];
    const settled = now - joinedAt > 8000;
    if (!p || now - (p.at || 0) > STALE_MS || (settled && (p.run !== myRun || p.state !== "play"))) {
      a.alive = false;
      if (a.bomb) G.setBomb(a, false);
      a.av.root.visible = false;
      a.place = G.alive().length + 1;
      G.ui.feed(`<b>${a.name}</b> left the match`, "out");
    }
  }
}, 1000);

/* ---------- party panel ---------- */

const css = document.createElement("style");
css.textContent = `
#party { position: fixed; top: 12px; left: 12px; z-index: 60; width: 230px; padding: 10px 12px;
  background: rgba(18, 18, 18, 0.86); border: 2px solid #ffd400; color: #f2f2f0;
  font: 600 13px/1.35 Barlow, 'Segoe UI', sans-serif; pointer-events: none; }
#party b.t { display: block; font: 16px Anton, sans-serif; letter-spacing: 0.06em; color: #ffd400; margin-bottom: 6px; }
#party .p { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
#party .dot { width: 10px; height: 10px; flex-shrink: 0; }
#party .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#party .s { color: #b8b8b0; font-size: 12px; white-space: nowrap; }
#party .hint { margin-top: 6px; color: #b8b8b0; font-size: 12px; }
#party-note { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 61; max-width: 80vw;
  padding: 9px 16px; background: rgba(18, 18, 18, 0.92); border: 2px solid #ffd400; color: #f2f2f0;
  font: 700 14px Barlow, 'Segoe UI', sans-serif; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
#party-note.on { opacity: 1; }
body:has(#hud:not(.hidden)) #party { top: auto; bottom: 110px; opacity: 0.85; }`;
document.head.appendChild(css);
const panel = document.createElement("div");
panel.id = "party";
const noteEl = document.createElement("div");
noteEl.id = "party-note";
document.body.append(panel, noteEl);

let noteTimer = 0;
function note(text) {
  noteEl.textContent = text;
  noteEl.classList.add("on");
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => noteEl.classList.remove("on"), 4500);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function renderPanel() {
  const list = lobbyPlayers();
  panel.innerHTML =
    `<b class="t">PARTY · ${list.length} PLAYER${list.length === 1 ? "" : "S"}</b>` +
    list
      .map(([uid, p]) => {
        const status = p.state === "play" ? (p.al ? "alive" : "out") : "in the lobby";
        return (
          `<div class="p"><span class="dot" style="background:${esc(SA.clean(looks[uid]).shirt)}"></span>` +
          `<span class="n">${esc(p.name || "Friend")}${uid === meta.host ? " 👑" : ""}${uid === me?.uid ? " (you)" : ""}</span>` +
          `<span class="s">${status}</span></div>`
        );
      })
      .join("") +
    (!G.match
      ? `<div class="hint">${isHost() ? "You lead: pick a map and the number of bots, then press Play." : "Waiting for the leader to press Play…"}</div>`
      : "");
}
setInterval(renderPanel, 1000);

/* ---------- connecting ---------- */

onValue(ref(rtdb, ".info/serverTimeOffset"), (s) => (clockOffset = Number(s.val()) || 0), () => {});

panel.innerHTML = `<b class="t">PARTY</b><div class="hint">Connecting…</div>`;
const stopAuth = onAuthStateChanged(auth, (user) => {
  if (!user) {
    panel.innerHTML = `<b class="t">PARTY</b><div class="hint">Sign in to Sipher in this browser to play together.</div>`;
    return;
  }
  stopAuth();
  me = user;
  onDisconnect(root(`players/${me.uid}`)).remove().catch(() => {});
  send(true);
  const sendLook = () => set(root(`looks/${me.uid}`), SA.cfg).catch(() => {});
  sendLook();
  addEventListener("sipher-avatar", sendLook);
  onValue(root("looks"), (snap) => {
    looks = snap.val() || {};
    for (const a of G.actors) if (a.remote && looks[a.remote]) G.swapLook(a, looks[a.remote]);
  });
  onValue(root("world"), (snap) => {
    world = snap.val() || {};
    if (world.live) liveAt = serverNow();
    maybeLaunch();
  });
  onValue(
    root("meta"),
    (snap) => {
      if (!snap.exists()) {
        panel.innerHTML = `<b class="t">PARTY</b><div class="hint">This party doesn't exist anymore.</div>`;
        return;
      }
      meta = snap.val();
      maybeLaunch();
      renderPanel();
    },
    (err) => (panel.innerHTML = `<b class="t">PARTY</b><div class="hint">Couldn't join: ${esc(err.message)}</div>`),
  );
  onValue(root("players"), (snap) => {
    players = snap.val() || {};
    renderPanel();
  });
});
