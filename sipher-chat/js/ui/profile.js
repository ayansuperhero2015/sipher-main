import { avatar, h, icon } from "../dom.js";
import { openModal } from "./modal.js";

const ROLE_NAMES = { owner: "Server Owner", mod: "Moderator" };

// The pop-up you get when clicking someone's name or picture.
// `info`: { person (with about, username), role, online, self, friend,
// requested, blocked, canSetRole, canKick, canBan }.
export function profileCard(info, actions) {
  const { person } = info;
  openModal({
    title: person.displayName || "Unknown user",
    render: (close) => {
      const act = (fn) => () => {
        close();
        fn(person);
      };
      const btn = (label, fn, cls = "secondary") =>
        h("button", { class: `btn ${cls}`, onclick: act(fn) }, label);

      let friendBtn = null;
      if (!info.self && !info.blocked) {
        if (info.friend)
          friendBtn = h("button", { class: "btn secondary", disabled: true }, icon("check", 16), "Friends");
        else if (info.requested)
          friendBtn = h("button", { class: "btn secondary", disabled: true }, "Request sent");
        else if (person.username)
          friendBtn = btn("Add Friend", actions.addFriend);
      }

      return h(
        "div",
        { class: "profile-card" },
        h(
          "div",
          { class: "profile-top" },
          h(
            "div",
            { class: "member-avatar" },
            avatar(person, 80),
            info.online != null &&
              h("span", { class: `status-dot big${info.online ? " on" : ""}` }),
          ),
          h(
            "div",
            { class: "profile-names" },
            person.username &&
              h("div", { class: "muted" }, `@${person.username}`),
            info.role &&
              ROLE_NAMES[info.role] &&
              h("span", { class: `role-pill role-${info.role}` }, ROLE_NAMES[info.role]),
            info.blocked && h("span", { class: "role-pill blocked" }, "Blocked"),
          ),
        ),
        h(
          "div",
          { class: "field" },
          h("span", { class: "field-label" }, "About me"),
          h(
            "p",
            { class: `profile-about${person.about ? "" : " muted"}` },
            person.about || (info.self ? "You haven't written anything yet." : "Nothing here yet."),
          ),
        ),
        h(
          "div",
          { class: "profile-actions" },
          info.self
            ? btn("Edit Profile", actions.editProfile, "primary")
            : [
                !info.blocked && btn("Message", actions.message, "primary"),
                friendBtn,
                info.blocked
                  ? btn("Unblock", actions.unblock)
                  : btn("Block", actions.block, "ghost danger-text"),
              ],
        ),
        (info.canSetRole || info.canKick || info.canBan) &&
          h(
            "div",
            { class: "profile-actions mod-actions" },
            h("span", { class: "field-label" }, "Moderation"),
            info.canSetRole &&
              (info.role === "mod"
                ? btn("Remove Moderator", (p) => actions.setRole(p, "member"))
                : btn("Make Moderator", (p) => actions.setRole(p, "mod"))),
            info.canKick && btn("Kick from Server", actions.kick, "ghost danger-text"),
            info.canBan && btn("Ban from Sipher", actions.ban, "ghost danger-text"),
          ),
      );
    },
  });
}
