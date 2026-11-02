// Party mode: play DOORS together with friends from Sipher.
//
// Sipher opens the game with window.SIPHER_PARTY = { id, name } and shares
// the Firebase sign-in (same site), so this talks to the Realtime Database:
//   parties/{id}/meta                 { host, game, createdAt, floor, seed, run }
//   parties/{id}/players/{uid}        live state: position, room, crouch, emote…
//   parties/{id}/looks/{uid}          avatar (js/avatar.js)
//   parties/{id}/events/{run}/{key}   world changes: { t: 'door' | 'use', r, i, by, at }
//
// How the run stays shared:
// - Everyone builds the same rooms: room generation is seeded from the run.
// - Doors and world changes (keys, gold, drawers, levers, boxes…) are logged
//   as events and replayed on every player's game, without giving them the
//   loot. A door anyone opens is open for everyone.
// - Monster rolls happen when a door opens, seeded by that door, so Rush,
//   Ambush, Eyes… come for the whole party at the same moment. Each game
//   checks its own player: whoever isn't hiding gets caught.
// - Every game keeps the rooms up to the furthest player loaded, so Rush
//   runs the same route for everyone.
// - When you die you can spectate a friend until the run ends.
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
const SEND_MS = 150; // position updates, about 7 a second
const STALE_MS = 15000; // a player who stopped updating has left
const AHEAD_MAX = 6; // rooms loaded ahead for a friend who ran on
const Game = G.game;
const V3 = THREE.Vector3;
const P = G.player;
const root = (path) => ref(rtdb, `parties/${PARTY.id}/${path}`);

let me = null;
let meta = {};
let players = {};
let looks = {};
let myRun = 0; // the last run this player joined (0 = none yet)
let runSeed = 0; // that run's seed
let joinedAt = 0; // server time we joined it; older events are history
let pending = null; // a run the leader started while we were mid-run
let launching = false;
let clockOffset = 0;
let stopEvents = null;
const stash = new Map(); // events for rooms we haven't built yet

const serverNow = () => Date.now() + clockOffset;
// This tab's own events come back to it; skip those (but not ones from an
// earlier tab of ours, e.g. after a reload, which we need to catch up on).
const TAB = Math.random().toString(36).slice(2, 10);

/* ---------- seeded rooms ---------- */

// mulberry32: tiny, fast, good enough for level generation.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Runs fn with the game's randomness (G.random) seeded from the run and
// `key`, so every player gets the same result for the same key.
function seeded(key, fn) {
  if (!myRun || Game.state === "menu") return fn();
  const real = G.random;
  G.random = rng(hash(`${runSeed}:${myRun}:${key}`));
  try {
    return fn();
  } finally {
    G.random = real;
  }
}

const doorKey = (door) => `${door.room.index}:${door.room.doors.indexOf(door)}`;

const realGenNext = Game.genNext;
Game.genNext = function () {
  const last = this.rooms[this.rooms.length - 1];
  const key = last ? `room:${last.index}>${last.nextIndex ?? ""}` : "room:first";
  const room = seeded(key, () => realGenNext.call(this));
  if (room) {
    if (room.onEnter) {
      const enter = room.onEnter;
      room.onEnter = (...args) => seeded(`renter:${room.index}`, () => enter.apply(room, args));
    }
    // Catch up on what friends already did in this room.
    const waiting = stash.get(room.index);
    if (waiting) {
      stash.delete(room.index);
      for (const ev of waiting) apply(ev, true);
    }
  }
  return room;
};
for (const f of Object.values(G.FLOORS)) {
  if (f.init) {
    const init = f.init;
    f.init = (...args) => seeded("init", () => init.apply(f, args));
  }
  if (f.onEnter) {
    const enter = f.onEnter;
    f.onEnter = (g, room, ...rest) => seeded(`enter:${room?.index}`, () => enter.call(f, g, room, ...rest));
  }
  if (f.onDoorOpen) {
    const open = f.onDoorOpen;
    f.onDoorOpen = (g, door, ...rest) => seeded(`door:${doorKey(door)}`, () => open.call(f, g, door, ...rest));
  }
}

// Builds rooms ahead until room n exists (or the floor ends).
function ensureRooms(n) {
  if (!Game.rooms.length) return;
  let guard = 0;
  while (Game.rooms[Game.rooms.length - 1].index < n && guard++ < AHEAD_MAX + 2) if (!Game.genNext()) break;
}

/* ---------- sharing the world ---------- */

let replaying = false; // applying a friend's change: don't log it again
let remote = false; // ...and don't hand out its rewards

function emit(ev) {
  if (replaying || !me || !myRun || Game.state !== "play") return;
  push(root(`events/${myRun}`), { ...ev, by: me.uid, tab: TAB, at: serverTimestamp() }).catch(() => {});
}

// Doors: any door that opens on our side is logged.
const realOpen = G.Door.prototype.open;
G.Door.prototype.open = function (...args) {
  const was = this.isOpen;
  const out = realOpen.apply(this, args);
  if (!was && this.isOpen) emit({ t: "door", r: this.room.index, i: this.room.doors.indexOf(this) });
  return out;
};

// Interactions that change the world for everyone. Personal ones (hiding,
// reading, puzzles, shops) stay on your own game; whatever a puzzle unlocks
// reaches everyone through the door it opens.
const SHARED =
  /^(Take (gold|key|pizza|bandage|salvage)|Open|Open container|Search box|Smash TV|Pull Fire Alarm|Emergency Override)$|lever/i;
const realAddInter = G.Room.prototype.addInter;
G.Room.prototype.addInter = function (pos, label, use, r) {
  const room = this;
  const it = realAddInter.call(this, pos, label, (...args) => {
    const lab = it.label() || "";
    const out = use(...args);
    if (!it.door && SHARED.test(lab)) emit({ t: "use", r: room.index, i: room.inter.indexOf(it) });
    return out;
  }, r);
  return it;
};

// While replaying a friend's pickup, rewards and messages are swallowed.
function quiet(obj, name, result) {
  const real = obj[name];
  obj[name] = function (...args) {
    return remote ? result : real.apply(this, args);
  };
}
quiet(G.Inv.prototype, "add", true);
for (const name of ["addGold", "lootDrawer", "noise", "scare", "startChannel"]) quiet(Game, name);
for (const name of ["msg", "caption"]) quiet(G.ui, name);
quiet(G.audio, "sfx");

// past: the event happened before we joined or built that room, so it only
// sets the room's state (no sounds, no monster rolls).
function apply(ev, past) {
  if (!ev || ev.tab === TAB || Game.state === "menu") return;
  const room = Game.roomByIndex(ev.r);
  if (!room) {
    const front = Game.rooms[Game.rooms.length - 1]?.index ?? -1;
    if (ev.r > front) {
      if (!stash.has(ev.r)) stash.set(ev.r, []);
      stash.get(ev.r).push(ev);
    }
    return;
  }
  replaying = true;
  try {
    if (ev.t === "door") {
      const d = room.doors[ev.i];
      if (!d || d.isOpen) return;
      d.locked = d.padlock = d.sealed = d.fake = false;
      if (d.lockMesh) {
        d.pivot.remove(d.lockMesh);
        d.lockMesh = null;
      }
      if (past) {
        d.isOpen = true;
        d.target = d.ang = -1.75;
        d.col.on = false;
      } else {
        ensureRooms(room.index + 1);
        d.open();
      }
    } else if (ev.t === "use") {
      const it = room.inter[ev.i];
      if (!it || it.door || !it.label()) return;
      remote = true;
      try {
        it.use();
      } finally {
        remote = false;
      }
    }
  } catch (err) {
    console.warn("Couldn't replay", ev, err);
  } finally {
    replaying = false;
  }
}

function listenEvents(run) {
  if (stopEvents) stopEvents();
  stash.clear();
  stopEvents = onChildAdded(root(`events/${run}`), (snap) => {
    const ev = snap.val();
    if (run !== myRun) return;
    apply(ev, (ev.at || 0) < joinedAt - 1500);
  });
}

/* ---------- starting runs together ---------- */

const realStart = Game.start;
// Picking a floor (the menu, "Try again", "Continue") asks the party to
// start it; the run begins for everyone when the party agrees.
Game.start = function (id) {
  if (launching) return realStart.call(this, id);
  if (!me) return note("Still connecting to the party…");
  if (meta.host !== me.uid) return note("Only the party leader picks the floor.");
  const run = (meta.run || 0) + 1;
  const changes = {
    "meta/floor": id,
    "meta/seed": Math.floor(Math.random() * 2 ** 31), // not G.random: this must differ every run
    "meta/run": run,
  };
  if (meta.run) changes[`events/${meta.run}`] = null; // the old run's log
  update(ref(rtdb, `parties/${PARTY.id}`), changes).catch((err) => note("Couldn't start the run: " + err.message));
};

function launch(run) {
  pending = null;
  stopSpectating();
  myRun = run.run;
  runSeed = run.seed;
  joinedAt = serverNow();
  launching = true;
  try {
    realStart.call(Game, run.floor);
  } finally {
    launching = false;
  }
  listenEvents(run.run);
  note(`Run ${run.run}: ${G.FLOORS[run.floor]?.name || run.floor}. Stick together!`);
}

function maybeLaunch() {
  if (!meta.run || meta.run <= myRun || !G.FLOORS[meta.floor]) return;
  const run = { run: meta.run, floor: meta.floor, seed: meta.seed };
  // Don't yank anyone out of a run they're still playing.
  if (Game.state === "play") {
    if (pending?.run !== run.run) note("The leader started a new run. Finish or quit this one to join it.");
    pending = run;
    return;
  }
  launch(run);
}

const realToLobby = Game.toLobby;
Game.toLobby = function (...args) {
  stopSpectating();
  const out = realToLobby.apply(this, args);
  if (pending) launch(pending);
  else maybeLaunch();
  return out;
};

// Keep the rooms up to the furthest friend loaded (see the top).
const realUpdate = Game.update;
Game.update = function (dt) {
  realUpdate.call(this, dt);
  if (this.state === "play" && this.cur) ensureRooms(Math.min(partyFront(), this.cur.index + AHEAD_MAX) + 1);
};

function teammates() {
  const now = serverNow();
  return Object.entries(players).filter(
    ([uid, p]) => uid !== me?.uid && p.run === myRun && now - (p.at || 0) < STALE_MS,
  );
}
function partyFront() {
  let front = -Infinity;
  for (const [, p] of teammates()) if (p.state === "play" && typeof p.room === "number") front = Math.max(front, p.room);
  return front;
}

// Remember what killed us, for the party list.
const realKill = Game.kill;
Game.kill = function (source, ...rest) {
  const before = this.state;
  const out = realKill.call(this, source, ...rest);
  if (before === "play" && this.state === "dead") this.lastDeath = source;
  return out;
};

/* ---------- emotes ---------- */

let emote = null; // { id, n, at }
let emoteCount = 0;
const realOnKey = G.onKey;
G.onKey = (e) => {
  if (Game.state === "play" && !Game.paused && !G.ui.modalOpen && !P.hiding) {
    const hit = Object.entries(G.avatar.EMOTES).find(([, [key]]) => key === e.code);
    if (hit) {
      emote = { id: hit[0], n: ++emoteCount, at: performance.now() };
      note(`You ${{ wave: "waved", dance: "danced", point: "pointed" }[hit[0]]}.`);
      send(true);
    }
  }
  return realOnKey(e);
};

/* ---------- other players' avatars ---------- */

const avatars = new Map(); // uid -> { model, tag, target, yaw, speed, look, emote, emoteN, emoteAt }

function nameTag(text) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const x = c.getContext("2d");
  x.font = "600 30px Oswald, sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillStyle = "rgba(0,0,0,0.55)";
  const w = Math.min(250, x.measureText(text).width + 24);
  x.fillRect(128 - w / 2, 12, w, 40);
  x.fillStyle = "#f3e6c8";
  x.fillText(text, 128, 33, 230);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(1.2, 0.3, 1);
  s.renderOrder = 20;
  return s;
}

function dropAvatar(uid) {
  const a = avatars.get(uid);
  if (!a) return;
  G.scene.remove(a.group);
  G.avatar.dispose(a.model);
  a.tag.material.map.dispose();
  a.tag.material.dispose();
  avatars.delete(uid);
}

function avatarFor(uid, p) {
  const look = JSON.stringify(looks[uid] || null);
  let a = avatars.get(uid);
  if (a && a.look === look && a.name === p.name) return a;
  const old = a;
  const group = new THREE.Group();
  const model = G.avatar.build(looks[uid]);
  const tag = nameTag(p.name || "Friend");
  tag.position.y = 2.25;
  group.add(model, tag);
  G.scene.add(group);
  a = { group, model, tag, look, name: p.name, target: new V3(), yaw: 0, speed: 0, emote: null, emoteN: 0, emoteAt: 0 };
  if (old) {
    group.position.copy(old.group.position);
    group.rotation.y = old.group.rotation.y;
    dropAvatar(uid);
  } else if (typeof p.x === "number") group.position.set(p.x, p.y, p.z);
  avatars.set(uid, a);
  return a;
}

function syncAvatars() {
  const inRun = (Game.state === "play" || spectating) && myRun;
  const now = serverNow();
  for (const [uid, p] of Object.entries(players)) {
    if (uid === me?.uid) continue;
    const show =
      inRun && p.run === myRun && (p.state === "play" || p.state === "dead") &&
      !p.hide && now - (p.at || 0) < STALE_MS && typeof p.x === "number";
    if (!show) {
      const a = avatars.get(uid);
      if (a) a.group.visible = false;
      continue;
    }
    const a = avatarFor(uid, p);
    a.group.visible = true;
    a.target.set(p.x, p.y, p.z);
    a.yaw = p.yaw || 0;
    a.crouch = !!p.crouch;
    a.dead = p.state === "dead";
    a.tag.visible = !a.dead;
    if (p.em && p.em.n !== a.emoteN) {
      a.emoteN = p.em.n;
      a.emote = p.em.id;
      a.emoteAt = performance.now();
    }
  }
  for (const uid of avatars.keys()) if (!players[uid]) dropAvatar(uid);
}

/* ---------- spectating ---------- */

let spectating = null; // uid we're watching
let lastScreen = null; // { kind: 'death' | 'win', info } to go back to
const specBar = document.createElement("div");
specBar.id = "party-spec";
specBar.className = "hidden";

function alive() {
  return teammates().filter(([, p]) => p.state === "play");
}

function startSpectating(uid) {
  const list = alive();
  if (!list.length) return note("Nobody left to watch.");
  spectating = uid && list.some(([u]) => u === uid) ? uid : list[0][0];
  document.getElementById("death").classList.add("hidden");
  document.getElementById("win").classList.add("hidden");
  specBar.classList.remove("hidden");
  syncAvatars();
}

function stopSpectating(showScreen) {
  if (!spectating) return;
  spectating = null;
  specBar.classList.add("hidden");
  if (showScreen && lastScreen) document.getElementById(lastScreen.kind).classList.remove("hidden");
}

function nextSpectate() {
  const list = alive().map(([u]) => u);
  if (!list.length) return stopSpectating(true);
  spectating = list[(list.indexOf(spectating) + 1) % list.length];
}

addEventListener("keydown", (e) => {
  if (!spectating) return;
  if (e.code === "Escape") stopSpectating(true);
  else if (e.code === "Space" || e.code === "KeyE") nextSpectate();
});
specBar.addEventListener("click", nextSpectate);

// A Spectate button on the death and win screens.
for (const kind of ["death", "win"]) {
  const real = G.ui[kind];
  G.ui[kind] = (info) => {
    real(info);
    lastScreen = { kind, info };
    const btns = document.querySelector(`#${kind} .btns`);
    if (!btns || !alive().length) return;
    const b = document.createElement("button");
    b.className = "btn ghost";
    b.textContent = "Spectate friends";
    b.onclick = () => startSpectating();
    btns.prepend(b);
  };
}

/* ---------- per frame ---------- */

let lastFrame = performance.now();
const behind = new V3();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const k = 1 - Math.exp(-dt * 12);
  for (const a of avatars.values()) {
    if (!a.group.visible) continue;
    const before = a.group.position.clone();
    a.group.position.lerp(a.target, k);
    a.speed = G.lerp(a.speed, before.distanceTo(a.group.position) / Math.max(dt, 1e-3), Math.min(1, dt * 8));
    let d = a.yaw - a.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    a.group.rotation.y += d * k;
    if (a.emote && now - a.emoteAt > G.avatar.EMOTES[a.emote][2] * 1000) a.emote = null;
    G.avatar.animate(a.model, dt, {
      speed: a.speed, crouch: a.crouch, dead: a.dead,
      emote: a.emote, emoteT: (now - a.emoteAt) / 1000,
    });
  }
  if (spectating) {
    const a = avatars.get(spectating);
    const p = players[spectating];
    if (!a || !p || p.run !== myRun || p.state !== "play") nextSpectate();
    else {
      // Keep their part of the hotel built, moving and lit.
      if (typeof p.room === "number") ensureRooms(p.room + 1);
      for (const r of Game.rooms) r.update(dt);
      for (const e of Game.ents) {
        if (e.dead) continue;
        try {
          e.update(dt);
        } catch {
          // An entity aimed at our (dead) player; it just stops.
        }
      }
      const yaw = a.group.rotation.y;
      behind.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(2.4);
      G.camera.position.copy(a.group.position).add(behind).add(new V3(0, 2.0, 0));
      G.camera.lookAt(a.group.position.x, a.group.position.y + 1.5, a.group.position.z);
      specBar.innerHTML = `Spectating <b>${esc(p.name || "Friend")}</b> · ${esc(statusOf(p))}<small>Click or Space: next friend · Esc: back</small>`;
    }
  }
}
requestAnimationFrame(animate);

/* ---------- sending our own state ---------- */

const round = (v) => Math.round(v * 100) / 100;
let lastSent = "";
let sendAt = 0;

function myState() {
  const s = { name: PARTY.name, run: myRun, state: Game.state === "menu" ? "lobby" : Game.state };
  if (Game.state === "play" || (Game.state === "dead" && myRun)) {
    Object.assign(s, {
      x: round(P.pos.x), y: round(P.pos.y), z: round(P.pos.z),
      yaw: round(P.yaw), room: Game.cur?.index ?? null, hide: !!P.hiding, crouch: !!P.crouch,
    });
  }
  if (emote && performance.now() - emote.at < 6000) s.em = { id: emote.id, n: emote.n };
  if (Game.state === "dead") s.by = Game.lastDeath || null;
  return s;
}

function send(force) {
  if (!me) return;
  const s = myState();
  const key = JSON.stringify(s);
  // Still send now and then, so friends can tell we haven't left.
  if (!force && key === lastSent && Date.now() - sendAt < 5000) return;
  lastSent = key;
  sendAt = Date.now();
  set(root(`players/${me.uid}`), { ...s, at: serverTimestamp() }).catch(() => {});
}
setInterval(send, SEND_MS);

function sendLook() {
  if (me) set(root(`looks/${me.uid}`), G.avatar.cfg).catch(() => {});
}
addEventListener("doors-avatar", sendLook);

/* ---------- party panel ---------- */

const css = document.createElement("style");
css.textContent = `
#party { position: fixed; top: 12px; right: 12px; z-index: 60; width: 230px; padding: 10px 12px;
  background: rgba(10, 8, 6, 0.78); border: 1px solid rgba(216, 180, 106, 0.35); border-radius: 10px;
  color: #ece4d2; font: 13px/1.35 'Segoe UI', sans-serif; pointer-events: none; }
#party b.t { display: block; font: 600 14px Oswald, sans-serif; letter-spacing: 0.08em; color: #d8b46a; margin-bottom: 6px; }
#party .p { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
#party .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
#party .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#party .s { color: #9a907c; font-size: 12px; white-space: nowrap; }
#party .hint { margin-top: 6px; color: #9a907c; font-size: 12px; }
#party-note { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 61; max-width: 80vw;
  padding: 8px 14px; border-radius: 8px; background: rgba(10, 8, 6, 0.85); border: 1px solid rgba(216, 180, 106, 0.4);
  color: #ece4d2; font: 14px 'Segoe UI', sans-serif; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
#party-note.on { opacity: 1; }
#party-spec { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); z-index: 62; padding: 10px 18px;
  border-radius: 10px; background: rgba(10, 8, 6, 0.85); border: 1px solid rgba(216, 180, 106, 0.45); color: #ece4d2;
  font: 16px Oswald, sans-serif; letter-spacing: 0.05em; text-align: center; cursor: pointer; }
#party-spec b { color: #d8b46a; }
#party-spec small { display: block; color: #9a907c; font: 12px 'Segoe UI', sans-serif; margin-top: 2px; }
#party-spec.hidden { display: none; }
body.playing #party { opacity: 0.85; }`;
document.head.appendChild(css);
const panel = document.createElement("div");
panel.id = "party";
const noteEl = document.createElement("div");
noteEl.id = "party-note";
document.body.append(panel, noteEl, specBar);

let noteTimer = 0;
function note(text) {
  noteEl.textContent = text;
  noteEl.classList.add("on");
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => noteEl.classList.remove("on"), 4000);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function colorFor(uid) {
  return looks[uid]?.shirt || `hsl(${hash(uid) % 360} 65% 55%)`;
}

function statusOf(p) {
  if (!p.run || p.state === "lobby") return "in the lobby";
  if (p.run !== meta.run) return "in an old run";
  if (p.state === "dead") return `died${p.by ? " to " + (G.ui.NAMES[p.by] || p.by) : ""}`;
  if (p.state === "win") return "escaped!";
  if (p.state === "play") {
    const f = G.FLOORS[meta.floor];
    if (p.hide) return "hiding";
    return p.room != null && f ? `at ${f.plate(p.room)}` : "playing";
  }
  return "in the lobby";
}

function renderPanel() {
  const now = serverNow();
  const list = Object.entries(players).filter(([, p]) => now - (p.at || 0) < STALE_MS);
  const host = meta.host === me?.uid;
  panel.innerHTML =
    `<b class="t">PARTY · ${list.length} PLAYER${list.length === 1 ? "" : "S"}</b>` +
    list
      .map(
        ([uid, p]) =>
          `<div class="p"><span class="dot" style="background:${esc(colorFor(uid))}"></span>` +
          `<span class="n">${esc(p.name || "Friend")}${uid === meta.host ? " 👑" : ""}${uid === me?.uid ? " (you)" : ""}</span>` +
          `<span class="s">${esc(statusOf(p))}</span></div>`,
      )
      .join("") +
    (Game.state === "menu"
      ? `<div class="hint">${host ? "You lead: pick a floor to start it for everyone." : "Waiting for the leader to pick a floor…"}</div>`
      : "");
}
setInterval(renderPanel, 1000);

// Pop-ups when friends die or escape.
const seen = {};
function announce() {
  for (const [uid, p] of Object.entries(players)) {
    const was = seen[uid];
    seen[uid] = `${p.run}:${p.state}`;
    if (uid === me?.uid || !was || was === seen[uid] || p.run !== myRun) continue;
    if (p.state === "dead") note(`${p.name} ${statusOf(p)}.`);
    else if (p.state === "win") note(`${p.name} escaped!`);
  }
}

/* ---------- connecting ---------- */

// Runs the leader starts need sound, which browsers only allow after a
// click or key press.
const unlock = () => G.audio.init();
addEventListener("mousedown", unlock);
addEventListener("keydown", unlock);

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
  sendLook();
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
    announce();
    syncAvatars();
    renderPanel();
  });
  onValue(root("looks"), (snap) => {
    looks = {};
    for (const [uid, cfg] of Object.entries(snap.val() || {})) looks[uid] = G.avatar.clean(cfg);
    syncAvatars();
  });
});
setInterval(syncAvatars, 500);
