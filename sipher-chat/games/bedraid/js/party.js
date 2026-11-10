// Party mode: play Bed Raid against (and with) friends from Sipher.
//
// Sipher opens the game with window.SIPHER_PARTY = { id, name } and shares
// the Firebase sign-in (same site), so this talks to the Realtime Database:
//   parties/{id}/meta                 { host, game, createdAt, run, mode, seed, roster: { uid: team } }
//   parties/{id}/players/{uid}        live state: team pick, position, look, held item, hp…
//   parties/{id}/events/{run}/{key}   what happened: blocks, beds, hits, deaths, shots…
//
// Who decides what:
// - Your own player is yours: your game moves it, applies damage to it and
//   decides when it dies. Friends are "puppets" moved by their updates.
// - A sword hit on a friend is sent to their game, which applies it (armour,
//   knockback, death). Arrows, fireballs and TNT are copied to everyone and
//   each game checks only its own player, so nothing hits twice.
// - Blocks you place or break (bridges, towers, TNT holes, eggs) and beds
//   you break are logged and replayed on every game; the map itself is the
//   same everywhere because it isn't random.
// - No bots in a party: teams nobody picked start without a bed.
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
const SEND_MS = 100; // your position, 10 times a second
const FLUSH_MS = 100; // block changes are sent in small batches
const STALE_MS = 15000; // a player who stopped updating has left
const PER_TEAM = { solo: 1, duo: 2, squad: 4 };
const game = G.game;
const wd = G.world;
const V3 = G.V3;
const $ = (id) => document.getElementById(id);
const root = (path) => ref(rtdb, `parties/${PARTY.id}/${path}`);
// This tab's own events come back to it; skip only those.
const TAB = Math.random().toString(36).slice(2, 10);

let me = null;
let meta = {};
let players = {};
let looks = {}; // everyone's avatar (games/shared/avatar.js)
let myRun = 0; // the last match this player joined
let joinedAt = 0;
let pending = null; // a match the leader started while we were still playing
let launching = false;
let clockOffset = 0;
let stopEvents = null;
const serverNow = () => Date.now() + clockOffset;

/* ---------- who is who ---------- */

const uidOf = (a) => (!a ? null : a === game.player ? me?.uid : a.remote || null);
const actorFor = (uid) =>
  !uid ? null : uid === me?.uid ? game.player : game.actors.find((a) => a.remote === uid) || null;
const inMatch = () => myRun && game.state === "play";

/* ---------- sending what happens ---------- */

let replaying = false; // applying a friend's change: don't send it back
let quiet = 0; // our own change that is sent some other way
let noWorld = false; // a friend's explosion: they send the blocks it broke

function emit(ev) {
  if (replaying || !me || !inMatch()) return;
  push(root(`events/${myRun}`), { ...ev, by: me.uid, tab: TAB, at: serverTimestamp() }).catch(() => {});
}

const r2 = (v) => Math.round(v * 100) / 100;
const vec = (v) => [r2(v.x), r2(v.y), r2(v.z)];

// Every block change goes through world.set.
const blockQueue = [];
const realSet = wd.set;
wd.set = function (x, y, z, id, isPlaced = 1) {
  if (noWorld) return false;
  const ok = realSet.call(this, x, y, z, id, isPlaced);
  if (ok && !replaying && !quiet && inMatch()) blockQueue.push(x, y, z, id);
  return ok;
};
setInterval(() => {
  if (!blockQueue.length) return;
  emit({ t: "b", l: blockQueue.splice(0) });
}, FLUSH_MS);

// Beds: logged once, by whoever broke it.
const realBreakBed = game.breakBed;
game.breakBed = function (team, actor) {
  if (replaying || !actor || actor !== game.player) return realBreakBed.call(this, team, actor);
  const alive = this.teams[team]?.bedAlive;
  quiet++;
  try {
    realBreakBed.call(this, team, actor);
  } finally {
    quiet--;
  }
  if (alive) emit({ t: "bed", team });
};

// Damage to a friend's player is up to their game.
const realDamage = G.Actor.prototype.damage;
G.Actor.prototype.damage = function (amount, from, kind, kb) {
  if (!this.remote) return realDamage.call(this, amount, from, kind, kb);
  // Arrows, explosions and falls: their game simulates those itself.
  if (kind !== "melee" || !this.alive || game.state !== "play") return false;
  if (from && from.team === this.team) return false;
  if (this.iframes > 0) return false;
  this.iframes = 0.38;
  this.avatar.hurt = 1;
  emit({ t: "hit", to: this.remote, amt: r2(amount), kind, kb: kb ? { x: r2(kb.x), y: r2(kb.y), z: r2(kb.z) } : null });
  return true;
};

// Our death (with the loot the killer takes).
const realOnDeath = game.onDeath;
game.onDeath = function (v, killer, kind) {
  if (v === game.player && !replaying) emit({ t: "death", k: uidOf(killer), kind, res: { ...v.res } });
  return realOnDeath.call(this, v, killer, kind);
};

// Shots, throws and TNT are copied so everyone can dodge (or get hit by) them.
const realArrow = G.spawnArrow;
G.spawnArrow = (owner, pos, vel, power) => {
  realArrow(owner, pos, vel, power);
  if (owner === game.player) emit({ t: "arrow", p: vec(pos), v: vec(vel), pw: r2(power) });
};
const realThrown = G.spawnThrown;
G.spawnThrown = (kind, owner, pos, vel) => {
  realThrown(kind, owner, pos, vel);
  if (owner === game.player) emit({ t: "throw", kind, p: vec(pos), v: vec(vel) });
};
const realTNT = G.spawnTNT;
G.spawnTNT = (owner, x, y, z) => {
  realTNT(owner, x, y, z);
  if (owner === game.player) emit({ t: "tnt", x, y, z });
};
// A friend's explosion still hurts us, but the blocks it breaks come from them.
const realExplode = G.explode;
G.explode = (pos, radius, maxDmg, owner) => {
  if (!owner || !owner.remote) return realExplode(pos, radius, maxDmg, owner);
  noWorld = true;
  try {
    return realExplode(pos, radius, maxDmg, owner);
  } finally {
    noWorld = false;
  }
};

// Team upgrades help the whole team.
const realUpgrade = game.buyUpgrade;
game.buyUpgrade = function (a, id) {
  const ok = realUpgrade.call(this, a, id);
  if (ok && a === game.player) emit({ t: "upg", id });
  return ok;
};

/* ---------- replaying a friend's events ---------- */

function apply(ev, past) {
  if (!ev || ev.tab === TAB || !game.player) return;
  replaying = true;
  try {
    const from = actorFor(ev.by);
    if (ev.t === "b") {
      const l = Array.isArray(ev.l) ? ev.l : [];
      for (let i = 0; i + 3 < l.length; i += 4) {
        const [x, y, z, id] = [l[i], l[i + 1], l[i + 2], l[i + 3]];
        // Real block ids at whole positions inside the world only.
        if (![x, y, z, id].every(Number.isInteger) || !wd.inside(x, y, z) || (id && !G.BLOCKS[id])) continue;
        if (id) wd.set(x, y, z, id, 1);
        else {
          const old = wd.get(x, y, z);
          if (!old || G.BLOCKS[old].bed) continue;
          wd.set(x, y, z, 0);
          if (!past) G.fx.block(x, y, z, old);
        }
      }
    } else if (ev.t === "bed") {
      game.breakBed(ev.team, from);
    } else if (ev.t === "hit") {
      if (past || ev.to !== me.uid || !from) return;
      // Applied by our own game, so armour, knockback and death work as usual.
      // Capped at what a real sword hit can do (diamond + sharpness, critical),
      // so nobody can send a one-shot.
      const amt = Math.max(0, Math.min(60, Number(ev.amt) || 0));
      const k = (v) => Math.max(-12, Math.min(12, Number(v) || 0));
      const kb = ev.kb ? { x: k(ev.kb.x), y: Math.max(0, k(ev.kb.y)), z: k(ev.kb.z) } : undefined;
      replaying = false;
      game.player.damage(amt, from, "melee", kb);
    } else if (ev.t === "death") {
      // Their updates may already have marked them dead; the kill feed,
      // loot and final kill still come from this event.
      if (!from || from.eliminated) return;
      // The loot their killer takes, within reason.
      from.res = {};
      for (const k of G.RES) from.res[k] = Math.max(0, Math.min(999, Math.floor(Number(ev.res?.[k]) || 0)));
      from.alive = false;
      from.hp = 0;
      from.deadUntil = performance.now() + 1500;
      from.stats.deaths++;
      game.onDeath(from, actorFor(ev.k), ev.kind);
      from.respawnAt = Infinity; // they respawn when their updates say so
    } else if (past) {
      // Old shots and team upgrades from before we joined don't matter.
      if (ev.t === "upg") applyUpgrade(from, ev.id);
    } else if (ev.t === "arrow" && from) {
      realArrow(from, new V3(...ev.p), new V3(...ev.v), ev.pw);
    } else if (ev.t === "throw" && from && (ev.kind === "fireball" || ev.kind === "pearl")) {
      // Eggs lay blocks, which arrive as block changes instead.
      realThrown(ev.kind, from, new V3(...ev.p), new V3(...ev.v));
    } else if (ev.t === "tnt" && from) {
      realTNT(from, ev.x, ev.y, ev.z);
    } else if (ev.t === "upg") {
      applyUpgrade(from, ev.id);
    }
  } catch (err) {
    console.warn("Couldn't replay", ev, err);
  } finally {
    replaying = false;
  }
}

function applyUpgrade(a, id) {
  const u = G.UPGRADES.find((x) => x.id === id);
  if (!a || !u) return;
  const tm = game.teams[a.team];
  const lvl = tm.up[id];
  if (lvl >= u.max) return;
  tm.up[id] = lvl + 1;
  if (id === "trap") tm.trapArmed = true;
  if (a.team === game.player.team)
    G.ui.feed(`${G.ui.name(a)} bought <b style="color:#7af0ff">${u.name}${u.max > 1 ? " " + ["I", "II", "III", "IV"][lvl] : ""}</b>`);
}

function listenEvents(run) {
  if (stopEvents) stopEvents();
  stopEvents = onChildAdded(root(`events/${run}`), (snap) => {
    if (run !== myRun) return;
    const ev = snap.val();
    apply(ev, (ev.at || 0) < joinedAt - 1500);
  });
}

/* ---------- friends' players ---------- */

// Names come from other players, so only plain text gets through (the game
// shows names inside HTML in places).
function puppetName(uid) {
  return String(players[uid]?.name || "Friend").replace(/[<>&"'`\\]/g, "").slice(0, 20) || "Friend";
}

function addPuppet(uid, team) {
  const a = new G.Actor({ name: puppetName(uid), team });
  a.remote = uid;
  a.target = new V3();
  game.actors.push(a);
  game.spawn(a);
  a.respawnAt = Infinity;
  a.target.copy(a.pos);
  if (looks[uid]) G.swapLook(a, looks[uid]);
  return a;
}

// Moves puppets toward their latest update before each game step.
const realUpdate = game.update;
game.update = function (dt) {
  if (myRun && game.player) updatePuppets(dt);
  return realUpdate.call(this, dt);
};

function updatePuppets(dt) {
  const now = serverNow();
  const k = 1 - Math.exp(-dt * 14);
  for (const a of game.actors) {
    if (!a.remote) continue;
    const p = players[a.remote];
    // Friends need a moment to start the match too before they count as gone.
    const settled = now - joinedAt > 8000;
    const gone = !p || now - (p.at || 0) > STALE_MS || (settled && (p.run !== myRun || p.state === "lobby"));
    if (gone) {
      // Left the match: out for good.
      if (!a.eliminated && game.state === "play") {
        a.alive = false;
        a.eliminated = true;
        a.avatar.root.visible = false;
        G.ui.feed(`${G.ui.name(a)} left the match`);
        game.checkTeams();
      }
      continue;
    }
    if (typeof p.x !== "number" || p.run !== myRun) continue;
    if (!p.al) {
      // Dead (the death event with the kill feed may still be on its way).
      if (a.alive) {
        a.alive = false;
        a.deadUntil = performance.now() + 1500;
      }
      a.avatar.root.visible = false;
      continue;
    }
    if (!a.alive) {
      // Back from the dead, once any stale "alive" update has passed.
      if (a.eliminated || performance.now() < (a.deadUntil || 0)) continue;
      a.alive = true;
      a.hp = a.maxHp;
      a.pos.set(p.x, p.y, p.z);
    }
    a.avatar.root.visible = true;
    if (p.el && !a.eliminated) a.eliminated = true;
    a.target.set(p.x, p.y, p.z);
    const before = a.pos.clone();
    if (before.distanceTo(a.target) > 6) a.pos.copy(a.target);
    else a.pos.lerp(a.target, k);
    const sp = dt > 0 ? 1 / dt : 0;
    a.vel.set((a.pos.x - before.x) * sp, (a.pos.y - before.y) * sp, (a.pos.z - before.z) * sp);
    a.onGround = Math.abs(a.target.y - a.pos.y) < 0.05;
    let dy = (p.yaw || 0) - a.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    a.yaw += dy * k;
    a.pitch = G.lerp(a.pitch, p.pi || 0, k);
    a.sneak = !!p.sn;
    a.slots[0] = p.h && G.ITEMS[p.h] ? { id: p.h, count: 1 } : null;
    a.sel = 0;
    if (p.ar) a.armor = p.ar;
    if (typeof p.hp === "number" && Math.round(a.hp) !== Math.round(p.hp)) {
      a.hp = p.hp;
      a.tagDirty = true;
    }
  }
}

/* ---------- starting matches together ---------- */

function lobbyPlayers() {
  const now = serverNow();
  return Object.entries(players)
    .filter(([, p]) => now - (p.at || 0) < STALE_MS)
    .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
}

function pickedTeam() {
  const on = document.querySelector("#o-team .on");
  return on ? +on.dataset.v : -1;
}

// Gives everyone a team: their pick if there's room, otherwise the emptiest.
function makeRoster(mode) {
  const per = PER_TEAM[mode] || 1;
  const list = lobbyPlayers();
  if (list.length > per * 4) return null;
  const roster = {};
  const count = [0, 0, 0, 0];
  const later = [];
  for (const [uid, p] of list) {
    const t = uid === me.uid ? pickedTeam() : typeof p.pick === "number" ? p.pick : -1;
    if (t >= 0 && t < 4 && count[t] < per) {
      roster[uid] = t;
      count[t]++;
    } else later.push(uid);
  }
  for (const uid of later) {
    const open = [0, 1, 2, 3].filter((t) => count[t] < per);
    const least = Math.min(...open.map((t) => count[t]));
    const choices = open.filter((t) => count[t] === least);
    const t = choices[Math.floor(Math.random() * choices.length)];
    roster[uid] = t;
    count[t]++;
  }
  return roster;
}

const realStart = game.start;
// PLAY and "Play again" ask the party to start a match; it begins for
// everyone at once when the leader's request lands.
game.start = function (opts) {
  if (launching) return realStart.call(this, opts);
  const back = () => {
    if (game.state === "menu") $("menu").classList.remove("hidden");
    else if (game.state === "end") $("end").classList.remove("hidden");
  };
  if (!me) {
    back();
    return note("Still connecting to the party…");
  }
  if (meta.host !== me.uid) {
    back();
    return note("Only the party leader starts the match. Pick your team and wait.");
  }
  send(true);
  const mode = opts.mode || "solo";
  const roster = makeRoster(mode);
  if (!roster) {
    back();
    return note(`Too many players for ${mode === "solo" ? "Solos" : "Duos"}. Pick Duos or Squads.`);
  }
  const teams = new Set(Object.values(roster));
  if (teams.size < 2) {
    back();
    return note("Everyone is on one team. Spread out so there's someone to fight!");
  }
  const run = (meta.run || 0) + 1;
  const changes = {
    "meta/run": run,
    "meta/mode": mode,
    "meta/seed": Math.floor(Math.random() * 2 ** 31),
    "meta/roster": roster,
  };
  if (meta.run) changes[`events/${meta.run}`] = null; // the old match's log
  update(ref(rtdb, `parties/${PARTY.id}`), changes).catch((err) => {
    back();
    note("Couldn't start: " + err.message);
  });
};

function launch() {
  pending = null;
  const team = meta.roster?.[me.uid];
  myRun = meta.run;
  if (typeof team !== "number") {
    note("A match started without you. You'll be in the next one.");
    return;
  }
  joinedAt = serverNow();
  $("menu").classList.add("hidden");
  $("end").classList.add("hidden");
  launching = true;
  try {
    realStart.call(game, { mode: meta.mode, diff: "normal", team });
  } finally {
    launching = false;
  }
  // Swap the bots for friends.
  for (const a of game.actors) {
    if (a === game.player) continue;
    G.scene.remove(a.avatar.root);
    a.avatar.dispose();
  }
  game.actors = [game.player];
  game.bots = [];
  game.player.name = PARTY.name || "You";
  for (const [uid, t] of Object.entries(meta.roster)) if (uid !== me.uid) addPuppet(uid, t);
  // Teams nobody plays start without a bed (and are already out).
  const used = new Set(Object.values(meta.roster));
  quiet++;
  try {
    for (const tm of game.teams) {
      if (used.has(tm.id)) continue;
      tm.bedAlive = false;
      tm.eliminated = true;
      for (const b of game.map.teams[tm.id].bed) wd.set(b.x, b.y, b.z, 0);
      if (game.bedModels[tm.id]) {
        G.scene.remove(game.bedModels[tm.id]);
        game.bedModels[tm.id] = null;
      }
    }
  } finally {
    quiet--;
  }
  G.ui.dirty = true;
  listenEvents(myRun);
  send(true);
}

function maybeLaunch() {
  if (!meta.run || meta.run <= myRun || !meta.roster) return;
  if (game.state === "play") {
    if (!pending) note("The leader started a new match. It begins when this one ends.");
    pending = true;
    return;
  }
  launch();
}

// Leaving a match (or it ending) lets a waiting one start.
const realQuit = game.quit;
game.quit = function (...args) {
  const out = realQuit.apply(this, args);
  if (pending) launch();
  return out;
};
const realEnd = game.endMatch;
game.endMatch = function (...args) {
  const out = realEnd.apply(this, args);
  if (pending) setTimeout(() => game.state !== "play" && launch(), 4000);
  return out;
};

/* ---------- sending our own state ---------- */

let lastSent = "";
let sendAt = 0;
const joinedTime = Date.now();

function myState() {
  const p = game.player;
  const s = {
    name: String(PARTY.name || "Player").slice(0, 64),
    run: myRun,
    state: game.state === "menu" ? "lobby" : game.state,
    pick: pickedTeam(),
    joined: joinedTime,
  };
  if (myRun && p && game.state !== "menu") {
    Object.assign(s, {
      team: p.team,
      x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z),
      yaw: r2(p.yaw), pi: r2(p.pitch),
      h: p.held()?.id || null,
      sn: !!p.sneak, al: !!p.alive, el: !!p.eliminated,
      hp: Math.round(p.hp), ar: p.armor,
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
// Picking a team in the menu tells the leader right away.
document.addEventListener("click", (e) => {
  if (e.target.closest?.("#o-team")) setTimeout(() => send(true), 0);
});

/* ---------- party panel ---------- */

const css = document.createElement("style");
css.textContent = `
#party { position: fixed; top: 12px; left: 12px; z-index: 60; width: 230px; padding: 10px 12px;
  background: rgba(16, 24, 40, 0.82); border: 2px solid rgba(255, 255, 255, 0.18); border-radius: 12px;
  color: #fff; font: 700 13px/1.35 Nunito, 'Segoe UI', sans-serif; pointer-events: none; }
#party b.t { display: block; font: 15px 'Lilita One', sans-serif; letter-spacing: 0.04em; color: #ffe27a; margin-bottom: 6px; }
#party .p { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
#party .dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
#party .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#party .s { color: #b9c4d6; font-size: 12px; white-space: nowrap; }
#party .hint { margin-top: 6px; color: #b9c4d6; font-size: 12px; }
#party-note { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 61; max-width: 80vw;
  padding: 9px 16px; border-radius: 10px; background: rgba(16, 24, 40, 0.9); border: 2px solid rgba(255, 226, 122, 0.5);
  color: #fff; font: 800 14px Nunito, 'Segoe UI', sans-serif; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
#party-note.on { opacity: 1; }
body:has(#hud:not(.hidden)) #party { top: auto; bottom: 120px; opacity: 0.85; }`;
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

function statusOf(uid, p) {
  if (p.state === "lobby" || !p.run || p.run !== meta.run) {
    const t = G.TEAMS[p.pick];
    return t ? `picked ${t.name}` : "random team";
  }
  if (p.el) return "out";
  if (p.state === "end") return "match over";
  return p.al ? `${p.hp ?? 100} hp` : "respawning";
}

function teamOf(uid, p) {
  if (p.run && p.run === meta.run && meta.roster?.[uid] !== undefined) return meta.roster[uid];
  return p.pick;
}

function renderPanel() {
  const list = lobbyPlayers();
  const host = meta.host === me?.uid;
  panel.innerHTML =
    `<b class="t">PARTY · ${list.length} PLAYER${list.length === 1 ? "" : "S"}</b>` +
    list
      .map(([uid, p]) => {
        const t = G.TEAMS[teamOf(uid, p)];
        return (
          `<div class="p"><span class="dot" style="background:${t ? t.css : "#888"}"></span>` +
          `<span class="n">${esc(p.name || "Friend")}${uid === meta.host ? " 👑" : ""}${uid === me?.uid ? " (you)" : ""}</span>` +
          `<span class="s">${esc(statusOf(uid, p))}</span></div>`
        );
      })
      .join("") +
    (game.state === "menu"
      ? `<div class="hint">${host ? "You lead: pick a mode and press PLAY to start for everyone." : "Pick your team, then wait for the leader to press PLAY."}</div>`
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
  // Our avatar, for friends' screens (and again whenever it changes).
  const sendLook = () => set(root(`looks/${me.uid}`), window.SipherAvatar.cfg).catch(() => {});
  sendLook();
  addEventListener("sipher-avatar", sendLook);
  onValue(root("looks"), (snap) => {
    looks = snap.val() || {};
    for (const a of game.actors) if (a.remote && looks[a.remote]) G.swapLook(a, looks[a.remote]);
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
    for (const a of game.actors) {
      if (a.remote && players[a.remote] && a.name !== puppetName(a.remote)) {
        a.name = puppetName(a.remote);
        a.tagDirty = true;
      }
    }
    renderPanel();
  });
});
