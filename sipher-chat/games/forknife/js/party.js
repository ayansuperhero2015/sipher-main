// Party mode: a Forknife 1v1 against a friend from Sipher.
//
// Sipher opens the game with window.SIPHER_PARTY = { id, name } and shares
// the Firebase sign-in, so this talks to the Realtime Database:
//   parties/{id}/meta            { host, game, run, mode, roster: { uid: 1 } }
//   parties/{id}/world/setup     the match the leader started: mode, rounds, theme, seed, who plays
//   parties/{id}/players/{uid}   each player's own position, pose, health and shot counter (10x a second)
//   parties/{id}/looks/{uid}     avatars (games/shared/avatar.js)
//   parties/{id}/events/{run}    hits, eliminations, builds, edits, build damage, rockets, scores
//
// Your friend takes the bot's place. Each game is the boss of its own player:
// you aim and shoot in your game and send the damage you deal, your friend's
// game applies it and says when they're eliminated. Builds, edits and damage
// to builds are sent to the other game. The leader's game keeps the score.
// Rounds are seeded the same way in both games (spawns, storm, random loadouts).
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
const V3 = THREE.Vector3;
const SEND_MS = 100;
const STALE_MS = 15000;
const root = (path) => ref(rtdb, `parties/${PARTY.id}/${path}`);
const TAB = Math.random().toString(36).slice(2, 10);
const r2 = (v) => Math.round(v * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, num(v)));
const $ = (id) => document.getElementById(id);

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
let rivalUid = null;
const serverNow = () => Date.now() + clockOffset;
const isHost = () => me && meta.host === me.uid;
const net = () => !!(G.netMatch && G.match && G.bot && G.bot.puppet);
const inMatch = () => net() && myRun;

// Everything about the other player arrives over the network, and the game
// shows names inside HTML, so only safe values get through.
const safeName = (s) => String(s || "Friend").replace(/[<>&"'`\\]/g, "").slice(0, 20) || "Friend";
const safeWid = (w) => (G.WEAPONS[w] || ["pickaxe", "storm", "fall", "rocket"].includes(w) ? w : "ar");
const safeHeld = (w) => (G.WEAPONS[w] || w === "pickaxe" ? w : null);

/* ---------- events ---------- */

function emit(ev) {
  if (!me || !myRun) return;
  push(root(`events/${myRun}`), { ...ev, by: me.uid, tab: TAB, at: serverTimestamp() }).catch(() => {});
}

function listenEvents(run) {
  if (stopEvents) stopEvents();
  stopEvents = onChildAdded(root(`events/${run}`), (snap) => {
    const ev = snap.val();
    if (run !== myRun || !ev || ev.tab === TAB || ev.by !== rivalUid || (ev.at || 0) < joinedAt - 1500) return;
    try {
      onEvent(ev);
    } catch (err) {
      console.warn("Couldn't apply", ev, err);
    }
  });
}

// Things done because the other game said so (they're not sent back).
let fromNet = false;
const asNet = (fn) => { fromNet = true; try { return fn(); } finally { fromNet = false; } };

function onEvent(ev) {
  const m = G.match, R = G.bot;
  if (!net()) return;
  if (ev.t === "hit") {
    // Damage your friend's game says you took.
    if (m.phase !== "play" || !G.player.alive) return;
    const d = clamp(ev.d, 0, 250);
    if (d >= 1) asNet(() => G.hurt(G.player, d, R, !!ev.h, safeWid(ev.w)));
  } else if (ev.t === "el") {
    // Your friend was eliminated (by you, or the storm, or a fall).
    if (!R.alive || m.phase !== "play") return;
    R.alive = false; R.hp = 0;
    asNet(() => G.onElim(R, ev.k ? G.player : null, safeWid(ev.w), !!ev.h));
  } else if (ev.t === "b") {
    addBuild(ev.p);
  } else if (ev.t === "pd") {
    for (const item of (Array.isArray(ev.l) ? ev.l : []).slice(0, 60)) {
      if (!Array.isArray(item)) continue;
      const p = pieceByKey(item[0]);
      const d = clamp(item[1], 0, 800);
      if (p && d > 0) asNet(() => G.damagePiece(p, d, R));
    }
  } else if (ev.t === "e") {
    const p = pieceByKey(ev.k);
    if (!p || p.owner !== R) return;
    const dir = [0, 1, 2, 3].includes(ev.d) ? ev.d : p.d;
    if (asNet(() => G.applyEdit(p, num(ev.m) | 0, dir))) G.audio.editConfirm(p.center);
  } else if (ev.t === "rk") {
    addRocket(ev.p, ev.v);
  } else if (ev.t === "sc" && !isHost()) {
    // The leader's game keeps the score (its "you" is our friend).
    const s = Array.isArray(ev.s) ? ev.s : [], tr = Array.isArray(ev.tr) ? ev.tr : [];
    m.score = [clamp(s[1], 0, 99) | 0, clamp(s[0], 0, 99) | 0];
    if (m.phase === "roundEnd") m.final = !!ev.f;
    if (m.mode.ladder) {
      const n = m.mode.ladder.length - 1;
      R.tier = clamp(tr[0], 0, n) | 0;
      const mine = clamp(tr[1], 0, n) | 0;
      if (mine !== G.player.tier) {
        G.player.tier = mine;
        if (G.player.alive) G.giveLoadout(G.player, m.mode.ladder[mine] === "pickaxe" ? [] : [m.mode.ladder[mine]]);
      }
    }
  } else if (ev.t === "ff") {
    rivalLeft(`${R.name} forfeited.`);
  }
}

const pieceByKey = (k) => (typeof k === "string" && k.length < 32 ? G.pieces.find((p) => p.key === k) : null);

function addBuild(raw) {
  const m = G.match, R = G.bot, A = G.arena;
  if (!Array.isArray(raw) || !m.mode.build) return;
  const [type, ix, iy, iz, d, mat] = raw;
  if (!G.PIECES.includes(type) || !G.MATS[mat] || ![ix, iy, iz, d].every(Number.isInteger) || d < 0 || d > 3) return;
  if (iy < 0 || iy >= A.maxLv || ix < A.cx0 - 1 || ix > A.cx1 || iz < A.cz0 - 1 || iz > A.cz1) return;
  if (G.pieceAt(type, ix, iy, iz, d)) return;
  const p = G.addPiece({ type, ix, iy, iz, d, mat }, R);
  if (!p) return;
  G.audio.build(p.center);
  G.pushOut(p);
}

function addRocket(p, v) {
  if (!Array.isArray(p) || !Array.isArray(v)) return;
  const w = G.WEAPONS.rocket;
  const pos = new V3(clamp(p[0], -200, 200), clamp(p[1], -5, 60), clamp(p[2], -200, 200));
  const vel = new V3(clamp(v[0], -60, 60), clamp(v[1], -60, 60), clamp(v[2], -60, 60));
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.6), new THREE.MeshLambertMaterial({ color: 0xdfe5ea, emissive: 0x552200 }));
  mesh.position.copy(pos); mesh.lookAt(pos.clone().add(vel)); G.scene.add(mesh);
  G.rockets.push({ pos, vel, owner: G.bot, life: 5, mesh, w });
  G.audio.shot(w.snd, G.bot.pos);
}

/* ---------- what your game sends ---------- */

// Damage you deal to your friend, batched every 100 ms.
let hitQ = null;
function flushHits() {
  if (!hitQ) return;
  emit({ t: "hit", d: Math.round(hitQ.d), h: hitQ.h ? 1 : 0, w: hitQ.w });
  hitQ = null;
}
// Damage you deal to builds, batched the same way.
let pdQ = new Map();
function flushPd() {
  if (!pdQ.size) return;
  emit({ t: "pd", l: [...pdQ].map(([k, d]) => [k, Math.round(d)]) });
  pdQ = new Map();
}
setInterval(() => { if (net()) { flushHits(); flushPd(); } }, SEND_MS);

const realHurt = G.hurt;
G.hurt = (t, dmg, by, head, wid) => {
  if (!net()) return realHurt(t, dmg, by, head, wid);
  const m = G.match;
  if (t.puppet) {
    // Your friend's game applies damage to them; you send what you dealt.
    if (by === G.player && t.alive && m.phase === "play" && !fromNet) {
      dmg = Math.max(1, Math.round(dmg));
      hitQ = hitQ || { d: 0, h: false, w: wid };
      hitQ.d += dmg; hitQ.h = hitQ.h || !!head; hitQ.w = wid;
      m.stats.dmg += dmg;
      G.dmgNum(t.pos, dmg, head ? "head" : t.shield > 0 ? "shield" : "hp");
      G.ui.hitmarker(head);
      if (head) { m.stats.heads++; G.audio.headshot(); } else G.audio.hit();
    }
    return;
  }
  // Your friend's shots and rockets hurt you only when their game says so.
  if (t === G.player && by && by.puppet && !fromNet) return;
  return realHurt(t, dmg, by, head, wid);
};

const realElim = G.onElim;
G.onElim = (t, by, wid, head) => {
  if (net() && t === G.player) {
    flushHits();
    emit({ t: "el", w: wid || "storm", h: head ? 1 : 0, k: by && by.puppet ? 1 : 0 });
  }
  realElim(t, by, wid, head);
  if (net() && isHost()) {
    const m = G.match;
    emit({ t: "sc", s: [m.score[0], m.score[1]], tr: [G.player.tier | 0, G.bot.tier | 0], f: m.final ? 1 : 0 });
  }
};

const realDamagePiece = G.damagePiece;
G.damagePiece = (p, dmg, by) => {
  if (net() && !fromNet) {
    if (by && by.puppet) return; // your friend's game sends the damage they do
    if (by === G.player && p.alive && !p.static) pdQ.set(p.key, (pdQ.get(p.key) || 0) + dmg);
  }
  return realDamagePiece(p, dmg, by);
};

const realTryBuild = G.tryBuild;
G.tryBuild = (a, s) => {
  const p = realTryBuild(a, s);
  if (p && net() && a === G.player) emit({ t: "b", p: [p.type, p.ix, p.iy, p.iz, p.d, p.mat] });
  return p;
};

const realApplyEdit = G.applyEdit;
G.applyEdit = (p, mask, dir) => {
  const ok = realApplyEdit(p, mask, dir);
  if (ok && net() && !fromNet && p.owner === G.player) emit({ t: "e", k: p.key, m: p.mask, d: p.d });
  return ok;
};

G.onRocket = (a, mz, vel) => {
  if (net() && a === G.player) emit({ t: "rk", p: [r2(mz.x), r2(mz.y), r2(mz.z)], v: [r2(vel.x), r2(vel.y), r2(vel.z)] });
};

/* ---------- your friend in your game ---------- */

function makeRivalFor(uid) {
  return (color) => {
    const p = players[uid] || {};
    const a = G.makeActor({
      name: safeName(p.name),
      color,
      hair: G.HAIR[clamp(p.hr, 0, G.HAIR.length - 1) | 0],
      skin: G.SKINS[0],
      look: looks[uid] ? SA.clean(looks[uid]) : null,
    });
    a.puppet = true;
    a.uid = uid;
    a.target = new V3();
    a.tyaw = 0;
    a.tpitch = 0;
    a.lastShots = null;
    a.lastSwings = null;
    return a;
  };
}

const _d = new V3(), _o = new V3(), _m = new V3(), _e = new V3();
function replayShot(a, wid) {
  const w = G.WEAPONS[wid];
  if (!w || w.kind !== "gun") return;
  _o.set(a.pos.x, G.eyeY(a), a.pos.z);
  G.dirFrom(a.yaw, a.pitch, _d);
  _m.set(a.pos.x + Math.cos(a.yaw) * 0.3, G.eyeY(a) - 0.2, a.pos.z - Math.sin(a.yaw) * 0.3).addScaledVector(_d, 0.9);
  G.audio.shot(w.snd, a.pos);
  G.muzzle(_m, w.pellets || w.scope ? 1.4 : 0.8);
  a.av.kick = 1;
  const n = Math.min(w.pellets || 1, 4);
  for (let i = 0; i < n; i++) {
    const dir = _e.copy(_d);
    if (n > 1) dir.add(new V3((Math.random() - 0.5) * w.spread * 2, (Math.random() - 0.5) * w.spread * 2, (Math.random() - 0.5) * w.spread * 2)).normalize();
    const hit = G.rayWorld(_o, dir, 160);
    G.tracer(_m, _o.clone().addScaledVector(dir, Math.min(hit.t, 160)), w.scope ? 0xffffff : 0xffe9a8, w.scope ? 0.07 : 0.035, w.scope ? 0.3 : 0.09);
  }
}

// Your friend's player glides to their latest position instead of running physics.
const realActorUpdate = G.actorUpdate;
G.actorUpdate = (a, dt) => {
  if (!a.puppet) return realActorUpdate(a, dt);
  if (!a.alive) return;
  const s = players[a.uid];
  let held = a.netHeld || null;
  if (s && s.run === myRun && typeof s.x === "number") {
    a.target.set(clamp(s.x, -300, 300), clamp(s.y, -10, 80), clamp(s.z, -300, 300));
    a.tyaw = num(s.ya);
    a.tpitch = clamp(s.pi, -1.5, 1.5);
    const f = num(s.f) | 0;
    a.grounded = !!(f & 1); a.crouch = !!(f & 2); a.slideT = f & 4 ? 0.5 : 0; a.editing = !!(f & 8);
    a.input.ads = !!(f & 16); a.reloadT = f & 32 ? 1 : 0; a.useT = f & 64 ? 1 : 0; a.emote = f & 128 ? 1 : 0;
    a.buildMode = G.PIECES.includes(s.bm) ? s.bm : null;
    held = a.netHeld = safeHeld(s.w);
    a.hp = clamp(s.hp, 0, 100); a.shield = clamp(s.sh, 0, 100);
    const sc = num(s.sc), sw = num(s.sw);
    if (a.lastShots === null || sc < a.lastShots) a.lastShots = sc;
    else if (sc > a.lastShots) { for (let i = 0; i < Math.min(3, sc - a.lastShots); i++) replayShot(a, held); a.lastShots = sc; }
    if (a.lastSwings === null || sw < a.lastSwings) a.lastSwings = sw;
    else if (sw > a.lastSwings) { a.swingT = 0.35; G.audio.swing(a.pos); a.lastSwings = sw; }
  }
  const bx = a.pos.x, bz = a.pos.z;
  if (a.pos.distanceTo(a.target) > 8) a.pos.copy(a.target);
  else a.pos.lerp(a.target, 1 - Math.exp(-dt * 16));
  a.vel.set((a.pos.x - bx) / Math.max(dt, 1e-3), 0, (a.pos.z - bz) / Math.max(dt, 1e-3));
  a.yaw += G.angleWrap(a.tyaw - a.yaw) * Math.min(1, dt * 16);
  a.pitch += (a.tpitch - a.pitch) * Math.min(1, dt * 16);
  a.adsK = G.lerp(a.adsK, a.input.ads ? 1 : 0, Math.min(1, dt * 12));
  if (a.swingT > 0) a.swingT -= dt;
  a.av.root.position.copy(a.pos);
  a.av.root.rotation.y = a.yaw;
  a.av.setWeapon(a.buildMode || a.editing ? null : held);
  a.av.animate(dt, a);
};

// A party match keeps running behind the pause menu, without your inputs.
const realUpdate = G.update;
G.update = (dt) => {
  if (G.netMatch && G.paused) { G.keys = {}; G.mouse.l = G.mouse.r = false; }
  return realUpdate(dt);
};

function rivalLeft(msg) {
  const m = G.match;
  if (!net() || m.phase === "end") return;
  note(msg + " You win!");
  m.score[0] = Math.max(m.score[0], m.target);
  m.score[1] = Math.min(m.score[1], m.score[0] - 1);
  if (m.mode.ladder) G.player.tier = m.mode.ladder.length - 1;
  G.endMatch();
}

// Your friend left mid-match (closed the tab, lost connection, went back to the lobby).
setInterval(() => {
  if (!inMatch() || G.match.phase === "end") return;
  const now = serverNow();
  const p = players[rivalUid];
  const settled = now - joinedAt > 8000;
  if (!p || now - (p.at || 0) > STALE_MS || (settled && (p.run !== myRun || p.state !== "play"))) rivalLeft(`${G.bot.name} left the match.`);
}, 1000);

/* ---------- starting matches together ---------- */

function lobbyPlayers() {
  const now = serverNow();
  return Object.entries(players)
    .filter(([, p]) => now - (p.at || 0) < STALE_MS)
    .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
}

function soloMode() {
  G.netMatch = false; G.netSeed = 0; G.netSide = 0; G.rnd = Math.random; G.makeRival = null;
}

const realStart = G.startMatch;
// Starts the match in `setup` from side 0 (the leader) or 1 (the friend).
function begin(setup, side) {
  const s = G.save, keep = { mode: s.mode, rounds: s.rounds, theme: s.theme };
  s.mode = G.MODES[setup.mode] ? setup.mode : "build";
  s.rounds = [3, 5, 7].includes(setup.rounds) ? setup.rounds : 5;
  s.theme = G.THEMES[setup.theme] ? setup.theme : "day";
  rivalUid = side === 0 ? setup.guest : setup.host;
  G.netMatch = true; G.netSide = side; G.netSeed = (num(setup.seed) | 0) || 1;
  G.makeRival = makeRivalFor(rivalUid);
  launching = true;
  try {
    realStart();
  } finally {
    launching = false;
    G.makeRival = null;
    if (side === 1) Object.assign(s, keep); // the leader's choices don't overwrite yours
  }
}

G.startMatch = () => {
  if (launching) return realStart();
  if (!me) return note("Still connecting to the party…");
  if (!isHost()) return note("Only the party leader starts the match. Hang tight!");
  const friend = lobbyPlayers().find(([uid]) => uid !== me.uid);
  if (!friend) {
    note("No friend here yet, so you're playing the bot. Invite someone from Sipher!");
    soloMode();
    return realStart();
  }
  const run = (meta.run || 0) + 1;
  myRun = run;
  joinedAt = serverNow();
  const setup = {
    run, mode: G.save.mode, rounds: G.save.rounds, theme: G.save.theme,
    seed: 1 + Math.floor(Math.random() * 1e9), host: me.uid, guest: friend[0],
  };
  begin(setup, 0);
  const changes = {
    "meta/run": run,
    "meta/mode": setup.mode,
    "meta/roster": { [me.uid]: 1, [friend[0]]: 1 },
    "world/setup": setup,
  };
  if (meta.run) changes[`events/${meta.run}`] = null;
  update(ref(rtdb, `parties/${PARTY.id}`), changes).catch((err) => note("Couldn't start: " + err.message));
  listenEvents(run);
  send(true);
};

function maybeLaunch() {
  if (!me || isHost() || !meta.run || meta.run <= myRun) return;
  const setup = world.setup;
  if (!setup || setup.run !== meta.run) return; // the setup arrives right after
  myRun = meta.run;
  if (setup.guest !== me.uid) {
    const host = players[meta.host];
    return note(`${safeName(host && host.name)} started a 1v1 with someone else. You're up after!`);
  }
  if (G.match && G.match.phase !== "end" && !G.netMatch) G.quitToMenu(); // leave a solo game for the friend match
  joinedAt = serverNow();
  begin(setup, 1);
  listenEvents(myRun);
  send(true);
}

const realQuit = G.quitToMenu;
G.quitToMenu = (...args) => {
  if (net() && G.match.phase !== "end") emit({ t: "ff" });
  soloMode();
  return realQuit(...args);
};

// The end screen names your friend, not a difficulty.
const realShowEnd = G.ui.showEnd;
G.ui.showEnd = (win) => {
  realShowEnd(win);
  const small = document.querySelector("#end .sc small");
  if (net() && small) small.textContent = `vs ${G.bot.name} · ${G.match.mode.name} · Friend match`;
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
    hr: G.save.hair | 0,
  };
  if (inMatch() && p) {
    const f = (p.grounded ? 1 : 0) | (p.crouch ? 2 : 0) | (p.slideT > 0 ? 4 : 0) | (p.editing ? 8 : 0) | (p.input.ads ? 16 : 0)
      | (p.reloadT > 0 ? 32 : 0) | (p.useT > 0 ? 64 : 0) | (p.emote > 0 ? 128 : 0) | (p.alive ? 256 : 0);
    Object.assign(s, {
      x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), ya: r2(p.yaw), pi: r2(p.pitch), f,
      bm: p.buildMode || null, w: p.cur < 0 ? "pickaxe" : p.slots[p.cur] || null,
      hp: Math.ceil(p.hp), sh: Math.ceil(p.shield), sc: p.shots || 0, sw: p.swings || 0,
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

/* ---------- party panel ---------- */

const css = document.createElement("style");
css.textContent = `
#party { position: fixed; left: 14px; bottom: 14px; z-index: 60; width: 240px; padding: 10px 12px;
  background: rgba(10, 18, 52, 0.88); border: 2px solid #ffe83a; color: #f2f6ff;
  font: 600 15px/1.3 'Barlow Condensed', 'Segoe UI', sans-serif; pointer-events: none; }
#party b.t { display: block; font: italic 800 18px 'Barlow Condensed', sans-serif; letter-spacing: 0.06em; color: #ffe83a; margin-bottom: 6px; }
#party .p { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
#party .dot { width: 10px; height: 10px; flex-shrink: 0; }
#party .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#party .s { color: #a9b8e0; font-size: 13px; white-space: nowrap; }
#party .hint { margin-top: 6px; color: #a9b8e0; font-size: 14px; }
#party-note { position: fixed; top: 70px; left: 50%; transform: translateX(-50%); z-index: 61; max-width: 80vw;
  padding: 9px 16px; background: rgba(10, 18, 52, 0.94); border: 2px solid #ffe83a; color: #f2f6ff;
  font: 700 16px 'Barlow Condensed', 'Segoe UI', sans-serif; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
#party-note.on { opacity: 1; }
body:has(#hud:not(.hidden)) #party, body:has(#end:not(.hidden)) #party { display: none; }`;
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
  const friend = list.find(([uid]) => uid !== me?.uid);
  panel.innerHTML =
    `<b class="t">PARTY · ${list.length} PLAYER${list.length === 1 ? "" : "S"}</b>` +
    list
      .map(([uid, p]) => (
        `<div class="p"><span class="dot" style="background:${esc(SA.clean(looks[uid]).shirt)}"></span>` +
        `<span class="n">${esc(p.name || "Friend")}${uid === meta.host ? " 👑" : ""}${uid === me?.uid ? " (you)" : ""}</span>` +
        `<span class="s">${p.state === "play" ? "in a match" : "in the lobby"}</span></div>`
      ))
      .join("") +
    `<div class="hint">${
      isHost()
        ? friend ? `You lead: pick a mode, then press Play for a 1v1 against ${esc(friend[1].name || "your friend")}.` : "Waiting for a friend to join. Press Play to fight the bot meanwhile."
        : "Waiting for the leader to press Play…"
    }</div>`;
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
    if (G.bot && G.bot.puppet && looks[G.bot.uid]) G.swapLook(G.bot, looks[G.bot.uid]);
  });
  onValue(root("world"), (snap) => {
    world = snap.val() || {};
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
