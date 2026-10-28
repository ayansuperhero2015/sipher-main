import { append, avatar, clear, h, icon } from "../dom.js";
import { friendsSection } from "./friends.js";

// Stands for the built-in "Text Channels" group (channels with no section)
// in the server's list of sections, so it can be moved like the others.
export const DEFAULT_SECTION = "~default";

// The channel list split into sections, in the server's order. The
// "Text Channels" group (id null) goes first unless it has been moved.
export function sectionsOf(server, channels) {
  const categories = server?.categories || [];
  const known = new Set(categories.map((c) => c.id));
  const loose = {
    id: null,
    name: "Text Channels",
    channels: channels.filter((c) => !known.has(c.categoryId)),
  };
  const list = categories.map((cat) =>
    cat.id === DEFAULT_SECTION
      ? loose
      : { ...cat, channels: channels.filter((c) => c.categoryId === cat.id) },
  );
  if (!known.has(DEFAULT_SECTION)) list.unshift(loose);
  return list;
}

// Sections each person has folded away, remembered on this device.
const collapsed = new Set(
  (() => {
    try {
      return JSON.parse(localStorage.getItem("sipher:collapsed") || "[]");
    } catch {
      return [];
    }
  })(),
);

function toggleCollapsed(key) {
  if (!collapsed.delete(key)) collapsed.add(key);
  try {
    localStorage.setItem("sipher:collapsed", JSON.stringify([...collapsed]));
  } catch {
    // Just a convenience.
  }
}

// The channel or section being dragged by the owner.
let dragId = null;
let dragSectionId = null;

function clearDropMarks(root) {
  root
    .querySelectorAll(".drop-before, .drop-after, .drop-into")
    .forEach((el) => el.classList.remove("drop-before", "drop-after", "drop-into"));
}

function channelSection(section, state, actions, isOwner, rerender) {
  const key = `${state.serverId}:${section.id ?? "none"}`;
  const folded = collapsed.has(key);
  const others = () => section.channels.filter((c) => c.id !== dragId);
  // Sections themselves (including "Text Channels") can be dragged by
  // their header.
  const movable = isOwner;
  const sectionKey = section.id ?? DEFAULT_SECTION;

  const headerEl = h(
    "div",
    {
      class: `channel-group${folded ? " folded" : ""}`,
      draggable: movable ? "true" : null,
      ondragstart: movable
        ? (e) => {
            // A channel row inside started this drag; leave it alone.
            if (dragId) return;
            dragSectionId = sectionKey;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", sectionKey);
            headerEl.classList.add("dragging");
          }
        : null,
      ondragend: movable
        ? () => {
            dragSectionId = null;
            headerEl.classList.remove("dragging");
            clearDropMarks(document);
          }
        : null,
      ondragover: (e) => {
        if (dragId) {
          e.preventDefault();
          headerEl.classList.add("drop-into");
        } else if (dragSectionId && dragSectionId !== sectionKey && isOwner) {
          e.preventDefault();
          const box = headerEl.getBoundingClientRect();
          const after = e.clientY > box.top + box.height / 2;
          headerEl.classList.toggle("drop-after", after);
          headerEl.classList.toggle("drop-before", !after);
        }
      },
      ondragleave: () =>
        headerEl.classList.remove("drop-into", "drop-before", "drop-after"),
      ondrop: (e) => {
        e.preventDefault();
        const after = headerEl.classList.contains("drop-after");
        clearDropMarks(document);
        if (dragId) actions.moveChannel(dragId, section.id, others().length);
        else if (dragSectionId && dragSectionId !== sectionKey)
          actions.moveSection(dragSectionId, sectionKey, after);
      },
    },
    h(
      "button",
      {
        class: "channel-group-toggle",
        title: folded ? "Show channels" : "Hide channels",
        onclick: () => {
          toggleCollapsed(key);
          rerender();
        },
      },
      icon("chevron", 12),
      h("span", { class: "truncate" }, section.name),
    ),
    isOwner &&
      section.id &&
      h(
        "button",
        {
          class: "icon-btn small",
          title: "Edit Section",
          onclick: () => actions.editSection(section),
        },
        icon("gear", 14),
      ),
    isOwner &&
      h(
        "button",
        {
          class: "icon-btn small",
          title: "Create Channel",
          onclick: () => actions.createChannel(section.id),
        },
        icon("plus", 16),
      ),
  );

  const rows = section.channels
    .filter((c) => !folded || c.id === state.channelId)
    .map((c) => {
      const mark = state.channelMarks?.get(c.id);
      const row = h(
        "div",
        {
          class: `channel${c.id === state.channelId ? " active" : ""}${mark?.unread ? " unread" : ""}`,
          draggable: isOwner ? "true" : null,
          ondragstart: isOwner
            ? (e) => {
                dragId = c.id;
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", c.id);
                row.classList.add("dragging");
              }
            : null,
          ondragend: isOwner
            ? () => {
                dragId = null;
                row.classList.remove("dragging");
                clearDropMarks(document);
              }
            : null,
          ondragover: isOwner
            ? (e) => {
                if (!dragId || dragId === c.id) return;
                e.preventDefault();
                const box = row.getBoundingClientRect();
                const after = e.clientY > box.top + box.height / 2;
                row.classList.toggle("drop-after", after);
                row.classList.toggle("drop-before", !after);
              }
            : null,
          ondragleave: () => row.classList.remove("drop-before", "drop-after"),
          ondrop: isOwner
            ? (e) => {
                e.preventDefault();
                const after = row.classList.contains("drop-after");
                clearDropMarks(document);
                if (!dragId || dragId === c.id) return;
                const index = others().findIndex((o) => o.id === c.id);
                actions.moveChannel(dragId, section.id, index + (after ? 1 : 0));
              }
            : null,
        },
        h(
          "button",
          {
            class: "channel-link",
            title: c.private ? "Private: only the owner and moderators can see this" : null,
            onclick: () => actions.openChannel(c.id),
          },
          icon(c.private ? "lock" : "hash", 18),
          h("span", { class: "truncate" }, c.name),
          mark?.mention && h("span", { class: "mention-badge", title: "You were mentioned" }, "@"),
        ),
        isOwner &&
          h(
            "button",
            {
              class: "icon-btn small channel-edit",
              title: "Edit Channel",
              onclick: () => actions.editChannel(c),
            },
            icon("gear", 14),
          ),
      );
      return row;
    });

  return [headerEl, rows];
}

// Friends and requests, then Direct Messages: one row per conversation,
// most recent first.
function dmList({ dmList, dmId, requests, friendList }, actions) {
  return h(
    "div",
    { class: "channel-list" },
    friendsSection({ requests, friends: friendList }, actions),
    h("div", { class: "channel-group" }, h("span", null, "Direct Messages")),
    dmList.map((dm) =>
      h(
        "button",
        {
          class: `dm-row${dm.id === dmId ? " active" : ""}${dm.unread ? " unread" : ""}`,
          onclick: () => actions.openDm(dm.id),
        },
        h(
          "div",
          { class: "member-avatar" },
          avatar(dm.other, 32),
          h("span", { class: `status-dot${dm.online ? " on" : ""}` }),
        ),
        h("span", { class: "dm-name truncate" }, dm.other.displayName),
        dm.unread && h("span", { class: "unread-dot", title: "Unread" }),
      ),
    ),
    dmList.length === 0 &&
      h(
        "p",
        { class: "muted pad" },
        "No conversations yet. Click someone in a server's member list to message them.",
      ),
  );
}

// Server header, channel list and the user panel at the bottom.
export function renderSidebar(el, state, actions) {
  const { server, channels, channelId, profile, user } = state;
  const isOwner = server && server.ownerId === user.uid;

  let header;
  let body;
  let menu = null;
  if (state.home) {
    header = h("div", { class: "sidebar-header static" }, "Direct Messages");
    body = dmList(state, actions);
  } else if (server) {
    menu = h(
      "div",
      { class: "menu", hidden: true },
      h(
        "button",
        { class: "menu-item accent", onclick: actions.invite },
        "Invite People",
        icon("link", 16),
      ),
      isOwner &&
        h(
          "button",
          { class: "menu-item", onclick: () => actions.createChannel(null) },
          "Create Channel",
          icon("plus", 16),
        ),
      isOwner &&
        h(
          "button",
          { class: "menu-item", onclick: actions.createSection },
          "Create Section",
          icon("menu", 16),
        ),
      isOwner &&
        h(
          "button",
          { class: "menu-item", onclick: actions.serverSettings },
          "Server Settings",
          icon("gear", 16),
        ),
      state.appAdmin &&
        server.id === state.mainServerId &&
        h(
          "button",
          { class: "menu-item", onclick: actions.manageAccess },
          state.waiting.length ? `Who Can Join (${state.waiting.length})` : "Who Can Join",
          icon("shield", 16),
        ),
      state.isMod &&
        h(
          "button",
          { class: "menu-item", onclick: actions.showReports },
          state.reports.length ? `Reports (${state.reports.length})` : "Reports",
          icon("flag", 16),
        ),
      (server.rules || server.welcome) &&
        h(
          "button",
          { class: "menu-item", onclick: actions.showRules },
          "Server Rules",
          icon("book", 16),
        ),
      h("div", { class: "menu-sep" }),
      isOwner
        ? h(
            "button",
            { class: "menu-item danger", onclick: actions.deleteServer },
            "Delete Server",
            icon("trash", 16),
          )
        : h(
            "button",
            { class: "menu-item danger", onclick: actions.leaveServer },
            "Leave Server",
            icon("logout", 16),
          ),
    );
    header = h(
      "button",
      {
        class: "sidebar-header",
        onclick: (e) => {
          e.stopPropagation();
          menu.hidden = !menu.hidden;
          if (!menu.hidden) {
            const hide = () => {
              menu.hidden = true;
              document.removeEventListener("click", hide);
            };
            document.addEventListener("click", hide);
          }
        },
      },
      h("span", { class: "truncate" }, server.name),
      state.isMod &&
        state.reports.length > 0 &&
        h("span", { class: "rail-badge inline", title: "Reports to review" }, state.reports.length),
      state.appAdmin &&
        server.id === state.mainServerId &&
        state.waiting.length > 0 &&
        h("span", { class: "rail-badge inline", title: "People waiting to join" }, state.waiting.length),
      icon("chevron", 18),
    );
    const rerender = () => renderSidebar(el, state, actions);
    body = h(
      "div",
      { class: "channel-list" },
      sectionsOf(server, channels).map((section) =>
        channelSection(section, state, actions, isOwner, rerender),
      ),
      channels.length === 0 &&
        h("p", { class: "muted pad" }, "No channels yet."),
      isOwner &&
        channels.length > 1 &&
        h(
          "p",
          { class: "muted small pad sidebar-tip" },
          (server.categories || []).length
            ? "Tip: drag channels to reorder them or move them between sections. Drag a section's name to move the whole section."
            : "Tip: drag channels to reorder them or move them into a section.",
        ),
    );
  } else {
    header = h("div", { class: "sidebar-header static" }, "Sipher");
    body = h(
      "div",
      { class: "channel-list" },
      h(
        "p",
        { class: "muted pad" },
        "Pick a server on the left, or create one with the + button.",
      ),
    );
  }

  const panel = h(
    "div",
    { class: "user-panel" },
    avatar({ ...profile, uid: user.uid }, 32),
    h(
      "div",
      { class: "user-panel-name" },
      h("div", { class: "truncate strong" }, profile.displayName),
      h(
        "button",
        {
          class: "truncate muted small username-btn",
          title: "Change username",
          onclick: actions.changeUsername,
        },
        profile.username ? `@${profile.username}` : "Pick a username",
      ),
    ),
    h(
      "button",
      {
        class: "icon-btn",
        title: "Appearance & Notifications",
        onclick: actions.appearance,
      },
      icon("palette", 18),
    ),
    h(
      "button",
      {
        class: "icon-btn",
        title: "User Settings",
        onclick: actions.editProfile,
      },
      icon("gear", 18),
    ),
    h(
      "button",
      { class: "icon-btn", title: "Log Out", onclick: actions.signOut },
      icon("logout", 18),
    ),
  );

  append(clear(el), [header, menu, body, panel]);
}
