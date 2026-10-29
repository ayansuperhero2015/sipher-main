// All Firestore reads and writes live here.
//
// Data model:
//   users/{uid}                                 profile (name, picture)
//   users/{uid}/servers/{serverId}              the servers a user has joined
//   servers/{serverId}                          name, ownerId, inviteCode
//   servers/{serverId}/members/{uid}            membership (what the rules check)
//   servers/{serverId}/channels/{channelId}     text channels
//   servers/{serverId}/channels/{cid}/messages  chat messages
//   invites/{code}                              invite code -> server
//   dms/{uidA_uidB}                             direct message conversations
//   dms/{dmId}/messages                         DM messages
//   config/giphy                                GIPHY key (set in Server Settings)
//   gifCache/{key}                              shared GIF search results
//   gifQuota/{hour}                             GIPHY calls made this hour
//   presence/online                             { seen: { uid: time } } for everyone
//   servers/{sid}/channels/{cid}/slow/{uid}     last post time, for slow mode
//   blocks/{blocker}_{blocked}                  who has blocked whom
//   reports/{id}                                reported messages, for moderators
//   passes/{uid}                                let into Sipher (or waiting for it)
//   bans/{uid}                                  banned from Sipher entirely
//   config/access                               the access code new people need
// Typing and unread markers live in the Realtime Database (js/live.js).
import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { db } from "./firebase.js";

export const MESSAGE_LIMIT = 2000;
// Messages loaded per conversation; "Load older" adds another page.
export const PAGE_SIZE = 50;
const REPLY_SNIPPET = 200;

// The reactions people can pick. firestore.rules has the same list.
export const REACTIONS = ["👍", "💜", "😂", "😮", "😢", "🔥", "💀", "🎉"];

const INVITE_ALPHABET =
  "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(
    bytes,
    (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length],
  ).join("");
}

export function cleanChannelName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

// ---- users ----

// Creates the profile on first sign-in and leaves it alone afterwards, so a
// name or picture chosen in the app isn't overwritten on the next login.
// (Online status lives in presence/online, not here.)
// Resolves to true when the profile was just created (a new account).
export async function saveProfile(user, displayName) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return false;
  await setDoc(ref, {
    uid: user.uid,
    displayName:
      displayName || user.displayName || user.email?.split("@")[0] || "User",
    photoURL: null,
  });
  return true;
}

// Presence lives in one shared doc that clients poll, instead of a live
// listener on every member: with 50+ people, listeners would cost every
// member a read each time anyone's heartbeat ticks.
const presenceRef = () => doc(db, "presence", "online");

export function touchPresence(uid) {
  return setDoc(
    presenceRef(),
    { seen: { [uid]: serverTimestamp() } },
    { merge: true },
  );
}

// Resolves to a Map of uid -> { lastSeen }.
export async function fetchPresence() {
  const snap = await getDoc(presenceRef());
  const seen = snap.exists() ? snap.data().seen || {} : {};
  return new Map(
    Object.entries(seen).map(([uid, lastSeen]) => [uid, { lastSeen }]),
  );
}

export function watchUser(uid, cb) {
  return onSnapshot(doc(db, "users", uid), (snap) =>
    cb(snap.exists() ? snap.data() : null),
  );
}

// One read of someone's profile (for their profile card).
export async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { ...snap.data(), uid } : null;
}

export const ABOUT_LIMIT = 190;

// Updates name, picture and/or "About me" on the profile. Name and picture
// are copied to every membership, which is where member lists read them.
export async function updateMyProfile(uid, fields, serverIds) {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), fields);
  const shared = {};
  if ("displayName" in fields) shared.displayName = fields.displayName;
  if ("photoURL" in fields) shared.photoURL = fields.photoURL;
  if (Object.keys(shared).length)
    for (const sid of serverIds) {
      batch.update(doc(db, "servers", sid, "members", uid), shared);
    }
  await batch.commit();
}

// ---- servers ----

// Entries still waiting on the server are skipped: until the create/join batch
// commits, the membership it adds doesn't exist yet and opening the server
// would be denied.
export function watchMyServers(uid, cb) {
  const q = query(collection(db, "users", uid, "servers"), orderBy("joinedAt"));
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) =>
    cb(
      snap.docs
        .filter((d) => !d.metadata.hasPendingWrites)
        .map((d) => ({ id: d.id, ...d.data() })),
    ),
  );
}

export function watchServer(serverId, cb, onError) {
  return onSnapshot(
    doc(db, "servers", serverId),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

export async function createServer(user, profile, name) {
  const serverRef = doc(collection(db, "servers"));
  const channelRef = doc(collection(serverRef, "channels"));
  const code = newInviteCode();
  const batch = writeBatch(db);

  batch.set(serverRef, {
    name,
    ownerId: user.uid,
    inviteCode: code,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(serverRef, "members", user.uid), {
    uid: user.uid,
    displayName: profile.displayName,
    photoURL: profile.photoURL || null,
    role: "owner",
    joinedAt: serverTimestamp(),
  });
  batch.set(channelRef, { name: "general", createdAt: serverTimestamp() });
  batch.set(doc(db, "invites", code), {
    serverId: serverRef.id,
    serverName: name,
  });
  batch.set(doc(db, "users", user.uid, "servers", serverRef.id), {
    name,
    joinedAt: serverTimestamp(),
  });

  await batch.commit();
  return serverRef.id;
}

export function parseInvite(input) {
  const trimmed = input.trim();
  const match =
    trimmed.match(/[?&#]invite=([A-Za-z0-9]+)/) ||
    trimmed.match(/^([A-Za-z0-9]+)$/);
  return match ? match[1] : null;
}

export async function joinServer(user, profile, code) {
  const invite = await getDoc(doc(db, "invites", code));
  if (!invite.exists())
    throw new Error("That invite is invalid or has expired.");
  const { serverId, serverName } = invite.data();

  const memberRef = doc(db, "servers", serverId, "members", user.uid);
  const batch = writeBatch(db);
  batch.set(memberRef, {
    uid: user.uid,
    displayName: profile.displayName,
    photoURL: profile.photoURL || null,
    role: "member",
    invite: code,
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, "users", user.uid, "servers", serverId), {
    name: serverName,
    joinedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    // Already a member: the rules forbid re-creating the member doc.
    const existing = await getDoc(memberRef).catch(() => null);
    if (existing?.exists()) return serverId;
    throw err;
  }
  return serverId;
}

export const WELCOME_LIMIT = 1000;
export const RULES_LIMIT = 2000;

// Each member's sidebar entry can only be written by that member, so everyone
// refreshes their own copy (syncServerName) when they next see the server.
// `extra` can hold welcome, rules (changing them asks everyone to accept the
// rules again) and filter (hide swear words).
export async function updateServer(serverId, { name, icon }, extra = {}) {
  const server = await getDoc(doc(db, "servers", serverId));
  const batch = writeBatch(db);
  const fields = { name, icon, ...extra };
  if ("rules" in extra && extra.rules !== (server.data().rules || ""))
    fields.rulesUpdatedAt = serverTimestamp();
  batch.update(doc(db, "servers", serverId), fields);
  if (name !== server.data().name) {
    batch.update(doc(db, "invites", server.data().inviteCode), {
      serverName: name,
    });
  }
  await batch.commit();
}

export async function regenerateInvite(serverId) {
  const server = await getDoc(doc(db, "servers", serverId));
  const { inviteCode, name } = server.data();
  const code = newInviteCode();
  const batch = writeBatch(db);
  batch.delete(doc(db, "invites", inviteCode));
  batch.set(doc(db, "invites", code), { serverId, serverName: name });
  batch.update(doc(db, "servers", serverId), { inviteCode: code });
  await batch.commit();
  return code;
}

export async function syncServerName(uid, serverId, name) {
  await updateDoc(doc(db, "users", uid, "servers", serverId), { name });
}

export async function leaveServer(uid, serverId) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "servers", serverId, "members", uid));
  batch.delete(doc(db, "users", uid, "servers", serverId));
  await batch.commit();
}

// Removes a stale sidebar entry (e.g. after the server was deleted).
export function forgetServer(uid, serverId) {
  return deleteDoc(doc(db, "users", uid, "servers", serverId));
}

// True only when it's certain you're out of the server: your pass is
// approved, yet your membership (or the whole server) is gone. A refusal
// while the pass isn't through yet, or a network hiccup, isn't enough.
export async function removedFromServer(uid, serverId) {
  try {
    const pass = await getDoc(doc(db, "passes", uid));
    if (pass.data()?.approved !== true) return false;
    const member = await getDoc(doc(db, "servers", serverId, "members", uid));
    return !member.exists();
  } catch (err) {
    return err?.code === "permission-denied";
  }
}

// Puts back sidebar entries for servers you're still a member of. Older
// versions of the app dropped them whenever opening a server was refused,
// which happened to everyone when the access passes were introduced.
// Resolves to how many were restored.
export async function restoreMyServers(uid) {
  const [memberships, listed] = await Promise.all([
    getDocs(
      query(collectionGroup(db, "members"), where("uid", "==", uid)),
    ),
    getDocs(collection(db, "users", uid, "servers")),
  ]);
  const have = new Set(listed.docs.map((d) => d.id));
  let restored = 0;
  for (const m of memberships.docs) {
    const serverId = m.ref.parent.parent.id;
    if (have.has(serverId)) continue;
    const server = await getDoc(doc(db, "servers", serverId));
    if (!server.exists()) continue;
    await setDoc(doc(db, "users", uid, "servers", serverId), {
      name: server.data().name,
      joinedAt: m.data().joinedAt || serverTimestamp(),
    });
    restored++;
  }
  return restored;
}

export async function deleteServer(uid, serverId) {
  const serverRef = doc(db, "servers", serverId);
  const server = await getDoc(serverRef);
  const [channels, members] = await Promise.all([
    getDocs(collection(serverRef, "channels")),
    getDocs(collection(serverRef, "members")),
  ]);

  // Messages are left behind; with the member docs gone nobody can read them.
  // A Cloud Function (or the Firebase CLI's recursive delete) can purge them.
  // Rules evaluate every write in a batch against the pre-batch state, so the
  // owner check still passes for each delete here.
  const batch = writeBatch(db);
  channels.forEach((c) => batch.delete(c.ref));
  members.forEach((m) => batch.delete(m.ref));
  batch.delete(doc(db, "invites", server.data().inviteCode));
  batch.delete(doc(db, "users", uid, "servers", serverId));
  batch.delete(serverRef);
  await batch.commit();
}

// ---- members ----

export function watchMembers(serverId, cb, onError) {
  return onSnapshot(
    collection(db, "servers", serverId, "members"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

export function kickMember(serverId, uid) {
  return deleteDoc(doc(db, "servers", serverId, "members", uid));
}

// role: "mod" (moderator) or "member". Only the owner can change it.
export function setMemberRole(serverId, uid, role) {
  return updateDoc(doc(db, "servers", serverId, "members", uid), { role });
}

// Records that you accepted the server rules as of `version` (the time the
// rules were last changed, in milliseconds).
export function acceptRules(serverId, uid, version) {
  return updateDoc(doc(db, "servers", serverId, "members", uid), {
    rulesAccepted: version,
  });
}

// ---- channels ----

export function watchChannels(serverId, cb, onError) {
  const q = query(
    collection(db, "servers", serverId, "channels"),
    orderBy("createdAt"),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

// Channel order: `position` (set when the owner rearranges), falling back to
// creation time, so channels made before sections existed keep their order.
export function channelOrder(c) {
  return c.position ?? c.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
}

export async function createChannel(serverId, name, categoryId = null) {
  const ref = doc(collection(db, "servers", serverId, "channels"));
  await setDoc(ref, { name, categoryId, createdAt: serverTimestamp() });
  return ref.id;
}

// Saves a new channel layout: [{ id, categoryId, position }] for the
// channels that moved.
export function moveChannels(serverId, moves) {
  const batch = writeBatch(db);
  for (const { id, categoryId, position } of moves)
    batch.update(doc(db, "servers", serverId, "channels", id), {
      categoryId,
      position,
    });
  return batch.commit();
}

// Sections are an ordered list on the server doc: [{ id, name }].
// `orphans` are channel ids to move out of a deleted section.
export function saveSections(serverId, categories, orphans = []) {
  const batch = writeBatch(db);
  batch.update(doc(db, "servers", serverId), { categories });
  for (const id of orphans)
    batch.update(doc(db, "servers", serverId, "channels", id), {
      categoryId: null,
    });
  return batch.commit();
}

export function newSectionId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
    INVITE_ALPHABET[b % INVITE_ALPHABET.length],
  ).join("");
}

export function renameChannel(serverId, channelId, name) {
  return updateDoc(doc(db, "servers", serverId, "channels", channelId), {
    name,
  });
}

// Slow mode choices, in seconds (0 = off). firestore.rules allows up to 3600.
export const SLOW_MODES = [0, 5, 10, 30, 60, 300, 900];

// private: only the owner and moderators see it. readOnly: only they post.
// slowMode: seconds each person must wait between messages.
export function setChannelPermissions(serverId, channelId, perms) {
  return updateDoc(doc(db, "servers", serverId, "channels", channelId), {
    private: perms.private,
    readOnly: perms.readOnly,
    slowMode: perms.slowMode,
  });
}

export function deleteChannel(serverId, channelId) {
  return deleteDoc(doc(db, "servers", serverId, "channels", channelId));
}

// ---- messages ----
// A conversation is a server channel or a DM; `convo` is its Firestore path,
// e.g. ["servers", sid, "channels", cid] or ["dms", dmId].
// Message fields: text, authorId, authorName, createdAt, editedAt, plus the
// optional replyTo, forwarded, reactions ({ uid: emoji }) and pinned.

export function channelConvo(serverId, channelId) {
  return ["servers", serverId, "channels", channelId];
}

export function dmConvo(dmId) {
  return ["dms", dmId];
}

function messagesRef(convo) {
  return collection(db, ...convo, "messages");
}

export function watchMessages(convo, cb, onError, count = PAGE_SIZE) {
  const q = query(
    messagesRef(convo),
    orderBy("createdAt", "desc"),
    limit(count),
  );
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const messages = snap.docs
        .map((d) => ({
          id: d.id,
          pending: d.metadata.hasPendingWrites,
          ...d.data({ serverTimestamps: "estimate" }),
        }))
        .reverse();
      cb(messages);
    },
    onError,
  );
}

export const POLL_MAX_OPTIONS = 6;

// `extra` can hold replyTo (a message being answered), forwarded
// ({ authorName, from }) for a message passed on from somewhere else,
// poll ({ question, options }) and slow (true in a slow-mode channel, which
// stamps the time so the rules can make you wait).
export function sendMessage(convo, user, profile, text, extra = {}) {
  const data = {
    text,
    authorId: user.uid,
    authorName: profile.displayName,
    createdAt: serverTimestamp(),
  };
  if (extra.replyTo) {
    const { id, authorId, authorName, text: quoted } = extra.replyTo;
    data.replyTo = {
      id,
      authorId,
      authorName: authorName || "Unknown",
      text: quoted.slice(0, REPLY_SNIPPET),
    };
  }
  if (extra.forwarded) data.forwarded = extra.forwarded;
  if (extra.poll)
    data.poll = {
      question: extra.poll.question,
      options: extra.poll.options.slice(0, POLL_MAX_OPTIONS),
    };
  const batch = writeBatch(db);
  batch.set(doc(messagesRef(convo)), data);
  if (extra.slow)
    batch.set(doc(db, ...convo, "slow", user.uid), { at: serverTimestamp() });
  // DMs track their latest message for ordering and unread dots.
  if (convo[0] === "dms") {
    batch.update(doc(db, ...convo), {
      lastMessageAt: serverTimestamp(),
      lastMessageBy: user.uid,
    });
  }
  return batch.commit();
}

export function editMessage(convo, messageId, text) {
  return updateDoc(doc(messagesRef(convo), messageId), {
    text,
    editedAt: serverTimestamp(),
  });
}

export function deleteMessage(convo, messageId) {
  return deleteDoc(doc(messagesRef(convo), messageId));
}

// One reaction per person per message; null removes it.
export function setReaction(convo, messageId, uid, emoji) {
  return updateDoc(doc(messagesRef(convo), messageId), {
    [`reactions.${uid}`]: emoji || deleteField(),
  });
}

// One vote per person per poll (an option's index); null takes it back.
export function setVote(convo, messageId, uid, index) {
  return updateDoc(doc(messagesRef(convo), messageId), {
    [`votes.${uid}`]: index ?? deleteField(),
  });
}

export function setPinned(convo, messageId, pinned) {
  return updateDoc(doc(messagesRef(convo), messageId), { pinned });
}

// Pinned messages are only read when someone opens the pins list.
export async function fetchPins(convo) {
  const snap = await getDocs(
    query(messagesRef(convo), where("pinned", "==", true), limit(50)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
    );
}

// Channels of a server, read once (for the forward dialog).
export async function fetchChannels(serverId) {
  const snap = await getDocs(
    query(collection(db, "servers", serverId, "channels"), orderBy("createdAt")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---- direct messages ----
// dms/{a_b} where a and b are the two user ids, sorted, so each pair of people
// has exactly one conversation. (Firebase user ids never contain "_".)

export function dmIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export function otherMember(dmId, uid) {
  return dmId.split("_").find((m) => m !== uid);
}

export function watchMyDms(uid, cb, onError) {
  const q = query(
    collection(db, "dms"),
    where("members", "array-contains", uid),
  );
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data({ serverTimestamps: "estimate" }),
        })),
      ),
    onError,
  );
}

// Returns the DM id with `otherUid`, creating the conversation if needed.
export async function openDm(uid, otherUid) {
  const id = dmIdFor(uid, otherUid);
  const ref = doc(db, "dms", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      members: id.split("_"),
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessageBy: null,
    });
  }
  return id;
}

// ---- usernames ----
// usernames/{name} -> { uid } claims a name so it's unique; users/{uid} has
// username + usernameChangedAt. A username can change once every 30 days
// (firestore.rules enforces it too). Display names can change any time.

export const USERNAME_COOLDOWN_DAYS = 30;
export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export function cleanUsername(raw) {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

// When the username may next be changed (null = now).
export function nextUsernameChange(profile) {
  const last = profile?.usernameChangedAt?.toMillis?.();
  if (!profile?.username || !last) return null;
  const next = last + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return next > Date.now() ? new Date(next) : null;
}

export async function setUsername(uid, name, oldName) {
  const claim = await getDoc(doc(db, "usernames", name));
  if (claim.exists() && claim.data().uid !== uid)
    throw new Error(`@${name} is already taken.`);
  const batch = writeBatch(db);
  batch.set(doc(db, "usernames", name), { uid });
  batch.update(doc(db, "users", uid), {
    username: name,
    usernameChangedAt: serverTimestamp(),
  });
  if (oldName && oldName !== name)
    batch.delete(doc(db, "usernames", oldName));
  await batch.commit();
}

// Finds someone by username: { uid, displayName, photoURL, username } or null.
export async function lookupUsername(name) {
  const claim = await getDoc(doc(db, "usernames", name));
  if (!claim.exists()) return null;
  const { uid } = claim.data();
  const user = await getDoc(doc(db, "users", uid));
  return user.exists() ? { ...user.data(), uid } : null;
}

// ---- friends ----
// requests/{from}_{to}: a pending friend request, with an optional message.
// friendships/{uidA_uidB}: ids sorted like DMs; created by whoever accepts.

export function sendFriendRequest(me, profile, target, note) {
  return setDoc(doc(db, "requests", `${me}_${target.uid}`), {
    from: me,
    to: target.uid,
    fromName: profile.displayName,
    fromUsername: profile.username || "",
    toName: target.displayName || "",
    toUsername: target.username || "",
    note,
    createdAt: serverTimestamp(),
  });
}

// Calls cb({ incoming, outgoing }) whenever either side changes.
export function watchRequests(uid, cb, onError) {
  const lists = { incoming: [], outgoing: [] };
  const listen = (field, key) =>
    onSnapshot(
      query(collection(db, "requests"), where(field, "==", uid)),
      (snap) => {
        lists[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        cb({ ...lists });
      },
      onError,
    );
  const stops = [listen("to", "incoming"), listen("from", "outgoing")];
  return () => stops.forEach((s) => s());
}

export function deleteRequest(id) {
  return deleteDoc(doc(db, "requests", id));
}

export async function acceptRequest(uid, request) {
  const batch = writeBatch(db);
  batch.set(doc(db, "friendships", dmIdFor(uid, request.from)), {
    members: dmIdFor(uid, request.from).split("_"),
    createdAt: serverTimestamp(),
  });
  batch.delete(doc(db, "requests", request.id));
  await batch.commit();
}

export function watchFriends(uid, cb, onError) {
  return onSnapshot(
    query(collection(db, "friendships"), where("members", "array-contains", uid)),
    (snap) => cb(snap.docs.map((d) => otherMember(d.id, uid))),
    onError,
  );
}

export function removeFriend(uid, otherUid) {
  return deleteDoc(doc(db, "friendships", dmIdFor(uid, otherUid)));
}

// ---- blocking ----
// blocks/{me}_{them}. Blocked people can't DM you or send friend requests
// (firestore.rules checks), and their messages are hidden for you.

export function watchBlocks(uid, cb, onError) {
  return onSnapshot(
    query(collection(db, "blocks"), where("from", "==", uid)),
    (snap) => cb(snap.docs.map((d) => d.data().to)),
    onError,
  );
}

// Also ends any friendship and pending requests between you.
export async function blockUser(uid, otherUid) {
  const batch = writeBatch(db);
  batch.set(doc(db, "blocks", `${uid}_${otherUid}`), {
    from: uid,
    to: otherUid,
    createdAt: serverTimestamp(),
  });
  batch.delete(doc(db, "friendships", dmIdFor(uid, otherUid)));
  batch.delete(doc(db, "requests", `${uid}_${otherUid}`));
  batch.delete(doc(db, "requests", `${otherUid}_${uid}`));
  await batch.commit();
}

export function unblockUser(uid, otherUid) {
  return deleteDoc(doc(db, "blocks", `${uid}_${otherUid}`));
}

// ---- reports ----
// reports/{id}: a message someone flagged, for the server's owner and
// moderators to review.

export const REPORT_REASON_LIMIT = 200;

export function reportMessage(serverId, channel, msg, reporter, reason) {
  return setDoc(doc(collection(db, "reports")), {
    serverId,
    channelId: channel.id,
    channelName: channel.name,
    messageId: msg.id,
    authorId: msg.authorId,
    authorName: msg.authorName || "Unknown",
    text: msg.text.slice(0, 500),
    reason: reason.slice(0, REPORT_REASON_LIMIT),
    reporterId: reporter.uid,
    reporterName: reporter.displayName || "Someone",
    createdAt: serverTimestamp(),
  });
}

export function watchReports(serverId, cb, onError) {
  return onSnapshot(
    query(collection(db, "reports"), where("serverId", "==", serverId)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) =>
              (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
          ),
      ),
    onError,
  );
}

export function dismissReport(id) {
  return deleteDoc(doc(db, "reports", id));
}

// ---- access ----
// Everyone needs an approved pass to use Sipher (firestore.rules checks it
// on almost everything). People already in the main server claim one
// themselves; anyone new types the access code and waits for the admin.

export const ACCESS_NOTE_LIMIT = 100;
const ACCESS_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newAccessCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ACCESS_ALPHABET[b % ACCESS_ALPHABET.length]).join("");
}

export function watchPass(uid, cb, onError) {
  return onSnapshot(
    doc(db, "passes", uid),
    (snap) => cb(snap.exists() ? snap.data() : null),
    onError,
  );
}

// Fails unless you were already in the main server (and aren't banned).
export function claimExistingPass(uid, name) {
  return setDoc(doc(db, "passes", uid), {
    uid,
    name,
    approved: true,
    via: "existing",
    createdAt: serverTimestamp(),
  });
}

// Fails if the code is wrong.
export function requestPass(uid, name, code, note) {
  return setDoc(doc(db, "passes", uid), {
    uid,
    name,
    approved: false,
    via: "code",
    note: note.slice(0, ACCESS_NOTE_LIMIT),
    code,
    createdAt: serverTimestamp(),
  });
}

export async function isBanned(uid) {
  const snap = await getDoc(doc(db, "bans", uid));
  return snap.exists();
}

// For the admin: people waiting to be let in, oldest first.
export function watchWaiting(cb, onError) {
  return onSnapshot(
    query(collection(db, "passes"), where("approved", "==", false)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => d.data())
          .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
      ),
    onError,
  );
}

export function approvePass(uid) {
  return updateDoc(doc(db, "passes", uid), { approved: true });
}

// They can ask again if they still have the code.
export function rejectPass(uid) {
  return deleteDoc(doc(db, "passes", uid));
}

export function watchBans(cb, onError) {
  return onSnapshot(
    collection(db, "bans"),
    (snap) => cb(snap.docs.map((d) => d.data())),
    onError,
  );
}

// Takes away their pass (which locks them out of everything) and removes
// them from the main server.
export async function banUser(uid, name, by, mainServerId) {
  const batch = writeBatch(db);
  batch.set(doc(db, "bans", uid), {
    uid,
    name: (name || "Unknown").slice(0, 64),
    by,
    createdAt: serverTimestamp(),
  });
  batch.delete(doc(db, "passes", uid));
  if (mainServerId) batch.delete(doc(db, "servers", mainServerId, "members", uid));
  await batch.commit();
}

// They'll need the access code (and your approval) to come back.
export function unbanUser(uid) {
  return deleteDoc(doc(db, "bans", uid));
}

export async function getAccessCode() {
  const snap = await getDoc(doc(db, "config", "access"));
  return snap.exists() ? snap.data().code : null;
}

export function setAccessCode(code) {
  return setDoc(doc(db, "config", "access"), { code });
}

// Remembers that someone let in with the code was put in the main server.
export function markJoinedMain(uid) {
  return updateDoc(doc(db, "users", uid), { joinedMain: true });
}

// Owner of the main server = the admin of all of Sipher.
export async function getServerOwner(serverId) {
  const snap = await getDoc(doc(db, "servers", serverId));
  return snap.exists() ? snap.data().ownerId : null;
}

// ---- app config ----

// Resolves an invite code to its server id (or null).
export async function serverForInvite(code) {
  const snap = await getDoc(doc(db, "invites", code));
  return snap.exists() ? snap.data().serverId : null;
}

export async function getGiphyKey() {
  const snap = await getDoc(doc(db, "config", "giphy"));
  return snap.exists() ? snap.data().key || "" : "";
}

export function setGiphyKey(key) {
  return setDoc(doc(db, "config", "giphy"), { key });
}

// ---- GIF search cache & quota ----
// The GIPHY key is shared by every visitor and limited to 100 calls an hour,
// so results are cached for everyone and calls are counted per hour.

export async function readGifCache(key) {
  const snap = await getDoc(doc(db, "gifCache", key));
  return snap.exists() ? snap.data() : null;
}

export function writeGifCache(key, query, results) {
  return setDoc(doc(db, "gifCache", key), {
    query,
    results,
    fetchedAt: serverTimestamp(),
  });
}

// Claims one GIPHY call from this hour's shared budget. Resolves to false
// when the budget is used up.
export function reserveGifCall(budget) {
  const hour = String(Math.floor(Date.now() / 3_600_000));
  const ref = doc(db, "gifQuota", hour);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists() ? snap.data().count : 0;
    if (count >= budget) return false;
    tx.set(ref, { count: count + 1 });
    return true;
  });
}
