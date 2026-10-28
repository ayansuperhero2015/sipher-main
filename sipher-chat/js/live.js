// Realtime Database reads and writes: typing indicators, "new messages"
// markers for channels, and @mention pings.
//
// Data model (see database.rules.json):
//   typing/{convoKey}/{uid}       { name, at } while someone is typing
//   activity/{serverId}/{cid}     { at, by, everyoneAt? } latest channel message
//   pings/{uid}/{serverId}_{cid}  { at, by, name, channel } last @mention of uid
//
// None of this is permanent; it's small and changes often, which is what the
// Realtime Database is cheap at (Firestore would charge a read per update).
import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";
import { rtdb } from "./firebase.js";

// Typing entries older than this are ignored (a tab that froze mid-word).
const TYPING_STALE_MS = 8000;

// Difference between the server's clock and ours, for judging staleness.
let clockOffset = 0;
onValue(
  ref(rtdb, ".info/serverTimeOffset"),
  (snap) => (clockOffset = Number(snap.val()) || 0),
  () => {},
);

// A Firestore conversation path as a database key.
export function convoKey(convo) {
  return convo[0] === "dms" ? `d_${convo[1]}` : `s_${convo[1]}_${convo[3]}`;
}

// ---- typing ----

const cleanups = new Set();

export function setTyping(convo, uid, name, typing) {
  const key = convoKey(convo);
  const r = ref(rtdb, `typing/${key}/${uid}`);
  if (!typing) return remove(r);
  // If the tab closes mid-word, the server clears the entry for us.
  if (!cleanups.has(key)) {
    cleanups.add(key);
    onDisconnect(r).remove().catch(() => {});
  }
  return set(r, { name: String(name || "Someone").slice(0, 64), at: serverTimestamp() });
}

// Calls cb([{ uid, name }]) with everyone else typing in the conversation.
// Re-checks every couple of seconds so people who stopped mid-sentence drop
// off without anyone writing anything.
export function watchTyping(convo, me, cb) {
  let all = {};
  let shown = "";
  const check = () => {
    const now = Date.now() + clockOffset;
    const list = Object.entries(all)
      .filter(([uid, t]) => uid !== me && now - (t?.at || 0) < TYPING_STALE_MS)
      .map(([uid, t]) => ({ uid, name: t.name }));
    const key = JSON.stringify(list);
    if (key === shown) return;
    shown = key;
    cb(list);
  };
  const timer = setInterval(check, 2000);
  const stop = onValue(
    ref(rtdb, `typing/${convoKey(convo)}`),
    (snap) => {
      all = snap.val() || {};
      check();
    },
    () => {
      all = {};
      check();
    },
  );
  return () => {
    clearInterval(timer);
    stop();
  };
}

// ---- channel activity & pings ----

// Called after a channel message is sent. `mentioned` are uids named with
// @Name; `everyone` is true for @everyone.
export function noteMessage({ serverId, channelId, channelName, uid, name, mentioned, everyone }) {
  const changes = {
    [`activity/${serverId}/${channelId}/at`]: serverTimestamp(),
    [`activity/${serverId}/${channelId}/by`]: uid,
  };
  if (everyone) {
    changes[`activity/${serverId}/${channelId}/everyoneAt`] = serverTimestamp();
    changes[`activity/${serverId}/${channelId}/everyoneBy`] = uid;
  }
  for (const other of mentioned)
    if (other !== uid)
      changes[`pings/${other}/${serverId}_${channelId}`] = {
        at: serverTimestamp(),
        by: uid,
        name: String(name || "Someone").slice(0, 64),
        channel: String(channelName || "").slice(0, 32),
      };
  return update(ref(rtdb), changes);
}

// Clears a deleted channel's marker.
export function forgetChannel(serverId, channelId) {
  return remove(ref(rtdb, `activity/${serverId}/${channelId}`));
}

// Calls cb({ channelId: { at, by, everyoneAt, everyoneBy } }) for a server.
export function watchActivity(serverId, cb) {
  return onValue(
    ref(rtdb, `activity/${serverId}`),
    (snap) => cb(snap.val() || {}),
    (err) => console.warn("Couldn't load channel activity", err),
  );
}

// Calls cb({ "serverId_channelId": { at, by, name, channel } }).
export function watchPings(uid, cb) {
  return onValue(
    ref(rtdb, `pings/${uid}`),
    (snap) => cb(snap.val() || {}),
    (err) => console.warn("Couldn't load mentions", err),
  );
}
