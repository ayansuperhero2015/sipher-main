// Party mode: Split Door X with friends from Sipher.
//
// Sipher opens the game with window.SIPHER_PARTY = { id, name } and shares
// the Firebase sign-in, so this talks to the Realtime Database:
//   parties/{id}/meta            { host, game, run, mode, roster: { uid: 1 } }
//   parties/{id}/world/setup     the match the leader started: mode, map, bots, mutators and the line-up
//   parties/{id}/world/live      the leader's match, 10x a second: clock, scores, bots, objectives, pickups
//   parties/{id}/players/{uid}   each player's own runner: position, pose, weapon, portals, shot counter
//   parties/{id}/looks/{uid}     avatars (games/shared/avatar.js)
//   parties/{id}/events/{run}    hits, eliminations, projectiles and pickups between games
//
// Friends replace bots in the line-up. Every game is the boss of its own runner
// (and the leader's game of the bots): it moves it, places its doors, applies the
// damage it takes and says when it's eliminated. Damage you deal to someone else
// is sent to their game. The leader's game keeps the clock, scores, pickups,
// the zone and the key, and ends the match.
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
const WIDS = Object.keys(G.WEAPONS);

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
let liveAt = 0;
const serverNow = () => Date.now() + clockOffset;
const isHost = () => !!(me && meta.host === me.uid);
const net = () => !!(G.netMatch && G.state === "playing" && G.match && !G.match.attract);
const byKey = (k) => (typeof k === "string" && k ? G.actors.find((a) => a.netKey === k) || null : null);
const ownerOf = (a) => (a.isHuman ? a.netKey : meta.host);

// Everything about other players arrives over the network, and the game shows
// names inside HTML, so only safe values get through.
const safeName = (s) => String(s || "Friend").replace(/[<>&"'`\\]/g, "").slice(0, 20) || "Friend";
const safeColor = (c, d) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : d);
const safeWid = (w) => (G.WEAPONS[w] || ["grenade", "melee", "void"].includes(w) ? w : "ar");

/* ---------- events ---------- */

function emit(ev) {
  if (!me || !myRun) return;
  push(root(`events/${myRun}`), { ...ev, by: me.uid, tab: TAB, at: serverTimestamp() }).catch(() => {});
}

function listenEvents(run) {
  if (stopEvents) stopEvents();
  stopEvents = onChildAdded(root(`events/${run}`), (snap) => {
    const ev = snap.val();
    if (run !== myRun || !ev || ev.tab === TAB || ev.by === me.uid || (ev.at || 0) < joinedAt - 1500) return;
    if (!meta.roster || !meta.roster[ev.by]) return; // only players in this match
    try {
      onEvent(ev);
    } catch (err) {
      console.warn("Couldn't apply", ev, err);
    }
  });
}

// Things done because another game said so (not sent back out).
let fromNet = false;
const asNet = (fn) => { fromNet = true; try { return fn(); } finally { fromNet = false; } };

const packInfo = (i = {}) => ({ w: i.weapon || "void", h: i.head ? 1 : 0, v: i.via ? 1 : 0, x: i.explosive ? 1 : 0, b: i.back ? 1 : 0, vd: i.void ? 1 : 0 });
const unpackInfo = (i = {}) => ({ weapon: safeWid(i.w), head: !!i.h, via: !!i.v, explosive: !!i.x, back: !!i.b, void: !!i.vd });

function onEvent(ev) {
  if (!net()) return;
  if (ev.t === "hit") {
    // Damage someone dealt to your runner (or, on the leader's game, to a bot).
    if (ev.to !== me.uid) return;
    const target = byKey(ev.tk);
    if (!target || !target.netLocal || !target.alive) return;
    const sender = byKey(ev.ak);
    // a game only speaks for its own runner (and the leader's game for the bots)
    if (!sender || !(ev.ak === ev.by || (ev.by === meta.host && !sender.isHuman))) return;
    const d = clamp(ev.d, 0, 1000);
    if (d > 0) asNet(() => target.takeDamage(d, sender, unpackInfo(ev.i)));
  } else if (ev.t === "kill") {
    // Someone's runner (or a bot, from the leader) was eliminated in its own game.
    const victim = byKey(ev.vk);
    if (!victim || victim.netLocal || !victim.alive) return;
    if (victim.isHuman ? ev.vk !== ev.by : ev.by !== meta.host) return;
    asNet(() => victim.die(byKey(ev.kk), unpackInfo(ev.i)));
  } else if (ev.t === "pj") {
    // A rocket, frag or Jammer someone launched: it flies here too (its damage comes from their game).
    const owner = byKey(ev.o);
    if (!owner || owner.netLocal) return;
    if (owner.isHuman ? ev.o !== ev.by : ev.by !== meta.host) return;
    const p = Array.isArray(ev.p) ? ev.p : [], v = Array.isArray(ev.v) ? ev.v : [];
    const pos = new V3(clamp(p[0], -400, 400), clamp(p[1], -200, 200), clamp(p[2], -400, 400));
    const vel = new V3(clamp(v[0], -60, 60), clamp(v[1], -60, 60), clamp(v[2], -60, 60));
    if (ev.k === "rocket") asNet(() => G.weapons.rocket(owner, pos, vel.normalize()));
    else if (ev.k === "grenade") asNet(() => G.weapons.grenade(owner, pos, vel));
    else if (ev.k === "jammer") asNet(() => G.weapons.jammer(owner, pos, vel));
  } else if (ev.t === "pk") {
    // You walked over a pickup in the leader's game.
    if (ev.to !== me.uid || ev.by !== meta.host || !G.player || !G.player.alive) return;
    if (["rail", "rocket", "overshield", "frag"].includes(ev.ty)) asNet(() => G.match.applyPickup({ type: ev.ty }, G.player));
  } else if (ev.t === "bye") {
    const a = byKey(ev.by);
    if (a && a.isHuman) leave(a);
  }
}

/* ---------- damage, eliminations, projectiles ---------- */

// Damage you deal to someone else's runner, batched every 100 ms per target.
let hitQ = new Map();
function queueHit(target, attacker, amount, info) {
  const k = target.netKey + "|" + attacker.netKey;
  const q = hitQ.get(k) || { to: ownerOf(target), tk: target.netKey, ak: attacker.netKey, d: 0, i: null };
  q.d += amount;
  q.i = packInfo(info);
  if (q.i.h === 0 && q.h) q.i.h = 1;
  q.h = q.h || !!info.head;
  hitQ.set(k, q);
}
function flushHits() {
  for (const q of hitQ.values()) emit({ t: "hit", to: q.to, tk: q.tk, ak: q.ak, d: Math.round(q.d * 10) / 10, i: q.i });
  hitQ = new Map();
}

const realTakeDamage = G.Actor.prototype.takeDamage;
G.Actor.prototype.takeDamage = function (amount, attacker, info = {}) {
  if (!net() || fromNet) return realTakeDamage.call(this, amount, attacker, info);
  if (this.netLocal) {
    // Hits from someone else's runner come from their game; falling into the void is yours.
    if (attacker && !attacker.netLocal && !info.void) return 0;
    return realTakeDamage.call(this, amount, attacker, info);
  }
  // Someone else's runner: their game applies it, you send what you dealt.
  if (!this.alive || !attacker || attacker === this || !attacker.netLocal) return 0;
  if (!G.match.enemies(this, attacker)) return 0;
  queueHit(this, attacker, amount, info);
  this.lastShieldHit = this.shield > 0;
  return 1;
};

const realDie = G.Actor.prototype.die;
G.Actor.prototype.die = function (attacker, info) {
  // your own runner (or the leader's bots) dying is always news, even from a hit another game sent
  if (net() && this.netLocal) {
    flushHits();
    emit({ t: "kill", vk: this.netKey, kk: attacker && attacker !== this ? attacker.netKey || "" : "", i: packInfo(info) });
  }
  realDie.call(this, attacker, info);
  if (net() && !this.netLocal) this.respawnT = 1e9; // their game brings them back
};

const realRespawn = G.Actor.prototype.respawn;
G.Actor.prototype.respawn = function (sp) {
  realRespawn.call(this, sp);
  this.netLife = (this.netLife || 0) + 1;
};

for (const kind of ["rocket", "grenade", "jammer"]) {
  const real = G.weapons[kind];
  G.weapons[kind] = function (owner, pos, v) {
    real.call(this, owner, pos, v);
    if (net() && !fromNet && owner && owner.netLocal) {
      const vel = kind === "rocket" ? v.clone().multiplyScalar(36) : v;
      emit({ t: "pj", k: kind, o: owner.netKey, p: [r2(pos.x), r2(pos.y), r2(pos.z)], v: [r2(vel.x), r2(vel.y), r2(vel.z)] });
    }
  };
}

// A friend's runner picked something up in the leader's game: it's theirs.
const realApplyPickup = G.match.applyPickup;
G.match.applyPickup = function (p, a) {
  if (net() && isHost() && !fromNet && a && a.isHuman && !a.netLocal) {
    if (p.type === "overshield" && a.over > 0) return false;
    if ((p.type === "rail" || p.type === "rocket") && (this.mut.railsonly || this.mode === "lock")) return false;
    emit({ t: "pk", to: a.netKey, ty: p.type });
    if (p.type === "overshield") a.over = 100;
    return true;
  }
  return realApplyPickup.call(this, p, a);
};

/* ---------- doors (portals) ---------- */

let portalProto = null;
function hookPortals(sample) {
  if (portalProto || !sample) return;
  portalProto = Object.getPrototypeOf(sample);
  const realPlace = portalProto.place, realClose = portalProto.close;
  portalProto.place = function (bi, hit, n, viewDir) {
    const ok = realPlace.call(this, bi, hit, n, viewDir);
    if (ok) this.netArgs = [bi, r2(hit.x), r2(hit.y), r2(hit.z), r2(n.x), r2(n.y), r2(n.z), r2(viewDir.x), r2(viewDir.y), r2(viewDir.z)];
    return ok;
  };
  portalProto.close = function () {
    realClose.call(this);
    this.netArgs = 0;
  };
}
const portalState = (a) => a.portals.map((p) => (p.placed && p.netArgs ? p.netArgs : 0));

// Make someone else's doors match their game.
function applyPortals(a, list) {
  if (!Array.isArray(list)) return;
  let changed = false;
  for (let i = 0; i < 2; i++) {
    const p = a.portals[i], want = Array.isArray(list[i]) ? list[i].map(num) : 0;
    const key = want ? want.join(",") : "0";
    if (p.netKeyNow === key) continue;
    p.netKeyNow = key;
    changed = true;
    if (!want) { if (p.placed) p.close(); continue; }
    const bi = want[0] | 0;
    if (!G.world.boxes[bi] || !G.world.boxes[bi].portal) continue;
    if (p.placed) p.close();
    p.place(bi, new V3(want[1], want[2], want[3]), new V3(want[4], want[5], want[6]), new V3(want[7], want[8], want[9]));
  }
  if (changed) G.portals.refreshNav();
}

/* ---------- other runners in your game ---------- */

// Flags: 1 on ground, 2 crouched, 4 sliding, 8 jetpack, 16 alive, 32 meleeing, 64 aiming.
const flagsOf = (a) => (a.onGround ? 1 : 0) | (a.crouched ? 2 : 0) | (a.sliding > 0 ? 4 : 0) | (a.jetting ? 8 : 0) | (a.alive ? 16 : 0) | (a.meleeAnim > 0.3 ? 32 : 0) | (a.ads > 0.5 ? 64 : 0);
const stateOf = (a) => [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z), r2(a.yaw), r2(a.pitch), flagsOf(a), Math.max(0, WIDS.indexOf(a.cur)), a.netLife || 0, a.stats.shots || 0];

const _o = new V3(), _d = new V3();
function replayShot(a) {
  const W = a.W();
  if (!W || W.projectile) return;
  a.eye(_o);
  G.fwdFrom(a.yaw, a.pitch, _d);
  const mz = a.muzzlePos();
  const n = Math.min(W.pellets || 1, 3);
  for (let i = 0; i < n; i++) {
    const d = n > 1 ? G.cone(_d, THREE.MathUtils.degToRad(W.spread), new V3()) : _d;
    const tr = G.trace(_o, d, W.range || 100, a, { pierce: W.pierce });
    tr.segs.forEach(([p, q], s) => G.fx.tracer(s === 0 ? mz : p, q, W.color, W.pierce ? 0.07 : 0.026, W.pierce ? 0.35 : 0.1));
  }
  G.fx.muzzle(mz, W.color);
  G.audio.play(W.sound, { pos: mz, vol: 0.9, ref: 14 });
}

let Puppet = null;
function makePuppetClass() {
  Puppet = class extends G.Bot {
    constructor(o) {
      super(o);
      this.puppet = true; this.netLocal = false;
      this.tgt = new V3(); this.tyaw = 0; this.tpitch = 0; this.seenShots = null; this.deadSince = 0;
    }
    respawn(sp) { super.respawn(sp); this.respawnT = 1e9; this.path = null; }
    think() {}
    update(dt) {
      if (this.tag) { this.tag.visible = this.alive; if (this.alive) this.tag.position.set(this.pos.x, this.pos.y + 2.25, this.pos.z); }
      if (this.left) { this.alive = false; this.model.visible = false; if (this.marker) this.marker.visible = false; return; }
      const s = this.isHuman ? players[this.netKey]?.run === myRun && players[this.netKey]?.s : world.live?.run === myRun && world.live?.b?.[this.netKey];
      const pt = this.isHuman ? players[this.netKey]?.pt : world.live?.pt?.[this.netKey];
      if (Array.isArray(s)) {
        const v = s.map(num), f = v[5] | 0, life = v[7] | 0, alive = !!(f & 16);
        // came back to life in their game
        if (!this.alive && alive && life > (this.netLife || 0)) {
          this.respawn([v[0], v[1], v[2], v[3]]);
          this.netLife = life; this.seenShots = v[8];
        }
        // died there, but the elimination never reached us
        if (this.alive && !alive && life === this.netLife) {
          this.deadSince = this.deadSince || G.t;
          if (G.t - this.deadSince > 1.5) { this.alive = false; this.model.visible = false; this.respawnT = 1e9; this.deadSince = 0; }
        } else this.deadSince = 0;
        if (this.alive) {
          this.tgt.set(v[0], v[1], v[2]); this.tyaw = v[3]; this.tpitch = clamp(v[4], -1.6, 1.6);
          this.onGround = !!(f & 1); this.crouched = !!(f & 2); this.sliding = f & 4 ? 0.5 : 0; this.jetting = !!(f & 8);
          if (f & 32 && this.meleeAnim <= 0) this.meleeAnim = 1;
          this.ads = f & 64 ? 1 : 0;
          const wid = WIDS[v[6] | 0];
          if (wid && wid !== this.cur) { this.cur = wid; this.attachGun(); }
          if (this.seenShots === null || v[8] < this.seenShots) this.seenShots = v[8];
          else if (v[8] > this.seenShots) { for (let i = 0; i < Math.min(3, v[8] - this.seenShots); i++) replayShot(this); this.seenShots = v[8]; }
        }
      }
      if (pt) applyPortals(this, pt);
      if (!this.alive) { if (this.marker) this.marker.visible = false; return; }
      this.invuln = Math.max(0, this.invuln - dt);
      this.meleeAnim = Math.max(0, this.meleeAnim - dt * 3.5);
      const bx = this.pos.x, by = this.pos.y, bz = this.pos.z;
      if (this.pos.distanceTo(this.tgt) > 6) this.pos.copy(this.tgt);
      else this.pos.lerp(this.tgt, 1 - Math.exp(-dt * 16));
      const k = 1 / Math.max(dt, 1e-3);
      this.vel.set((this.pos.x - bx) * k, (this.pos.y - by) * k, (this.pos.z - bz) * k);
      this.yaw += G.wrap(this.tyaw - this.yaw) * Math.min(1, dt * 16);
      this.pitch += (this.tpitch - this.pitch) * Math.min(1, dt * 16);
    }
  };
}

// Builds the match line-up (called from G.match.start with the leader's roster).
G.netActors = (roster, skill) => {
  if (!Puppet) makePuppetClass();
  const teams = G.match.M.teams;
  const mine = roster.find((r) => r.k === me.uid);
  const myTeam = mine ? mine.team : 0;
  for (const r of roster) {
    const team = r.team | 0;
    const accent = safeColor(r.accent, "#3fb8ff");
    const doors = Array.isArray(r.doors) ? r.doors.map((c) => safeColor(c, accent)) : G.PLAYER_DOORS;
    let a;
    if (r.k === me.uid) {
      a = new G.Player({ team, name: "YOU", suit: "#e6e9ee", accent, doors });
      G.player = a;
      G.vm.build(a);
      a.model.visible = false;
      a.netLocal = true;
    } else if (!r.human && isHost()) {
      a = new G.Bot({ team, name: safeName(r.name), suit: safeColor(r.suit, "#d9dce2"), accent, doors, skill,
        tag: teams && team === myTeam, tagColor: teams ? G.TEAM[team].color : accent,
        primary: G.PRIMARIES.includes(r.pri) ? r.pri : undefined, secondary: G.SECONDARIES.includes(r.sec) ? r.sec : undefined });
      a.netLocal = true;
    } else {
      const look = r.human ? looks[r.k] || null : null;
      const o = { team, name: safeName(r.name), suit: look ? SA.clean(look).shirt : safeColor(r.suit, "#d9dce2"), accent, doors, skill: G.SKILLS[1],
        tag: !!r.human || (teams && team === myTeam), tagColor: teams ? G.TEAM[team].color : accent };
      a = G.withLook(look, () => new Puppet(o));
      a.isHuman = !!r.human;
    }
    a.netKey = r.k;
    G.actors.push(a);
  }
  hookPortals(G.actors[0] && G.actors[0].portals[0]);
};

/* ---------- the leader's match, sent to everyone ---------- */

function sendLive() {
  const m = G.match;
  if (!net() || !isHost() || !myRun) return;
  const b = {}, pt = {}, stat = {};
  for (const a of G.actors) {
    const k = a.netKey;
    if (!k) continue;
    stat[k] = [a.stats.kills, a.stats.deaths, a.stats.assists, a.stats.score, a.gunTier || 0];
    if (a.netLocal && a !== G.player) { b[k] = stateOf(a); pt[k] = portalState(a); }
  }
  const live = {
    run: myRun, st: m.state, tl: r2(m.timeLeft), sc: (m.scores || []).map(r2), b, pt, stat,
    pu: m.pickups.map((p) => (p.active ? "1" : "0")).join(""),
  };
  if (m.mode === "hill" && m.hill) live.hill = [m.hillI, r2(m.hillT)];
  if (m.mode === "key" && m.key) live.key = [m.key.carrier ? m.key.carrier.netKey : "", r2(m.key.pos.x), r2(m.key.pos.y), r2(m.key.pos.z)];
  set(root("world/live"), live).catch(() => {});
}

// A guest's game shows the leader's clock, scores, objectives and pickups.
function applyLive() {
  const L = world.live, m = G.match;
  if (!L || L.run !== myRun || !net() || isHost()) return;
  m.timeLeft = num(L.tl);
  if (Array.isArray(L.sc)) m.scores = L.sc.map(num);
  for (const [k, s] of Object.entries(L.stat || {})) {
    const a = byKey(k);
    if (!a || !Array.isArray(s)) continue;
    const v = s.map(num);
    a.stats.kills = v[0] | 0; a.stats.deaths = v[1] | 0; a.stats.assists = v[2] | 0; a.stats.score = v[3] | 0;
    if (a !== G.player) a.gunTier = v[4] | 0;
  }
  if (typeof L.pu === "string") m.pickups.forEach((p, i) => (p.active = L.pu[i] === "1"));
  if (Array.isArray(L.hill) && m.hill) {
    const i = num(L.hill[0]) | 0;
    if (i !== m.hillI) { m.hillI = i; m.placeHill(i); G.ui.toast("ZONE MOVED", "#ffffff"); G.audio.play("alarm", { vol: 0.5 }); }
    m.hillT = num(L.hill[1]);
  }
  if (Array.isArray(L.key) && m.key) {
    const carrier = byKey(L.key[0]);
    const was = m.key.carrier;
    m.key.carrier = carrier && carrier.alive ? carrier : null;
    for (const a of G.actors) a.hasKey = a === m.key.carrier;
    if (!m.key.carrier) m.key.pos.set(num(L.key[1]), num(L.key[2]), num(L.key[3]));
    if (m.key.carrier && m.key.carrier !== was) {
      const c = m.key.carrier;
      G.ui.toast(c.isPlayer ? "YOU HAVE THE KEY" : c.name.toUpperCase() + " HAS THE KEY", m.M.teams && c.team === 0 ? G.TEAM[0].color : G.TEAM[1].color);
      if (c.isPlayer) { c.burstLeft = 0; c.reloadT = 0; }
    }
  }
  if (L.st === "ended" && m.state !== "ended") m.end();
}

const realStep = G.step;
G.step = (rdt) => {
  if (net()) applyLive();
  realStep(rdt);
  if (net() && !isHost() && G.match.state !== "ended" && serverNow() - liveAt > 12000) {
    note("The party leader left the match.");
    G.toMenu();
  }
};
setInterval(() => { if (net()) flushHits(); }, SEND_MS);
setInterval(sendLive, SEND_MS);

/* ---------- starting matches together ---------- */

function lobbyPlayers() {
  const now = serverNow();
  return Object.entries(players)
    .filter(([, p]) => now - (p.at || 0) < STALE_MS)
    .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
}

function soloMode() {
  G.netMatch = false; G.netGuest = false;
}

function leave(a) {
  if (a.left) return;
  a.left = true; a.alive = false; a.model.visible = false; a.respawnT = 1e9;
  for (const p of a.portals) p.close();
  G.portals.refreshNav();
  if (G.state === "playing") G.ui.toast(a.name.toUpperCase() + " LEFT", "#9aa3ad");
}

// The line-up: friends first, bots fill the rest (4 v 4, or 8 in free-for-all).
// In team modes friends play together on ATLAS (and spill over to HELIX past four).
function buildRoster(sel, humans) {
  const M = G.MODES[sel.mode], roster = [], names = G.shuffle(G.BOT_NAMES.slice());
  let ni = 0;
  if (M.teams) {
    const counts = [0, 0];
    for (const [uid, p] of humans.slice(0, 8)) {
      const team = counts[0] < 4 ? 0 : 1;
      counts[team]++;
      roster.push({ k: uid, human: 1, name: safeName(p.name), team, accent: G.TEAM[team].color, doors: G.PLAYER_DOORS });
    }
    for (let t = 0; t < 2; t++) {
      while (counts[t] < 4) {
        counts[t]++;
        roster.push({ k: "b" + roster.length, name: names[ni++ % names.length], team: t, suit: G.TEAM[t].suit, accent: G.TEAM[t].color, doors: G.TEAM[t].doors,
          pri: G.pick(G.PRIMARIES), sec: G.pick(G.SECONDARIES) });
      }
    }
  } else {
    const col = (i) => G.FFA_COLORS[i % G.FFA_COLORS.length];
    const lighter = (c) => G.hex(G.col(c).lerp(G.col("#ffffff"), 0.45));
    humans.slice(0, 8).forEach(([uid, p], i) => roster.push({ k: uid, human: 1, name: safeName(p.name), team: 20 + i, accent: col(i), doors: [col(i), lighter(col(i))] }));
    for (let i = roster.length; i < 8; i++) {
      roster.push({ k: "b" + i, name: names[ni++ % names.length], team: 10 + i, suit: G.pick(["#d9dce2", "#3a3f48", "#8a8f98"]), accent: col(i), doors: [col(i), lighter(col(i))],
        pri: G.pick(G.PRIMARIES), sec: G.pick(G.SECONDARIES) });
    }
  }
  return roster;
}

const realStart = G.startMatch;
function begin(setup) {
  G.netMatch = true;
  G.netGuest = !isHost();
  launching = true;
  try {
    realStart({ mode: setup.mode, map: setup.map, difficulty: setup.difficulty, mutators: setup.mutators || {}, roster: setup.roster });
  } finally {
    launching = false;
  }
  liveAt = serverNow();
}

G.startMatch = (sel) => {
  if (launching) return realStart(sel);
  if (!me) return note("Still connecting to the party…");
  if (!isHost()) return note("Only the party leader starts the match. Hang tight!");
  const humans = lobbyPlayers();
  if (sel.mode === "range" || humans.length < 2) {
    if (sel.mode !== "range") note("No friends here yet, so it's you and the bots. Invite someone from Sipher!");
    soloMode();
    return realStart(sel);
  }
  const run = (meta.run || 0) + 1;
  myRun = run;
  joinedAt = serverNow();
  const roster = buildRoster(sel, humans);
  const setup = { run, mode: sel.mode, map: sel.map, difficulty: sel.difficulty | 0, mutators: Object.assign({}, sel.mutators), roster };
  begin(setup);
  const changes = {
    "meta/run": run,
    "meta/mode": sel.mode,
    "meta/roster": Object.fromEntries(roster.filter((r) => r.human).map((r) => [r.k, 1])),
    "world/setup": setup,
    "world/live": null,
  };
  if (meta.run) changes[`events/${meta.run}`] = null;
  update(ref(rtdb, `parties/${PARTY.id}`), changes).catch((err) => note("Couldn't start: " + err.message));
  listenEvents(run);
  send(true);
};

function maybeLaunch() {
  if (!me || isHost() || !meta.run || meta.run <= myRun) return;
  const setup = world.setup;
  if (!setup || setup.run !== meta.run || !Array.isArray(setup.roster) || !G.MODES[setup.mode] || !G.mapById(setup.map)) return;
  myRun = meta.run;
  if (!setup.roster.some((r) => r.k === me.uid)) return note("A match started without you. You'll be in the next one.");
  joinedAt = serverNow();
  begin({ ...setup, difficulty: clamp(setup.difficulty, 0, G.SKILLS.length - 1) | 0 });
  listenEvents(myRun);
  send(true);
}

const realToMenu = G.toMenu;
G.toMenu = (...args) => {
  if (net()) emit({ t: "bye" });
  soloMode();
  return realToMenu(...args);
};

/* ---------- sending our own runner ---------- */

let lastSent = "";
let sendAt = 0;
const joinedTime = Date.now();

function myState() {
  const p = G.player;
  const s = {
    name: String(PARTY.name || "Player").slice(0, 64),
    run: myRun,
    state: net() ? "play" : "lobby",
    joined: joinedTime,
  };
  if (net() && p) { s.s = stateOf(p); s.pt = portalState(p); }
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

// Friends who closed the game or went back to the menu are out of the match.
setInterval(() => {
  if (!net()) return;
  const now = serverNow();
  for (const a of G.actors) {
    if (!a.isHuman || a.netLocal || a.left) continue;
    const p = players[a.netKey];
    const settled = now - joinedAt > 8000;
    if (!p || now - (p.at || 0) > STALE_MS || (settled && (p.run !== myRun || p.state !== "play"))) leave(a);
  }
}, 1000);

/* ---------- party panel ---------- */

const css = document.createElement("style");
css.textContent = `
#party { position: fixed; left: 18px; bottom: 96px; z-index: 60; width: 250px; padding: 10px 12px;
  background: rgba(10, 12, 16, 0.82); border: 1px solid rgba(236, 232, 225, 0.5); color: #ece8e1;
  font: 500 12px/1.4 'IBM Plex Mono', monospace; pointer-events: none; }
#party b.t { display: block; font: 700 13px 'Archivo', sans-serif; letter-spacing: 0.14em; margin-bottom: 6px; }
#party .p { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
#party .dot { width: 9px; height: 9px; flex-shrink: 0; }
#party .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#party .s { opacity: 0.6; white-space: nowrap; }
#party .hint { margin-top: 6px; opacity: 0.7; }
#party-note { position: fixed; top: 70px; left: 50%; transform: translateX(-50%); z-index: 61; max-width: 80vw;
  padding: 9px 16px; background: rgba(10, 12, 16, 0.92); border: 1px solid #ece8e1; color: #ece8e1;
  font: 600 13px 'IBM Plex Mono', monospace; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
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
  panel.innerHTML =
    `<b class="t">PARTY · ${list.length} PLAYER${list.length === 1 ? "" : "S"}</b>` +
    list
      .map(([uid, p]) => (
        `<div class="p"><span class="dot" style="background:${esc(SA.clean(looks[uid]).shirt)}"></span>` +
        `<span class="n">${esc(p.name || "Friend")}${uid === meta.host ? " 👑" : ""}${uid === me?.uid ? " (you)" : ""}</span>` +
        `<span class="s">${p.state === "play" ? "in a match" : "lobby"}</span></div>`
      ))
      .join("") +
    `<div class="hint">${
      isHost()
        ? list.length > 1 ? "You lead: pick a mode and arena, then Deploy. Friends join your team; bots fill the rest." : "Waiting for friends. Deploy now to play the bots."
        : "Waiting for the leader to deploy…"
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
    if (G.state === "playing") for (const a of G.actors) if (a.isHuman && !a.netLocal && looks[a.netKey]) G.swapLook(a, looks[a.netKey]);
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
