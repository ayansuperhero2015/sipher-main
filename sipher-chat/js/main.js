import {
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import * as api from "./api.js";
import { DEFAULT_INVITE } from "./config.js";
import { append, avatar, clear, h, icon, toast } from "./dom.js";
import { filterFor } from "./filter.js";
import { auth } from "./firebase.js";
import { forgetGiphyKey } from "./gifs.js";
import * as live from "./live.js";
import { applyTheme, notify } from "./prefs.js";
import { accessModal, renderGate } from "./ui/access.js";
import { emailActionFromUrl, renderEmailAction } from "./ui/action.js";
import { appearanceModal } from "./ui/appearance.js";
import { pendingSignup, renderAuth } from "./ui/auth.js";
import { createChat } from "./ui/chat.js";
import { addFriendModal, usernameModal } from "./ui/friends.js";
import { gamesModal } from "./ui/games.js";
import { isOnline, renderMembers } from "./ui/members.js";
import { confirmModal, openModal, promptModal } from "./ui/modal.js";
import { reportModal, reportsModal, rulesModal } from "./ui/moderation.js";
import { pollModal } from "./ui/polls.js";
import { profileCard } from "./ui/profile.js";
import { renderServerRail } from "./ui/servers.js";
import { profileSettingsModal, serverSettingsModal } from "./ui/settings.js";
import { DEFAULT_SECTION, renderSidebar, sectionsOf } from "./ui/sidebar.js";

applyTheme();

const appEl = document.getElementById("app");
// Online status: say "I'm here" every 5 minutes, and check who else is
// every 3 minutes while the tab is visible. Kept slow to stay well inside
// Firebase's free daily limits with a class-sized group.
const HEARTBEAT_MS = 5 * 60 * 1000;
const PRESENCE_POLL_MS = 3 * 60 * 1000;

const state = {
  user: null,
  profile: null,
  servers: [],
  serverId: null,
  server: null,
  channels: [],
  channelsLoaded: false,
  channelId: null,
  members: [],
  // uid -> { lastSeen } for everyone, refreshed by pollPresence().
  presence: new Map(),
  // How many messages the open conversation loads ("Load older" raises it).
  messageLimit: api.PAGE_SIZE,
  // Live server docs (name, icon) for every joined server, for the rail.
  serverInfo: new Map(),
  // Direct Messages view ("home"): conversations and the open one.
  home: false,
  dms: [],
  dmId: null,
  // Profiles of DM partners and friends, kept live (names, avatars).
  people: new Map(),
  // Friend requests sent to / by me, and my friends' uids.
  requests: { incoming: [], outgoing: [] },
  friends: [],
  // uids I've blocked.
  blocks: [],
  // serverId -> { channelId: { at, by, everyoneAt, everyoneBy } } (live.js).
  activity: new Map(),
  // "serverId_channelId" -> { at, by, name, channel }: my latest @mentions.
  pings: {},
  // Reports for the open server (owner and moderators only).
  reports: [],
  // The main server (DEFAULT_INVITE). Its owner is the admin of all of
  // Sipher, who decides who can join and who's banned.
  mainServerId: null,
  appAdmin: false,
  accessCode: null,
  waiting: [],
  bans: [],
};

// Active listeners, so they can be torn down when switching views.
const subs = {
  profile: null,
  servers: null,
  server: null,
  channels: null,
  members: null,
  messages: null,
  typing: null,
  reports: null,
  dms: null,
  requests: null,
  friends: null,
  blocks: null,
  pings: null,
  pass: null,
  waiting: null,
  bans: null,
};
const serverInfoSubs = new Map();
const activitySubs = new Map();
const peopleSubs = new Map();
let timers = [];
let ui = null;
// The channel subs.messages is listening to.
let messagesChannel = null;
let lastPresencePoll = 0;
// Channel lists of other servers, read once for the forward dialog.
const channelCache = new Map();
// Re-filters the open server's channel list (set by openServer).
let refreshChannels = null;
// The conversation we last said we're typing in, and the one whose typing
// indicator we're showing.
let typingConvo = null;
let typingWatchKey = null;
// Servers whose rules / welcome were already shown this session.
const rulesShown = new Set();
// What was last seen, so only new DMs and mentions make a sound.
let seenPings = null;
let seenDms = null;

// ---- small utilities ----

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable (private mode); these are just conveniences.
    }
  },
};

function stop(key) {
  subs[key]?.();
  subs[key] = null;
}

function teardown() {
  Object.keys(subs).forEach(stop);
  state.presence = new Map();
  lastPresencePoll = 0;
  channelCache.clear();
  for (const unsub of serverInfoSubs.values()) unsub();
  serverInfoSubs.clear();
  state.serverInfo = new Map();
  for (const unsub of activitySubs.values()) unsub();
  activitySubs.clear();
  state.activity = new Map();
  state.pings = {};
  seenPings = null;
  seenDms = null;
  typingConvo = null;
  refreshChannels = null;
  for (const unsub of peopleSubs.values()) unsub();
  peopleSubs.clear();
  state.people = new Map();
  timers.forEach(clearInterval);
  timers = [];
}

function report(err, fallback = "Something went wrong.") {
  console.error(err);
  const text =
    err?.code === "permission-denied"
      ? "You don't have permission to do that."
      : err?.message || fallback;
  toast(text, "error");
}

// Runs an action and turns failures into a toast.
function guarded(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      report(err);
    }
  };
}

function currentChannel() {
  if (state.home) {
    if (!state.dmId) return null;
    const other = dmPartner(state.dmId);
    return { id: state.dmId, name: other.displayName, dm: other };
  }
  return state.channels.find((c) => c.id === state.channelId) || null;
}

// Firestore path of the open conversation.
function convo() {
  return state.home
    ? api.dmConvo(state.dmId)
    : api.channelConvo(state.serverId, state.channelId);
}

function dmPartner(dmId) {
  const uid = api.otherMember(dmId, state.user.uid);
  return {
    uid,
    displayName: "Unknown user",
    photoURL: null,
    ...state.people.get(uid),
  };
}

function lastRead(dmId) {
  return Number(storage.get(`sipher:dmRead:${dmId}`)) || 0;
}

// Stores the server time of the newest message seen, so device clocks that
// run slow or fast don't affect unread dots.
function markRead(dmId) {
  const dm = state.dms.find((d) => d.id === dmId);
  const seen = dm?.lastMessageAt?.toMillis?.() ?? Date.now();
  if (seen > lastRead(dmId)) storage.set(`sipher:dmRead:${dmId}`, String(seen));
}

function isUnread(dm) {
  if (!dm.lastMessageBy || dm.lastMessageBy === state.user.uid) return false;
  if (state.home && dm.id === state.dmId) return false;
  return (dm.lastMessageAt?.toMillis?.() ?? 0) > lastRead(dm.id);
}

function dmListView() {
  return [...state.dms]
    .sort(
      (a, b) =>
        (b.lastMessageAt?.toMillis?.() ?? 0) -
        (a.lastMessageAt?.toMillis?.() ?? 0),
    )
    .map((dm) => {
      const other = dmPartner(dm.id);
      return {
        id: dm.id,
        other,
        online: isOnline(state.presence.get(other.uid)),
        unread: isUnread(dm),
      };
    });
}

function isOwner() {
  return state.server?.ownerId === state.user?.uid;
}

function myMember() {
  return state.members.find((m) => m.uid === state.user?.uid) || null;
}

// The owner and moderators run the server: pins, deleting messages,
// kicking members, private and read-only channels, reports.
function isMod() {
  return isOwner() || myMember()?.role === "mod";
}

// Moderators pin in servers; both people can pin in a DM.
function canPin() {
  return state.home ? Boolean(state.dmId) : isMod();
}

function isBlocked(uid) {
  return state.blocks.includes(uid);
}

// When the open server's rules were last changed (ms), or 0 if it has none.
function rulesVersion() {
  const s = state.server;
  if (!s?.rules) return 0;
  return s.rulesUpdatedAt?.toMillis?.() ?? 1;
}

function needsRules() {
  if (state.home || isOwner()) return false;
  const v = rulesVersion();
  const me = myMember();
  return Boolean(v && me && (me.rulesAccepted ?? 0) < v);
}

// ---- unread markers (channels) ----

function chReadKey(serverId, channelId) {
  return `sipher:chRead:${serverId}/${channelId}`;
}

function lastChRead(serverId, channelId) {
  return Number(storage.get(chReadKey(serverId, channelId))) || 0;
}

// { unread, mention } for a channel, from the live activity and pings.
function channelMark(serverId, channelId) {
  const me = state.user.uid;
  const read = lastChRead(serverId, channelId);
  const act = state.activity.get(serverId)?.[channelId];
  const ping = state.pings[`${serverId}_${channelId}`];
  const unread = Boolean(act && act.by !== me && act.at > read);
  const mention =
    Boolean(ping && ping.at > read && !isBlocked(ping.by)) ||
    Boolean(act?.everyoneAt > read && act.everyoneBy !== me);
  return { unread: unread || mention, mention };
}

function viewing(serverId, channelId) {
  return (
    !state.home &&
    state.serverId === serverId &&
    state.channelId === channelId &&
    document.visibilityState === "visible"
  );
}

// Marks the open channel as read up to its newest activity.
function markChannelRead() {
  if (state.home || !state.serverId || !state.channelId) return;
  if (document.visibilityState !== "visible") return;
  const { serverId, channelId } = state;
  const act = state.activity.get(serverId)?.[channelId];
  const ping = state.pings[`${serverId}_${channelId}`];
  const seen = Math.max(
    act?.at || 0,
    act?.everyoneAt || 0,
    ping?.at || 0,
    lastChRead(serverId, channelId),
  );
  if (seen > lastChRead(serverId, channelId))
    storage.set(chReadKey(serverId, channelId), String(seen));
}

// Unread / mention totals for a server, for the rail.
function serverMarks(serverId) {
  let unread = false;
  let mentions = 0;
  const channels =
    serverId === state.serverId && !state.home
      ? state.channels.map((c) => c.id)
      : Object.keys(state.activity.get(serverId) || {});
  for (const cid of channels) {
    const m = channelMark(serverId, cid);
    if (m.unread) unread = true;
    if (m.mention) mentions++;
  }
  return { unread, mentions };
}

// One activity listener per joined server, like syncServerInfo.
function syncActivity(servers) {
  const wanted = new Set(servers.map((s) => s.id));
  for (const [id, unsub] of activitySubs) {
    if (wanted.has(id)) continue;
    unsub();
    activitySubs.delete(id);
    state.activity.delete(id);
  }
  for (const id of wanted) {
    if (activitySubs.has(id)) continue;
    activitySubs.set(
      id,
      live.watchActivity(id, (act) => {
        state.activity.set(id, act);
        if (!ui) return;
        if (id === state.serverId) markChannelRead();
        renderRail();
        if (id === state.serverId && !state.home) renderSide();
      }),
    );
  }
}

function memberMap() {
  return new Map(currentMembers().map((m) => [m.uid, m]));
}

// The open server's members, or in a DM the two participants.
function currentMembers() {
  if (!state.home) return state.members;
  if (!state.dmId) return [];
  const me = { uid: state.user.uid, ...state.profile };
  return [me, dmPartner(state.dmId)];
}

function homeHash(dmId) {
  return dmId ? `#/@me/${dmId}` : "#/@me";
}

function setHash(serverId, channelId) {
  const hash = serverId
    ? `#/${serverId}${channelId ? "/" + channelId : ""}`
    : "";
  replaceHash(hash);
}

function replaceHash(hash) {
  if (location.hash !== hash)
    history.replaceState(null, "", location.pathname + location.search + hash);
}

function parseHash() {
  const [, serverId, channelId] = location.hash.split("/");
  return { serverId: serverId || null, channelId: channelId || null };
}

// ---- rendering ----

function buildLayout() {
  const rail = h("nav", { class: "server-rail", "aria-label": "Servers" });
  const sidebar = h("aside", { class: "sidebar" });
  const chatEl = h("main", { class: "chat" });
  const members = h("aside", { class: "member-list", "aria-label": "Members" });
  const scrim = h("div", {
    class: "scrim",
    onclick: () => root.classList.remove("show-sidebar"),
  });
  const root = h(
    "div",
    { class: "layout" },
    rail,
    sidebar,
    chatEl,
    members,
    scrim,
  );
  if (storage.get("sipher:hideMembers") === "1")
    root.classList.add("hide-members");

  const banner = h("div", { class: "verify-banner", hidden: true });
  clear(appEl).append(h("div", { class: "app-shell" }, banner, root));
  const chat = createChat(chatEl, chatActions);
  ui = { root, rail, sidebar, chat, members, banner };
  renderBanner();
}

// Reminds unverified accounts to confirm their email address.
function renderBanner() {
  const user = auth.currentUser;
  if (!ui || !user) return;
  ui.banner.hidden = user.emailVerified;
  if (user.emailVerified) return;
  clear(ui.banner).append(
    h("span", null, `Please verify your email address (${user.email}).`),
    h(
      "button",
      {
        class: "link-btn",
        onclick: guarded(async () => {
          await sendEmailVerification(user);
          toast("Verification email sent. Check your inbox.", "ok");
        }),
      },
      "Resend email",
    ),
    h(
      "button",
      {
        class: "link-btn",
        onclick: guarded(async () => {
          await user.reload();
          renderBanner();
          if (!user.emailVerified) toast("Not verified yet.");
        }),
      },
      "I've verified it",
    ),
  );
}

function renderRail() {
  const servers = state.servers.map((s) => {
    const info = state.serverInfo.get(s.id);
    return {
      id: s.id,
      name: info?.name || s.name,
      icon: info?.icon || null,
      ...serverMarks(s.id),
    };
  });
  const unread =
    state.dms.filter(isUnread).length + state.requests.incoming.length;
  try {
    document.title = unread ? `(${unread}) Sipher` : "Sipher";
  } catch {
    // Some browsers can't retitle an SVG page; the badge still shows.
  }
  renderServerRail(
    ui.rail,
    {
      servers,
      serverId: state.home ? null : state.serverId,
      home: state.home,
      unreadDms: unread,
    },
    { openServer: navigateServer, addServer, openHome: navigateHome },
  );
}

// Keeps one listener per joined server so the rail shows current names/icons.
function syncServerInfo(servers) {
  const wanted = new Set(servers.map((s) => s.id));
  for (const [id, unsub] of serverInfoSubs) {
    if (wanted.has(id)) continue;
    unsub();
    serverInfoSubs.delete(id);
    state.serverInfo.delete(id);
  }
  for (const id of wanted) {
    if (serverInfoSubs.has(id)) continue;
    serverInfoSubs.set(
      id,
      api.watchServer(
        id,
        (server) => {
          if (server) state.serverInfo.set(id, server);
          else state.serverInfo.delete(id);
          if (ui) renderRail();
        },
        // Losing access is handled when the server is opened; just stop here.
        () => state.serverInfo.delete(id),
      ),
    );
  }
}

function friendListView() {
  return state.friends
    .map((uid) => ({
      uid,
      displayName: "Unknown user",
      ...state.people.get(uid),
      online: isOnline(state.presence.get(uid)),
    }))
    .sort(
      (a, b) =>
        b.online - a.online || a.displayName.localeCompare(b.displayName),
    );
}

function renderSide() {
  const marks = new Map();
  if (!state.home && state.serverId)
    for (const c of state.channels)
      if (c.id !== state.channelId)
        marks.set(c.id, channelMark(state.serverId, c.id));
  renderSidebar(
    ui.sidebar,
    {
      ...state,
      isMod: !state.home && isMod(),
      channelMarks: marks,
      dmList: state.home ? dmListView() : [],
      friendList: state.home ? friendListView() : [],
    },
    sidebarActions,
  );
}

function renderChat() {
  let emptyMessage = "";
  if (state.home) {
    emptyMessage =
      "Pick a conversation, or click someone in a server's member list to message them.";
  } else if (!state.serverId) {
    emptyMessage =
      state.servers.length === 0
        ? "You're not in any servers yet. Use the + on the left to create or join one."
        : "Select a server.";
  } else if (state.channelsLoaded && state.channels.length === 0) {
    emptyMessage = isOwner()
      ? "This server has no channels. Create one from the server menu."
      : "No channels here yet.";
  }
  const channel = currentChannel();
  const blockedThem = state.home && state.dmId && isBlocked(channel?.dm?.uid);
  ui.chat.setContext({
    uid: state.user.uid,
    channel,
    members: memberMap(),
    canModerate: !state.home && isMod(),
    canPin: canPin(),
    canReport: !state.home,
    canSend: state.home ? !blockedThem : isMod() || !channel?.readOnly,
    lockedText: blockedThem
      ? "You blocked this person. Unblock them from their profile to message them."
      : null,
    gate: needsRules()
      ? {
          text: "Read and accept the server rules to start chatting.",
          button: "Read the rules",
          onClick: () => showRules(true),
        }
      : null,
    slowMode: !state.home && !isMod() ? channel?.slowMode || 0 : 0,
    blocked: new Set(state.blocks),
    filter: state.home ? null : filterFor(state.server),
    meName: state.profile?.displayName,
    emptyMessage,
  });
}

function renderMemberList() {
  renderMembers(
    ui.members,
    {
      members: currentMembers(),
      presence: state.presence,
      ownerId: state.home ? null : state.server?.ownerId,
      uid: state.user.uid,
      isMod: !state.home && isMod(),
    },
    { onKick: kickMember, onMessage: startDm, onOpen: (m) => openProfile(m.uid, m.displayName) },
  );
}

function renderAll() {
  if (!ui) return;
  renderRail();
  renderSide();
  renderChat();
  renderMemberList();
}

// ---- navigation ----

function route() {
  const { serverId, channelId } = parseHash();
  if (serverId === "@me") {
    openHome(channelId);
  } else if (serverId && state.servers.some((s) => s.id === serverId)) {
    openServer(serverId, channelId);
  } else if (state.servers.length > 0) {
    const last = storage.get("sipher:lastServer");
    const target = state.servers.find((s) => s.id === last) || state.servers[0];
    openServer(target.id, null);
  } else {
    openHome(null);
  }
}

function navigateHome() {
  openHome(state.home ? state.dmId : null);
  ui.root.classList.add("show-sidebar");
}

// The Direct Messages view, optionally with a conversation open.
function openHome(dmId) {
  if (dmId && !dmId.split("_").includes(state.user.uid)) dmId = null;
  if (!state.home) {
    closeServer();
    state.home = true;
  }
  if (dmId === state.dmId && (subs.messages || !dmId)) {
    replaceHash(homeHash(dmId));
    return renderAll();
  }
  stop("messages");
  stop("typing");
  setTyping(false);
  state.dmId = dmId;
  replaceHash(homeHash(dmId));
  if (dmId) {
    watchPerson(api.otherMember(dmId, state.user.uid));
    markRead(dmId);
    ui.root.classList.remove("show-sidebar");
    state.messageLimit = api.PAGE_SIZE;
    watchConvo();
  }
  renderAll();
}

// Listens to the newest messages of the open channel or DM.
function watchConvo() {
  stop("messages");
  const count = state.messageLimit;
  const dmId = state.home ? state.dmId : null;
  const path = convo();
  subs.messages = api.watchMessages(
    path,
    (messages) => {
      if (dmId) markRead(dmId);
      else markChannelRead();
      ui.chat.setMessages(messages, messages.length >= count);
    },
    (err) => report(err, "Couldn't load messages."),
    count,
  );
  // "Load older" re-runs this for the same conversation; keep that listener.
  const key = live.convoKey(path);
  if (subs.typing && typingWatchKey === key) return;
  setTyping(false);
  stop("typing");
  typingWatchKey = key;
  subs.typing = live.watchTyping(path, state.user.uid, (people) =>
    ui.chat.setTyping(people.filter((p) => !isBlocked(p.uid))),
  );
}

// Tells the conversation we're typing (or stopped).
function setTyping(on) {
  const me = state.user?.uid;
  if (!me) return;
  if (on) {
    typingConvo = convo();
    live
      .setTyping(typingConvo, me, state.profile?.displayName, true)
      .catch(() => {});
  } else if (typingConvo) {
    live.setTyping(typingConvo, me, null, false).catch(() => {});
    typingConvo = null;
  }
}

function loadOlder() {
  if (!subs.messages) return;
  state.messageLimit += api.PAGE_SIZE;
  watchConvo();
}

// Opens (creating if needed) a DM with someone from a member list.
const startDm = guarded(async (member) => {
  state.people.set(member.uid, {
    ...member,
    ...state.people.get(member.uid),
  });
  const id = await api.openDm(state.user.uid, member.uid);
  openHome(id);
});

function watchPerson(uid) {
  if (peopleSubs.has(uid)) return;
  peopleSubs.set(
    uid,
    api.watchUser(uid, (data) => {
      if (data) state.people.set(uid, data);
      if (ui && state.home) renderAll();
    }),
  );
}

function navigateServer(serverId) {
  openServer(serverId, null);
  ui.root.classList.add("show-sidebar");
}

function closeServer() {
  setTyping(false);
  ["server", "channels", "members", "messages", "typing", "reports"].forEach(stop);
  messagesChannel = null;
  refreshChannels = null;
  Object.assign(state, {
    reports: [],
    home: false,
    dmId: null,
    serverId: null,
    server: null,
    channels: [],
    channelsLoaded: false,
    channelId: null,
    members: [],
  });
  setHash(null);
  renderAll();
}

function openServer(serverId, channelId) {
  if (serverId === state.serverId && !state.home) {
    if (channelId && channelId !== state.channelId) openChannel(channelId);
    return;
  }
  closeServer();
  state.serverId = serverId;
  state.channelId = channelId;
  storage.set("sipher:lastServer", serverId);
  setHash(serverId, channelId);

  let gone = false;
  const lost = async (err) => {
    // Server deleted, or we were kicked: drop it from the sidebar.
    if (err && err.code !== "permission-denied")
      return report(err, "Couldn't load the server.");
    if (gone || state.serverId !== serverId) return;
    gone = true;
    const name = state.servers.find((s) => s.id === serverId)?.name;
    if (!(await api.removedFromServer(state.user.uid, serverId))) {
      if (name) toast(`Couldn't open ${name}. Try reloading.`);
      return;
    }
    await api.forgetServer(state.user.uid, serverId).catch(() => {});
    if (name) toast(`You no longer have access to ${name}.`);
  };

  subs.server = api.watchServer(
    serverId,
    (server) => {
      if (!server) return lost();
      const first = !state.server;
      state.server = server;
      const entry = state.servers.find((s) => s.id === serverId);
      if (entry && entry.name !== server.name)
        api
          .syncServerName(state.user.uid, serverId, server.name)
          .catch(() => {});
      // Who owns the server decides which channels are visible.
      if (first && rawChannels) return showChannels();
      maybeShowRules();
      renderAll();
    },
    lost,
  );

  let rawChannels = null;
  // Private channels are only listed for the owner and moderators. Waits
  // for the server doc, since that says who the owner is.
  const showChannels = () => {
    if (!state.server || !rawChannels) return;
    const channels = rawChannels
      .filter((c) => !c.private || isMod())
      .sort((a, b) => api.channelOrder(a) - api.channelOrder(b));
    state.channels = channels;
    state.channelsLoaded = true;
    if (!channels.some((c) => c.id === state.channelId)) {
      const remembered = storage.get(`sipher:lastChannel:${serverId}`);
      const next = channels.find((c) => c.id === remembered) || channels[0];
      state.channelId = null;
      if (next) return openChannel(next.id);
      stop("messages");
      messagesChannel = null;
    }
    if (state.channelId && messagesChannel !== state.channelId)
      return openChannel(state.channelId);
    renderAll();
  };
  refreshChannels = showChannels;

  subs.channels = api.watchChannels(
    serverId,
    (channels) => {
      rawChannels = channels;
      showChannels();
    },
    lost,
  );

  subs.members = api.watchMembers(
    serverId,
    (members) => {
      // Open listeners aren't re-checked against the rules, so notice being
      // kicked by dropping out of the member list.
      if (!members.some((m) => m.uid === state.user.uid)) return lost();
      const wasMod = isMod();
      state.members = members;
      syncReports();
      maybeShowRules();
      // Becoming (or no longer being) a moderator changes what's visible.
      if (wasMod !== isMod() && rawChannels) return showChannels();
      renderAll();
    },
    lost,
  );

  renderAll();
}

// Moderators get a live list of reports for the open server.
function syncReports() {
  const serverId = state.serverId;
  if (!isMod()) {
    stop("reports");
    state.reports = [];
    return;
  }
  if (subs.reports) return;
  subs.reports = api.watchReports(
    serverId,
    (reports) => {
      if (state.serverId !== serverId) return;
      state.reports = reports;
      renderSide();
    },
    (err) => console.warn("Couldn't load reports", err),
  );
}

// The first time a server is opened this session: its rules (to accept) or
// welcome message (shown once per device).
function maybeShowRules() {
  const s = state.server;
  if (!s || !myMember() || rulesShown.has(s.id)) return;
  if (needsRules()) {
    rulesShown.add(s.id);
    showRules(true);
  } else if (s.welcome && !storage.get(`sipher:welcomed:${s.id}`) && !isOwner()) {
    rulesShown.add(s.id);
    storage.set(`sipher:welcomed:${s.id}`, "1");
    showRules(false);
  }
}

const showRules = guarded(async (mustAccept) => {
  const s = state.server;
  if (!s) return;
  const version = rulesVersion();
  const agreed = await rulesModal(s, mustAccept && needsRules());
  if (agreed && version) {
    await api.acceptRules(s.id, state.user.uid, version);
    toast("Thanks! You can chat now.", "ok");
  }
});

function openChannel(channelId) {
  const serverId = state.serverId;
  stop("messages");
  stop("typing");
  setTyping(false);
  messagesChannel = null;
  state.channelId = channelId;
  storage.set(`sipher:lastChannel:${serverId}`, channelId);
  setHash(serverId, channelId);
  markChannelRead();
  ui.root.classList.remove("show-sidebar");
  renderAll();

  if (!state.channels.some((c) => c.id === channelId)) return;
  messagesChannel = channelId;
  state.messageLimit = api.PAGE_SIZE;
  watchConvo();
}

// Reads everyone's last heartbeat from the shared presence doc. Skipped
// while the tab is hidden, and at most once a minute.
async function pollPresence(force = false) {
  if (!force) {
    if (document.visibilityState === "hidden") return;
    if (Date.now() - lastPresencePoll < 60 * 1000) return;
  }
  lastPresencePoll = Date.now();
  try {
    state.presence = await api.fetchPresence();
  } catch (err) {
    return console.warn("Couldn't check who's online", err);
  }
  if (!ui) return;
  renderMemberList();
  if (state.home) renderSide();
}

// ---- actions ----

// Letters, digits and _ can't touch a mention (matches ui/chat.js).
const WORD = "[\\p{L}\\p{N}_]";

function mentionedIn(text) {
  const named = (name) =>
    new RegExp(
      `(?<!${WORD})@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!${WORD})`,
      "u",
    ).test(text);
  return {
    everyone: named("everyone"),
    uids: state.members
      .filter((m) => m.displayName && named(m.displayName))
      .map((m) => m.uid),
  };
}

const chatActions = {
  send: async (text, extra = {}) => {
    const channel = currentChannel();
    const serverId = state.serverId;
    const slow = !state.home && !isMod() && channel?.slowMode > 0;
    try {
      await api.sendMessage(convo(), state.user, state.profile, text, {
        ...extra,
        slow,
      });
    } catch (err) {
      if (slow && err?.code === "permission-denied")
        toast("Slow mode is on. Wait a little before sending again.", "error");
      else if (state.home && err?.code === "permission-denied")
        toast("You can't message this person.", "error");
      else report(err, "Message failed to send.");
      throw err;
    }
    // Unread markers and @mention pings (not for private channels, which
    // most members can't see).
    if (!state.home && channel && !channel.private) {
      const { everyone, uids } = mentionedIn(text);
      if (extra.replyTo?.authorId) uids.push(extra.replyTo.authorId);
      live
        .noteMessage({
          serverId,
          channelId: channel.id,
          channelName: channel.name,
          uid: state.user.uid,
          name: state.profile.displayName,
          mentioned: [...new Set(uids)],
          everyone,
        })
        .catch((err) => console.warn("Couldn't update unread markers", err));
    }
  },
  typing: (on) => setTyping(on),
  createPoll: () => pollModal(),
  openGames: () => gamesModal(),
  vote: guarded((msg, index) =>
    api.setVote(convo(), msg.id, state.user.uid, index),
  ),
  report: guarded(async (msg) => {
    const channel = currentChannel();
    const author = memberMap().get(msg.authorId)?.displayName || msg.authorName;
    const reason = await reportModal(msg, author);
    if (!reason) return;
    await api.reportMessage(state.serverId, channel, msg, { uid: state.user.uid, ...state.profile }, reason);
    toast("Thanks. The moderators will take a look.", "ok");
  }),
  openProfile: (uid, name) => openProfile(uid, name),
  edit: guarded((msg, text) => api.editMessage(convo(), msg.id, text)),
  react: guarded((msg, emoji) =>
    api.setReaction(convo(), msg.id, state.user.uid, emoji),
  ),
  pin: guarded(async (msg, pinned) => {
    await api.setPinned(convo(), msg.id, pinned);
    toast(pinned ? "Message pinned." : "Message unpinned.", "ok");
  }),
  forward: (msg) => forwardMessage(msg),
  showPins: () => showPins(),
  loadOlder,
  remove: guarded(async (msg, skipConfirm) => {
    if (!skipConfirm) {
      const ok = await confirmModal({
        title: "Delete Message",
        message:
          "Are you sure you want to delete this message? (Tip: hold Shift when clicking delete to skip this.)",
        confirm: "Delete",
        danger: true,
      });
      if (!ok) return;
    }
    await api.deleteMessage(convo(), msg.id);
  }),
  toggleMembers: () => {
    const hidden = ui.root.classList.toggle("hide-members");
    storage.set("sipher:hideMembers", hidden ? "1" : "0");
  },
  toggleSidebar: () => ui.root.classList.toggle("show-sidebar"),
};

const sidebarActions = {
  openChannel,
  openDm: (dmId) => openHome(dmId),
  invite: () => showInvite(),
  createChannel: guarded(async (categoryId = null) => {
    const section = sectionsOf(state.server, state.channels).find(
      (s) => s.id === categoryId,
    );
    const raw = await promptModal({
      title: "Create Channel",
      subtitle: `in ${section?.name || "Text Channels"}`,
      label: "Channel name",
      placeholder: "new-channel",
      confirm: "Create Channel",
      maxLength: 32,
    });
    const name = raw && api.cleanChannelName(raw);
    if (!name) return;
    const id = await api.createChannel(state.serverId, name, section?.id ?? null);
    state.channelId = id;
    setHash(state.serverId, id);
  }),
  createSection: guarded(async () => {
    const name = await promptModal({
      title: "Create Section",
      subtitle: "Sections group channels together, like “Fun” or “School”.",
      label: "Section name",
      placeholder: "New Section",
      confirm: "Create Section",
      maxLength: 32,
    });
    if (!name) return;
    await api.saveSections(state.serverId, [
      ...(state.server.categories || []),
      { id: api.newSectionId(), name },
    ]);
  }),
  editSection: guarded((section) => editSection(section)),
  // Drops section `id` before (or after) section `targetId`. DEFAULT_SECTION
  // stands for the "Text Channels" group, which is saved in the list too
  // so it can sit anywhere.
  moveSection: guarded(async (id, targetId, after) => {
    const byId = new Map(
      (state.server.categories || []).map((c) => [c.id, c]),
    );
    const order = sectionsOf(state.server, state.channels).map(
      (s) => s.id ?? DEFAULT_SECTION,
    );
    const from = order.indexOf(id);
    if (from < 0) return;
    const next = order.filter((k) => k !== id);
    let to = next.indexOf(targetId);
    if (to < 0) return;
    if (after) to++;
    next.splice(to, 0, id);
    if (next.join() === order.join()) return;
    await api.saveSections(
      state.serverId,
      next.map((k) =>
        k === DEFAULT_SECTION
          ? { id: DEFAULT_SECTION, name: "Text Channels" }
          : byId.get(k),
      ),
    );
  }),
  moveChannel: guarded((channelId, categoryId, index) =>
    moveChannel(channelId, categoryId, index),
  ),
  editChannel: guarded(async (channel) => {
    let action = null;
    const sections = sectionsOf(state.server, state.channels);
    const current = sections.find((s) =>
      s.channels.some((c) => c.id === channel.id),
    );
    const spot = current.channels.findIndex((c) => c.id === channel.id);
    await new Promise((resolve) =>
      openModal({
        title: `#${channel.name}`,
        onClose: resolve,
        render: (close) => {
          const input = h("input", {
            class: "input",
            value: channel.name,
            maxLength: 32,
          });
          const select = h(
            "select",
            { class: "input" },
            sections.map((s) =>
              h(
                "option",
                { value: s.id ?? "", selected: s === current },
                s.id ? s.name : "No section (Text Channels)",
              ),
            ),
          );
          const toggle = (label, hint, checked) => {
            const box = h("input", { type: "checkbox", checked });
            return [
              box,
              h(
                "label",
                { class: "toggle-row" },
                box,
                h(
                  "span",
                  null,
                  h("span", { class: "strong" }, label),
                  h("span", { class: "muted small toggle-hint" }, hint),
                ),
              ),
            ];
          };
          const [chatBox, chatRow] = toggle(
            "Everyone can send messages",
            "Turn off for an announcements-style channel: only you and moderators can post, everyone can still read and react.",
            !channel.readOnly,
          );
          const [viewBox, viewRow] = toggle(
            "Everyone can see this channel",
            "Turn off to make it private: it's hidden from everyone but you and moderators.",
            !channel.private,
          );
          const slow = h(
            "select",
            { class: "input" },
            api.SLOW_MODES.map((s) =>
              h(
                "option",
                { value: s, selected: s === (channel.slowMode || 0) },
                s === 0 ? "Off" : s < 60 ? `${s} seconds` : `${s / 60} minute${s === 60 ? "" : "s"}`,
              ),
            ),
          );
          const nudge = (by) => {
            action = { move: by };
            close();
          };
          return h(
            "form",
            {
              class: "modal-form",
              onsubmit: (e) => {
                e.preventDefault();
                action = {
                  rename: api.cleanChannelName(input.value),
                  section: select.value || null,
                  readOnly: !chatBox.checked,
                  private: !viewBox.checked,
                  slowMode: Number(slow.value),
                };
                close();
              },
            },
            h(
              "label",
              { class: "field" },
              h("span", { class: "field-label" }, "Channel name"),
              input,
            ),
            h(
              "label",
              { class: "field" },
              h("span", { class: "field-label" }, "Section"),
              select,
            ),
            h(
              "div",
              { class: "field" },
              h("span", { class: "field-label" }, "Permissions"),
              viewRow,
              chatRow,
            ),
            h(
              "label",
              { class: "field" },
              h("span", { class: "field-label" }, "Slow mode"),
              slow,
              h(
                "span",
                { class: "muted small" },
                "How long each person waits between messages. You and moderators aren't affected.",
              ),
            ),
            h(
              "div",
              { class: "field" },
              h("span", { class: "field-label" }, "Position"),
              h(
                "div",
                { class: "move-row" },
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn secondary",
                    disabled: spot === 0,
                    onclick: () => nudge(-1),
                  },
                  "Move up",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    class: "btn secondary",
                    disabled: spot === current.channels.length - 1,
                    onclick: () => nudge(1),
                  },
                  "Move down",
                ),
              ),
            ),
            h(
              "div",
              { class: "modal-actions" },
              h(
                "button",
                {
                  type: "button",
                  class: "btn ghost danger-text",
                  onclick: () => {
                    action = { delete: true };
                    close();
                  },
                },
                "Delete Channel",
              ),
              h("div", { class: "spacer" }),
              h("button", { type: "submit", class: "btn primary" }, "Save"),
            ),
          );
        },
      }),
    );
    if (action?.move) {
      await moveChannel(channel.id, current.id, spot + action.move);
      return;
    }
    if (action?.rename && action.rename !== channel.name) {
      await api.renameChannel(state.serverId, channel.id, action.rename);
    }
    if (
      action &&
      "private" in action &&
      (action.private !== Boolean(channel.private) ||
        action.readOnly !== Boolean(channel.readOnly) ||
        action.slowMode !== (channel.slowMode || 0))
    ) {
      await api.setChannelPermissions(state.serverId, channel.id, {
        private: action.private,
        readOnly: action.readOnly,
        slowMode: action.slowMode,
      });
      toast("Channel settings saved.", "ok");
    }
    if (action && "section" in action && action.section !== current.id) {
      const target = sections.find((s) => s.id === action.section);
      await moveChannel(channel.id, action.section, target.channels.length);
    } else if (action?.delete) {
      const ok = await confirmModal({
        title: "Delete Channel",
        message: `Are you sure you want to delete #${channel.name}? This cannot be undone.`,
        confirm: "Delete Channel",
        danger: true,
      });
      if (ok) {
        await api.deleteChannel(state.serverId, channel.id);
        live.forgetChannel(state.serverId, channel.id).catch(() => {});
      }
    }
  }),
  showReports: () => showReports(),
  manageAccess: () => manageAccess(),
  showRules: () => showRules(false),
  appearance: () => appearanceModal(),
  serverSettings: guarded(async () => {
    const server = state.server;
    // The main server's owner also manages the GIPHY key.
    const mainServerId = isOwner()
      ? await api.serverForInvite(DEFAULT_INVITE).catch(() => null)
      : null;
    const managesApp = server.id === mainServerId;
    const currentKey = managesApp
      ? await api.getGiphyKey().catch(() => "")
      : undefined;
    const result = await serverSettingsModal(server, currentKey);
    if (!result) return;
    let changed = false;
    const extra = {
      welcome: result.welcome,
      rules: result.rules,
      filter: result.filter,
    };
    const extraChanged =
      extra.welcome !== (server.welcome || "") ||
      extra.rules !== (server.rules || "") ||
      extra.filter !== Boolean(server.filter);
    if (
      result.name !== server.name ||
      result.image !== (server.icon || null) ||
      extraChanged
    ) {
      await api.updateServer(
        server.id,
        { name: result.name, icon: result.image },
        extra,
      );
      changed = true;
    }
    if (managesApp && result.extra !== currentKey) {
      await api.setGiphyKey(result.extra);
      forgetGiphyKey();
      changed = true;
    }
    if (changed) toast("Server updated.", "ok");
  }),
  leaveServer: guarded(async () => {
    const ok = await confirmModal({
      title: `Leave '${state.server.name}'`,
      message: `Are you sure you want to leave ${state.server.name}? You won't be able to rejoin unless you are re-invited.`,
      confirm: "Leave Server",
      danger: true,
    });
    if (!ok) return;
    const id = state.serverId;
    closeServer();
    await api.leaveServer(state.user.uid, id);
  }),
  deleteServer: guarded(async () => {
    const name = state.server.name;
    const typed = await promptModal({
      title: `Delete '${name}'`,
      subtitle:
        "This will delete the server and all of its channels. Type the server name to confirm.",
      label: "Server name",
      placeholder: name,
      confirm: "Delete Server",
    });
    if (typed !== name) {
      if (typed != null)
        toast("The name didn't match, so nothing was deleted.");
      return;
    }
    const id = state.serverId;
    closeServer();
    await api.deleteServer(state.user.uid, id);
    toast(`Deleted ${name}.`);
  }),
  editProfile: guarded(async () => {
    const { displayName, photoURL = null } = state.profile;
    const result = await profileSettingsModal(state.user.uid, state.profile);
    if (!result) return;
    const fields = {};
    if (result.name !== displayName) fields.displayName = result.name;
    if (result.image !== photoURL) fields.photoURL = result.image;
    if (result.about !== (state.profile.about || "")) fields.about = result.about;
    if (Object.keys(fields).length === 0) return;
    if (fields.displayName) {
      await updateProfile(auth.currentUser, { displayName: result.name });
    }
    await api.updateMyProfile(
      state.user.uid,
      fields,
      state.servers.map((s) => s.id),
    );
    toast("Profile updated.", "ok");
  }),
  changeUsername: () => chooseUsername(),
  addFriend: () =>
    addFriendModal(async (name, note) => {
      if (name === state.profile.username) throw new Error("That's you!");
      const person = await api.lookupUsername(name);
      if (!person) throw new Error(`No one has the username @${name}.`);
      await requestFriend(person, note);
    }),
  acceptRequest: guarded(async (r) => {
    await api.acceptRequest(state.user.uid, r);
    toast(`You're now friends with ${r.fromName}.`, "ok");
  }),
  declineRequest: guarded((r) => api.deleteRequest(r.id)),
  cancelRequest: guarded((r) => api.deleteRequest(r.id)),
  messageFriend: (f) => startDm(f),
  removeFriend: guarded(async (f) => {
    const ok = await confirmModal({
      title: `Remove ${f.displayName}`,
      message: `Remove ${f.displayName} from your friends? Your messages with them stay.`,
      confirm: "Remove Friend",
      danger: true,
    });
    if (ok) await api.removeFriend(state.user.uid, f.uid);
  }),
  signOut: guarded(async () => {
    const ok = await confirmModal({
      title: "Log Out",
      message: "Are you sure you want to log out?",
      confirm: "Log Out",
    });
    if (ok) await signOut(auth);
  }),
};

// ---- channel sections ----

// Puts a channel at `index` within a section (null = no section), then
// renumbers every channel so the saved order matches the sidebar.
async function moveChannel(channelId, categoryId, index) {
  const sections = sectionsOf(state.server, state.channels);
  const moving = state.channels.find((c) => c.id === channelId);
  const target = sections.find((s) => s.id === categoryId);
  if (!moving || !target) return;
  for (const s of sections) s.channels = s.channels.filter((c) => c !== moving);
  const at = Math.max(0, Math.min(index, target.channels.length));
  target.channels.splice(at, 0, moving);

  const moves = [];
  let position = 0;
  for (const s of sections)
    for (const c of s.channels) {
      if (c.position !== position || (c.categoryId ?? null) !== s.id)
        moves.push({ id: c.id, categoryId: s.id, position });
      position++;
    }
  if (moves.length) await api.moveChannels(state.serverId, moves);
}

async function editSection(section) {
  const categories = state.server.categories || [];
  const i = categories.findIndex((c) => c.id === section.id);
  let action = null;
  await new Promise((resolve) =>
    openModal({
      title: `Edit ${section.name}`,
      onClose: resolve,
      render: (close) => {
        const input = h("input", {
          class: "input",
          value: section.name,
          maxLength: 32,
        });
        const pick = (a) => () => {
          action = a;
          close();
        };
        return h(
          "form",
          {
            class: "modal-form",
            onsubmit: (e) => {
              e.preventDefault();
              const name = input.value.trim();
              if (name) action = { rename: name };
              close();
            },
          },
          h(
            "label",
            { class: "field" },
            h("span", { class: "field-label" }, "Section name"),
            input,
          ),
          h(
            "div",
            { class: "field" },
            h("span", { class: "field-label" }, "Position"),
            h(
              "div",
              { class: "move-row" },
              h(
                "button",
                {
                  type: "button",
                  class: "btn secondary",
                  disabled: i === 0,
                  onclick: pick({ move: -1 }),
                },
                "Move up",
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "btn secondary",
                  disabled: i === categories.length - 1,
                  onclick: pick({ move: 1 }),
                },
                "Move down",
              ),
            ),
          ),
          h(
            "div",
            { class: "modal-actions" },
            h(
              "button",
              {
                type: "button",
                class: "btn ghost danger-text",
                onclick: pick({ delete: true }),
              },
              "Delete Section",
            ),
            h("div", { class: "spacer" }),
            h("button", { type: "submit", class: "btn primary" }, "Save"),
          ),
        );
      },
    }),
  );
  if (!action || i < 0) return;
  const next = [...categories];
  if (action.rename) {
    if (action.rename === section.name) return;
    next[i] = { ...next[i], name: action.rename };
    await api.saveSections(state.serverId, next);
  } else if (action.move) {
    const [cat] = next.splice(i, 1);
    next.splice(i + action.move, 0, cat);
    await api.saveSections(state.serverId, next);
  } else if (action.delete) {
    const ok = await confirmModal({
      title: "Delete Section",
      message: `Delete the ${section.name} section? Its channels won't be deleted; they move to the top of the list.`,
      confirm: "Delete Section",
      danger: true,
    });
    if (!ok) return;
    next.splice(i, 1);
    await api.saveSections(
      state.serverId,
      next,
      section.channels.map((c) => c.id),
    );
  }
}

function chooseUsername() {
  return usernameModal(state.profile, async (name) => {
    await api.setUsername(state.user.uid, name, state.profile.username);
    toast(`Your username is now @${name}.`, "ok");
  });
}

// Sends a friend request (or accepts theirs). Throws a readable error.
async function requestFriend(person, note = "") {
  const me = state.user.uid;
  if (isBlocked(person.uid))
    throw new Error(`You blocked ${person.displayName}. Unblock them first.`);
  if (state.friends.includes(person.uid))
    throw new Error(`You're already friends with ${person.displayName}.`);
  const theirs = state.requests.incoming.find((r) => r.from === person.uid);
  if (theirs) {
    await api.acceptRequest(me, theirs);
    toast(`${person.displayName} had already asked. You're now friends!`, "ok");
    return;
  }
  if (state.requests.outgoing.some((r) => r.to === person.uid))
    throw new Error(`You already sent ${person.displayName} a request.`);
  try {
    await api.sendFriendRequest(me, state.profile, person, note);
  } catch (err) {
    if (err?.code === "permission-denied")
      throw new Error(`You can't send ${person.displayName} a friend request.`);
    throw err;
  }
  toast(`Friend request sent to ${person.displayName}.`, "ok");
}

// The profile card for anyone you click on.
const openProfile = guarded(async (uid, fallbackName) => {
  if (!uid) return;
  const me = state.user.uid;
  const member = state.home ? null : state.members.find((m) => m.uid === uid);
  const known = member || state.people.get(uid) || {};
  const person = {
    uid,
    displayName: fallbackName || "Unknown user",
    ...known,
    ...(await api.getUser(uid).catch(() => null)),
  };
  const role = state.server?.ownerId === uid ? "owner" : member?.role;
  const self = uid === me;
  profileCard(
    {
      person,
      role: state.home ? null : role,
      online: isOnline(state.presence.get(uid)),
      self,
      friend: state.friends.includes(uid),
      requested: state.requests.outgoing.some((r) => r.to === uid),
      blocked: isBlocked(uid),
      canSetRole: Boolean(member) && !self && isOwner() && role !== "owner",
      canKick:
        Boolean(member) && !self && role !== "owner" && (isOwner() || (isMod() && role !== "mod")),
      canBan: state.appAdmin && !self,
    },
    {
      message: (p) => startDm(p),
      addFriend: guarded((p) => requestFriend(p)),
      editProfile: () => sidebarActions.editProfile(),
      block: guarded(async (p) => {
        const ok = await confirmModal({
          title: `Block ${p.displayName}`,
          message: `${p.displayName} won't be able to message you or send friend requests, and their messages will be hidden for you. They won't be told. You'll also stop being friends.`,
          confirm: "Block",
          danger: true,
        });
        if (!ok) return;
        await api.blockUser(me, p.uid);
        toast(`Blocked ${p.displayName}.`, "ok");
      }),
      unblock: guarded(async (p) => {
        await api.unblockUser(me, p.uid);
        toast(`Unblocked ${p.displayName}.`, "ok");
      }),
      setRole: guarded(async (p, newRole) => {
        await api.setMemberRole(state.serverId, p.uid, newRole);
        toast(
          newRole === "mod"
            ? `${p.displayName} is now a moderator.`
            : `${p.displayName} is no longer a moderator.`,
          "ok",
        );
      }),
      kick: (p) => kickMember(member || p),
      ban: (p) => banPerson(p.uid, p.displayName),
    },
  );
});

// ---- who can join (the admin of all of Sipher) ----

const banPerson = guarded(async (uid, name) => {
  const ok = await confirmModal({
    title: `Ban ${name}`,
    message: `${name} will be locked out of all of Sipher straight away: every server, DM and friend. They can't get back in with the access code. You can unban them from Who Can Join.`,
    confirm: "Ban",
    danger: true,
  });
  if (!ok) return;
  await api.banUser(uid, name, state.user.uid, state.mainServerId);
  toast(`Banned ${name}.`, "ok");
});

let refreshAccess = null;
function accessData() {
  return { code: state.accessCode, waiting: state.waiting, bans: state.bans };
}
function syncAccessModal() {
  if (refreshAccess && !refreshAccess(accessData())) refreshAccess = null;
}

function manageAccess() {
  refreshAccess = accessModal(accessData(), {
    newCode: guarded(async () => {
      const ok = await confirmModal({
        title: "Make a new code?",
        message: "The current code will stop working. Nobody already on Sipher is affected.",
        confirm: "New Code",
      });
      if (!ok) return;
      const code = api.newAccessCode();
      await api.setAccessCode(code);
      state.accessCode = code;
      syncAccessModal();
    }),
    approve: guarded(async (p) => {
      await api.approvePass(p.uid);
      toast(`Let ${p.name} in.`, "ok");
    }),
    reject: guarded(async (p) => {
      await api.rejectPass(p.uid);
      toast(`Turned ${p.name} away.`, "ok");
    }),
    ban: (p) => banPerson(p.uid, p.name),
    unban: guarded(async (b) => {
      await api.unbanUser(b.uid);
      toast(`Unbanned ${b.name}. They'll need the access code to come back.`, "ok");
    }),
  });
}

// The admin's live lists, and an access code if there isn't one yet.
async function startAdmin() {
  state.accessCode = await api.getAccessCode();
  if (!state.accessCode) {
    state.accessCode = api.newAccessCode();
    await api.setAccessCode(state.accessCode);
  }
  let known = null;
  subs.waiting = api.watchWaiting(
    (waiting) => {
      // A sound / pop-up when someone new asks to join (not for the ones
      // already waiting when the app opened).
      if (known)
        for (const p of waiting)
          if (!known.has(p.uid)) notify(`${p.name} wants to join Sipher`, p.note || "", manageAccess);
      known = new Set(waiting.map((p) => p.uid));
      state.waiting = waiting;
      syncAccessModal();
      renderSide();
    },
    (err) => console.warn("Couldn't load the waiting list", err),
  );
  subs.bans = api.watchBans(
    (bans) => {
      state.bans = bans;
      syncAccessModal();
    },
    (err) => console.warn("Couldn't load the ban list", err),
  );
}

// Waits until this account is let into Sipher, showing the access-code,
// waiting or banned screen meanwhile. Resolves to the pass, or null if
// someone else signs in first. Losing the pass later (banned) reloads.
function passGate(user) {
  return new Promise((resolve) => {
    let inside = false;
    let triedExisting = false;
    const show = (view) =>
      renderGate(appEl, view, state.profile.displayName, {
        submit: async (code, note) => {
          try {
            await api.requestPass(user.uid, state.profile.displayName, code, note);
            return null;
          } catch (err) {
            return err?.code === "permission-denied"
              ? "That code isn't right. Check with whoever gave it to you."
              : err?.message || "Something went wrong. Try again.";
          }
        },
        signOut: () => signOut(auth),
      });
    subs.pass = api.watchPass(
      user.uid,
      async (pass) => {
        if (auth.currentUser?.uid !== user.uid) return resolve(null);
        if (pass?.approved) {
          if (!inside) {
            inside = true;
            resolve(pass);
          }
          return;
        }
        if (inside) return location.reload();
        if (!pass && !triedExisting) {
          triedExisting = true;
          // People already in the main server keep their access. If this
          // works, the listener fires again with the new pass.
          try {
            await api.claimExistingPass(user.uid, state.profile.displayName);
            return;
          } catch {
            // Not one of them (or banned).
          }
        }
        if (pass) return show("waiting");
        show((await api.isBanned(user.uid).catch(() => false)) ? "banned" : "code");
      },
      // Reading your own pass is always allowed by the current rules, so a
      // refusal means the database still has the old rules.
      (err) => {
        console.error(err);
        show(err?.code === "permission-denied" ? "setup" : "code");
      },
    );
  });
}

function showReports() {
  const serverId = state.serverId;
  reportsModal(state.reports, {
    jump: (r) => {
      if (state.serverId !== serverId) return;
      if (state.channelId !== r.channelId) openChannel(r.channelId);
      // The message list may still be loading; try for a few seconds.
      let tries = 0;
      const attempt = () => {
        if (ui.chat.jumpTo(r.messageId)) return;
        if (++tries < 10) return setTimeout(attempt, 400);
        toast("Couldn't find that message. It may have been deleted, or it's further back.");
      };
      attempt();
    },
    remove: async (r) => {
      const ok = await confirmModal({
        title: "Delete Message",
        message: `Delete this message from ${r.authorName}? The report will be cleared too.`,
        confirm: "Delete",
        danger: true,
      });
      if (!ok) return false;
      try {
        await api.deleteMessage(api.channelConvo(serverId, r.channelId), r.messageId);
        await api.dismissReport(r.id);
        toast("Message deleted.", "ok");
        return true;
      } catch (err) {
        report(err);
        return false;
      }
    },
    dismiss: async (r) => {
      try {
        await api.dismissReport(r.id);
        return true;
      } catch (err) {
        report(err);
        return false;
      }
    },
  });
}

const kickMember = guarded(async (member) => {
  const ok = await confirmModal({
    title: `Kick ${member.displayName}`,
    message: `Remove ${member.displayName} from ${state.server.name}? They can rejoin with a new invite.`,
    confirm: "Kick",
    danger: true,
  });
  if (ok) await api.kickMember(state.serverId, member.uid);
});

// ---- forwarding & pins ----

// Lets you pick any channel in your servers, or any person, and sends a copy
// of the message there with a "Forwarded from" label.
function forwardMessage(msg) {
  const me = state.user.uid;
  const here = currentChannel();
  const forwarded = msg.forwarded || {
    authorName: memberMap().get(msg.authorId)?.displayName || msg.authorName,
    from: state.home ? "a direct message" : `#${here?.name || "a channel"}`,
  };
  const preview = msg.text.length > 140 ? msg.text.slice(0, 140) + "…" : msg.text;
  const sent = new Set();

  openModal({
    title: "Forward Message",
    subtitle: preview,
    render: () => {
      const search = h("input", {
        class: "input",
        placeholder: "Search people and channels",
        oninput: () => draw(),
      });
      const note = h("input", {
        class: "input",
        placeholder: "Add a message (optional)",
        maxLength: api.MESSAGE_LIMIT,
      });
      const listEl = h("div", { class: "forward-list" });
      const targets = [];

      // Leaves out channels you can't post in.
      const addChannels = (server, channels) => {
        const owner = state.serverInfo.get(server.id)?.ownerId === me;
        for (const c of channels)
          if (owner || (!c.private && !c.readOnly)) targets.push({
            key: `ch:${server.id}/${c.id}`,
            label: `#${c.name}`,
            sub: server.name,
            convo: async () => api.channelConvo(server.id, c.id),
          });
      };
      const serverName = (s) => state.serverInfo.get(s.id)?.name || s.name;

      if (!state.home && state.server)
        addChannels(
          { id: state.serverId, name: state.server.name },
          state.channels,
        );
      for (const dm of dmListView())
        targets.push({
          key: `dm:${dm.id}`,
          label: dm.other.displayName,
          sub: "Direct Message",
          person: dm.other,
          convo: async () => api.dmConvo(dm.id),
        });
      if (!state.home)
        for (const m of state.members) {
          const dmId = api.dmIdFor(me, m.uid);
          if (m.uid === me || state.dms.some((d) => d.id === dmId)) continue;
          targets.push({
            key: `dm:${dmId}`,
            label: m.displayName,
            sub: `Member of ${state.server.name}`,
            person: m,
            convo: async () => api.dmConvo(await api.openDm(me, m.uid)),
          });
        }
      for (const s of state.servers) {
        if (!state.home && s.id === state.serverId) continue;
        const server = { id: s.id, name: serverName(s) };
        const cached = channelCache.get(s.id);
        if (cached) {
          addChannels(server, cached);
          continue;
        }
        api
          .fetchChannels(s.id)
          .then((channels) => {
            channelCache.set(s.id, channels);
            addChannels(server, channels);
            draw();
          })
          .catch(() => {});
      }

      async function sendTo(t, btn) {
        btn.disabled = true;
        btn.textContent = "Sending…";
        try {
          const path = await t.convo();
          await api.sendMessage(path, state.user, state.profile, msg.text, {
            forwarded,
          });
          const extra = note.value.trim();
          if (extra)
            await api.sendMessage(path, state.user, state.profile, extra);
          sent.add(t.key);
          btn.textContent = "Sent";
        } catch (err) {
          report(err, "Couldn't forward the message.");
          btn.disabled = false;
          btn.textContent = "Send";
        }
      }

      function row(t) {
        const done = sent.has(t.key);
        const btn = h(
          "button",
          {
            class: "btn primary forward-send",
            disabled: done,
            onclick: () => sendTo(t, btn),
          },
          done ? "Sent" : "Send",
        );
        return h(
          "div",
          { class: "forward-row" },
          t.person
            ? avatar(t.person, 32)
            : h("div", { class: "forward-icon" }, icon("hash", 18)),
          h(
            "div",
            { class: "forward-names" },
            h("div", { class: "truncate strong" }, t.label),
            h("div", { class: "truncate muted small" }, t.sub),
          ),
          btn,
        );
      }

      function draw() {
        const q = search.value.trim().toLowerCase();
        const shown = targets
          .filter(
            (t) =>
              !q ||
              t.label.toLowerCase().includes(q) ||
              t.sub.toLowerCase().includes(q),
          )
          .slice(0, 80);
        append(clear(listEl), [
          shown.map(row),
          shown.length === 0 && h("p", { class: "muted pad" }, "No matches."),
        ]);
      }

      draw();
      return h("div", { class: "modal-form" }, search, listEl, note);
    },
  });
}

const showPins = guarded(async () => {
  const here = currentChannel();
  if (!here) return;
  const path = convo();
  const pins = await api.fetchPins(path);
  const allowed = canPin();
  const names = memberMap();

  openModal({
    title: "Pinned Messages",
    subtitle: state.home ? `with ${here.name}` : `in #${here.name}`,
    render: (close) => {
      const item = (p) => {
        const el = h(
          "div",
          { class: "pin-item" },
          h(
            "div",
            { class: "pin-meta" },
            h(
              "span",
              { class: "strong" },
              names.get(p.authorId)?.displayName || p.authorName,
            ),
            h(
              "span",
              { class: "muted small" },
              p.createdAt?.toDate?.().toLocaleString() ?? "",
            ),
          ),
          h(
            "div",
            { class: "pin-text" },
            p.text.length > 300 ? p.text.slice(0, 300) + "…" : p.text,
          ),
          h(
            "div",
            { class: "pin-actions" },
            h(
              "button",
              {
                class: "link-btn",
                onclick: () => {
                  close();
                  if (!ui.chat.jumpTo(p.id))
                    toast(
                      "That message is further back. Use “Load older messages” to find it.",
                    );
                },
              },
              "Jump",
            ),
            allowed &&
              h(
                "button",
                {
                  class: "link-btn danger-text",
                  onclick: guarded(async () => {
                    await api.setPinned(path, p.id, false);
                    el.remove();
                  }),
                },
                "Unpin",
              ),
          ),
        );
        return el;
      };
      return h(
        "div",
        { class: "pins-list" },
        pins.length === 0 &&
          h(
            "p",
            { class: "muted" },
            allowed
              ? "Nothing is pinned yet. Hover over a message and click the pin to keep it here."
              : "Nothing is pinned yet.",
          ),
        pins.map(item),
      );
    },
  });
});

function inviteLink(code) {
  return `${location.origin}${location.pathname}?invite=${code}`;
}

function showInvite() {
  openModal({
    title: `Invite friends to ${state.server.name}`,
    subtitle:
      "Share this link or code. Anyone signed in to Sipher can use it to join.",
    render: () => {
      const link = h("input", {
        class: "input",
        readOnly: true,
        value: inviteLink(state.server.inviteCode),
      });
      const copy = h(
        "button",
        {
          class: "btn primary",
          onclick: async () => {
            link.select();
            try {
              await navigator.clipboard.writeText(link.value);
              copy.textContent = "Copied";
              setTimeout(() => (copy.textContent = "Copy"), 1500);
            } catch {
              toast("Press Ctrl+C to copy the selected link.");
            }
          },
        },
        "Copy",
      );
      return h(
        "div",
        { class: "modal-form" },
        h("div", { class: "copy-row" }, link, copy),
        h(
          "p",
          { class: "muted small" },
          "Invite code: ",
          h("code", { class: "inline-code" }, state.server.inviteCode),
        ),
        isOwner() &&
          h(
            "button",
            {
              class: "link-btn",
              onclick: guarded(async () => {
                const code = await api.regenerateInvite(state.serverId);
                link.value = inviteLink(code);
                toast("New invite created. The old one no longer works.", "ok");
              }),
            },
            "Reset invite link",
          ),
      );
    },
  });
}

function addServer() {
  openModal({
    title: "Add a server",
    subtitle: "Your server is where you and your friends hang out.",
    render: (close) => {
      const name = h("input", {
        class: "input",
        maxLength: 50,
        value: `${state.profile.displayName}'s server`,
        required: true,
      });
      const code = h("input", {
        class: "input",
        placeholder: "hTKzmak or a full invite link",
        required: true,
      });
      const create = h(
        "form",
        {
          class: "modal-form",
          onsubmit: guarded(async (e) => {
            e.preventDefault();
            const value = name.value.trim();
            if (!value) return;
            close();
            const id = await api.createServer(state.user, state.profile, value);
            setHash(id);
            openServer(id, null);
          }),
        },
        h("h3", { class: "modal-section" }, "Create My Own"),
        h(
          "label",
          { class: "field" },
          h("span", { class: "field-label" }, "Server name"),
          name,
        ),
        h(
          "div",
          { class: "modal-actions" },
          h("button", { type: "submit", class: "btn primary" }, "Create"),
        ),
      );
      const join = h(
        "form",
        {
          class: "modal-form",
          onsubmit: (e) => {
            e.preventDefault();
            const parsed = api.parseInvite(code.value);
            if (!parsed)
              return toast("That doesn't look like an invite.", "error");
            close();
            joinWithCode(parsed);
          },
        },
        h("h3", { class: "modal-section" }, "Have an invite already?"),
        h(
          "label",
          { class: "field" },
          h("span", { class: "field-label" }, "Invite link or code"),
          code,
        ),
        h(
          "div",
          { class: "modal-actions" },
          h(
            "button",
            { type: "submit", class: "btn secondary" },
            "Join Server",
          ),
        ),
      );
      return h(
        "div",
        null,
        create,
        h("div", { class: "divider" }, h("span", null, "or")),
        join,
      );
    },
  });
}

const joinWithCode = guarded(async (code) => {
  const id = await api.joinServer(state.user, state.profile, code);
  setHash(id);
  openServer(id, null);
  toast("Joined the server!", "ok");
});

function consumeInviteFromUrl() {
  const params = new URLSearchParams(location.search);
  const code = params.get("invite");
  if (!code) return;
  params.delete("invite");
  const search = params.toString();
  history.replaceState(
    null,
    "",
    location.pathname + (search ? "?" + search : "") + location.hash,
  );
  joinWithCode(code);
}

// ---- session lifecycle ----

// Links from verification / password-reset emails are handled by the app
// itself (see ui/action.js) instead of Firebase's hosted page.
const emailAction = emailActionFromUrl();
if (emailAction) renderEmailAction(appEl, emailAction);

onAuthStateChanged(auth, async (user) => {
  if (emailAction) return;
  teardown();
  ui = null;
  Object.assign(state, {
    user,
    servers: [],
    home: false,
    dms: [],
    dmId: null,
    serverId: null,
    server: null,
    channels: [],
    channelsLoaded: false,
    channelId: null,
    members: [],
    requests: { incoming: [], outgoing: [] },
    friends: [],
    blocks: [],
    reports: [],
    mainServerId: null,
    appAdmin: false,
    accessCode: null,
    waiting: [],
    bans: [],
  });

  if (!user) {
    state.profile = null;
    renderAuth(appEl);
    return;
  }

  const signupName = pendingSignup.displayName;
  pendingSignup.displayName = null;
  state.profile = {
    displayName:
      signupName || user.displayName || user.email?.split("@")[0] || "User",
    photoURL: null,
  };
  let created = false;
  try {
    created = await api.saveProfile(user, signupName);
  } catch (err) {
    report(err, "Couldn't save your profile.");
  }
  if (created) state.profile.joinedMain = false;
  else
    state.profile = {
      ...state.profile,
      ...(await api.getUser(user.uid).catch(() => null)),
    };
  if (auth.currentUser?.uid !== user.uid) return;

  // Only people who've been let in get past here.
  const pass = await passGate(user);
  if (!pass || auth.currentUser?.uid !== user.uid) return;

  // People let in with the access code start out in the main Sipher server
  // (once: they're free to leave it later).
  if (pass.via === "code" && !state.profile.joinedMain && DEFAULT_INVITE) {
    await api
      .joinServer(user, state.profile, DEFAULT_INVITE)
      .then(() => api.markJoinedMain(user.uid))
      .catch((err) => console.warn("Couldn't auto-join the main server", err));
  }
  if (auth.currentUser?.uid !== user.uid) return;

  state.mainServerId = await api.serverForInvite(DEFAULT_INVITE).catch(() => null);
  state.appAdmin =
    Boolean(state.mainServerId) &&
    (await api.getServerOwner(state.mainServerId).catch(() => null)) === user.uid;
  if (state.appAdmin)
    startAdmin().catch((err) => console.warn("Couldn't load who can join", err));
  if (auth.currentUser?.uid !== user.uid) return;

  buildLayout();
  renderAll();

  let askedUsername = false;
  subs.profile = api.watchUser(user.uid, (profile) => {
    if (!profile) return;
    state.profile = { ...state.profile, ...profile };
    renderSide();
    // Everyone needs a username so friends can find them.
    if (!profile.username && !askedUsername) {
      askedUsername = true;
      chooseUsername();
    }
  });

  subs.requests = api.watchRequests(
    user.uid,
    (requests) => {
      state.requests = requests;
      renderRail();
      if (state.home) renderSide();
    },
    (err) => console.warn("Couldn't load friend requests", err),
  );
  subs.friends = api.watchFriends(
    user.uid,
    (friends) => {
      state.friends = friends;
      friends.forEach(watchPerson);
      if (state.home) renderSide();
    },
    (err) => console.warn("Couldn't load friends", err),
  );

  subs.blocks = api.watchBlocks(
    user.uid,
    (blocks) => {
      state.blocks = blocks;
      renderAll();
    },
    (err) => console.warn("Couldn't load blocked users", err),
  );

  subs.pings = live.watchPings(user.uid, (pings) => {
    state.pings = pings;
    // A sound / pop-up for mentions that are new since last time.
    if (seenPings)
      for (const [key, p] of Object.entries(pings)) {
        if (!p || (seenPings[key]?.at || 0) >= p.at || isBlocked(p.by)) continue;
        const [sid, cid] = key.split("_");
        if (viewing(sid, cid)) continue;
        notify(`${p.name} mentioned you`, p.channel ? `in #${p.channel}` : "", () =>
          openServer(sid, cid),
        );
      }
    seenPings = pings;
    if (!ui) return;
    markChannelRead();
    renderRail();
    if (!state.home) renderSide();
  });

  subs.dms = api.watchMyDms(
    user.uid,
    (dms) => {
      // A sound / pop-up for DMs that arrived since last time.
      if (seenDms)
        for (const dm of dms) {
          const at = dm.lastMessageAt?.toMillis?.() ?? 0;
          const other = api.otherMember(dm.id, user.uid);
          if (
            !dm.lastMessageBy ||
            dm.lastMessageBy === user.uid ||
            at <= (seenDms.get(dm.id) ?? 0) ||
            isBlocked(other) ||
            (state.home && state.dmId === dm.id && document.visibilityState === "visible")
          )
            continue;
          const name = state.people.get(other)?.displayName || "someone";
          notify(`New message from ${name}`, "Open Sipher to read it.", () => openHome(dm.id));
        }
      seenDms = new Map(
        dms.map((d) => [d.id, d.lastMessageAt?.toMillis?.() ?? 0]),
      );
      state.dms = dms;
      for (const dm of dms) watchPerson(api.otherMember(dm.id, user.uid));
      if (state.home && state.dmId) markRead(state.dmId);
      renderRail();
      if (state.home) renderSide();
    },
    (err) => console.warn("Couldn't load direct messages", err),
  );

  let first = true;
  subs.servers = api.watchMyServers(user.uid, (servers) => {
    // Re-route on first load, or when the open server left the list (left,
    // kicked, deleted). A just-created server may not be listed yet; stay put.
    const had = state.servers.some((s) => s.id === state.serverId);
    const has = servers.some((s) => s.id === state.serverId);
    state.servers = servers;
    syncServerInfo(servers);
    syncActivity(servers);
    if (first || (!state.home && (!state.serverId || (had && !has)))) route();
    else renderAll();
    if (first) consumeInviteFromUrl();
    first = false;
  });

  api
    .restoreMyServers(user.uid)
    .then((n) => n && toast(`Restored ${n} server${n === 1 ? "" : "s"} to your list.`))
    .catch((err) => console.warn("Couldn't check for missing servers", err));

  api
    .touchPresence(user.uid)
    .catch(() => {})
    .finally(() => pollPresence(true));
  timers.push(
    setInterval(
      () => api.touchPresence(user.uid).catch(() => {}),
      HEARTBEAT_MS,
    ),
    setInterval(() => pollPresence(), PRESENCE_POLL_MS),
    // Re-evaluate who counts as online as heartbeats age.
    setInterval(() => ui && renderMemberList(), 30 * 1000),
  );
});

document.addEventListener("visibilitychange", () => {
  if (!state.user || !ui) return;
  if (document.visibilityState === "visible") {
    pollPresence();
    markChannelRead();
    renderRail();
  } else {
    setTyping(false);
  }
});

// Picks up a verification done in another tab.
window.addEventListener("focus", () => {
  const user = auth.currentUser;
  if (!user || !ui || ui.banner.hidden) return;
  // Firebase may already have synced the change from the other tab.
  if (user.emailVerified) return renderBanner();
  user
    .reload()
    .then(renderBanner)
    .catch(() => {});
});

window.addEventListener("hashchange", () => {
  if (state.user && ui) route();
});
