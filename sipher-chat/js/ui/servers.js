import { append, clear, colorFor, h, icon, initials, logo } from "../dom.js";

// The vertical strip on the far left: Direct Messages, then servers.
export function renderServerRail(
  el,
  { servers, serverId, home, unreadDms },
  actions,
) {
  append(clear(el), [
    h(
      "div",
      { class: `rail-item rail-home${home ? " active" : ""}` },
      h("span", { class: "rail-pill" }),
      h(
        "button",
        {
          class: "rail-icon home",
          title: "Direct Messages",
          "aria-label": unreadDms
            ? `Direct Messages, ${unreadDms} unread`
            : "Direct Messages",
          onclick: actions.openHome,
        },
        logo(26),
      ),
      unreadDms > 0 &&
        h("span", { class: "rail-badge" }, unreadDms > 9 ? "9+" : unreadDms),
    ),
    h("div", { class: "rail-sep" }),
    servers.map((s) =>
      h(
        "div",
        {
          class: `rail-item${s.id === serverId ? " active" : ""}${s.unread ? " unread" : ""}`,
        },
        h("span", { class: "rail-pill" }),
        h(
          "button",
          {
            class: "rail-icon",
            title: s.name,
            "aria-label": s.name,
            style:
              s.id === serverId && !s.icon
                ? { background: colorFor(s.id) }
                : null,
            onclick: () => actions.openServer(s.id),
          },
          s.icon
            ? h("img", { src: s.icon, alt: "", class: "rail-img" })
            : initials(s.name),
        ),
        s.mentions > 0 &&
          h(
            "span",
            { class: "rail-badge", title: "Mentions" },
            s.mentions > 9 ? "9+" : s.mentions,
          ),
      ),
    ),
    h(
      "div",
      { class: "rail-item" },
      h(
        "button",
        {
          class: "rail-icon add",
          title: "Add a server",
          "aria-label": "Add a server",
          onclick: actions.addServer,
        },
        icon("plus", 22),
      ),
    ),
  ]);
}
