import { append, avatar, clear, h, icon } from "../dom.js";

// Heartbeats come every 5 minutes (see main.js), so allow two to be missed.
const ONLINE_WINDOW_MS = 11 * 60 * 1000;

export function isOnline(presence) {
  const seen = presence?.lastSeen?.toMillis?.();
  return seen != null && Date.now() - seen < ONLINE_WINDOW_MS;
}

function memberRow(m, presence, { canKick, canMessage, onKick, onMessage, onOpen }) {
  const online = isOnline(presence);
  return h(
    "div",
    {
      class: `member${online ? "" : " offline"} clickable`,
      title: `View ${m.displayName}'s profile`,
      onclick: () => onOpen(m),
    },
    h(
      "div",
      { class: "member-avatar" },
      avatar(m, 32),
      h("span", { class: `status-dot${online ? " on" : ""}` }),
    ),
    h(
      "div",
      { class: `member-name truncate${m.role === "mod" ? " role-mod" : m.role === "owner" ? " role-owner" : ""}` },
      m.displayName,
      m.role === "owner" &&
        h("span", { class: "owner-badge", title: "Server Owner" }, "👑"),
      m.role === "mod" &&
        h("span", { class: "owner-badge", title: "Moderator" }, "🛡️"),
    ),
    h(
      "div",
      { class: "member-actions" },
      canMessage &&
        h(
          "button",
          {
            class: "icon-btn small",
            title: "Message",
            "aria-label": `Message ${m.displayName}`,
            onclick: (e) => {
              e.stopPropagation();
              onMessage(m);
            },
          },
          icon("chat", 14),
        ),
      canKick &&
        h(
          "button",
          {
            class: "icon-btn small danger",
            title: "Kick",
            "aria-label": `Kick ${m.displayName}`,
            onclick: (e) => {
              e.stopPropagation();
              onKick(m);
            },
          },
          icon("x", 14),
        ),
    ),
  );
}

// Right-hand member list, split into online and offline. Clicking someone
// opens their profile card.
export function renderMembers(
  el,
  { members, presence, ownerId, uid, isMod },
  { onKick, onMessage, onOpen },
) {
  const sorted = [...members].sort((a, b) =>
    (a.displayName || "").localeCompare(b.displayName || ""),
  );
  const online = sorted.filter((m) => isOnline(presence.get(m.uid)));
  const offline = sorted.filter((m) => !isOnline(presence.get(m.uid)));
  // The owner can kick anyone; moderators can kick regular members.
  const opts = (m) => ({
    canKick:
      Boolean(ownerId) &&
      m.uid !== uid &&
      m.uid !== ownerId &&
      (ownerId === uid || (isMod && m.role !== "mod")),
    canMessage: m.uid !== uid,
    onKick,
    onMessage,
    onOpen,
  });

  append(clear(el), [
    online.length > 0 &&
      h("div", { class: "member-group" }, `Online — ${online.length}`),
    online.map((m) => memberRow(m, presence.get(m.uid), opts(m))),
    offline.length > 0 &&
      h("div", { class: "member-group" }, `Offline — ${offline.length}`),
    offline.map((m) => memberRow(m, presence.get(m.uid), opts(m))),
  ]);
}
