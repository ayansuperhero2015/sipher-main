import {
  USERNAME_RE,
  cleanUsername,
  nextUsernameChange,
} from "../api.js";
import { avatar, h, icon } from "../dom.js";
import { openModal } from "./modal.js";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function suggestion(displayName = "") {
  const base = displayName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 16);
  return base.length >= 3 ? base : "";
}

// Picks or changes the username. `save(name)` does the write and throws a
// readable error (e.g. taken). Resolves when the dialog closes.
export function usernameModal(profile, save) {
  const next = nextUsernameChange(profile);
  const first = !profile.username;
  return new Promise((resolve) =>
    openModal({
      title: first ? "Pick a username" : "Change username",
      subtitle: first
        ? "People use this to find you and send you friend requests. You can change it once a month; your display name can change any time."
        : "Usernames can be changed once every 30 days.",
      onClose: resolve,
      render: (close) => {
        const input = h("input", {
          class: "input",
          value: profile.username || suggestion(profile.displayName),
          placeholder: "your_name",
          maxLength: 20,
          autocomplete: "off",
          spellcheck: false,
          disabled: Boolean(next),
        });
        const error = h("p", { class: "form-error", hidden: true });
        const submit = h(
          "button",
          { type: "submit", class: "btn primary", disabled: Boolean(next) },
          "Save",
        );
        return h(
          "form",
          {
            class: "modal-form",
            onsubmit: async (e) => {
              e.preventDefault();
              const name = cleanUsername(input.value);
              error.hidden = true;
              if (name === profile.username) return close();
              if (!USERNAME_RE.test(name)) {
                error.textContent =
                  "Use 3–20 characters: lowercase letters, numbers, _ or .";
                error.hidden = false;
                return;
              }
              submit.disabled = true;
              try {
                await save(name);
                close();
              } catch (err) {
                error.textContent =
                  err?.code === "permission-denied"
                    ? "You can't change your username yet."
                    : err.message;
                error.hidden = false;
                submit.disabled = false;
              }
            },
          },
          h(
            "label",
            { class: "field" },
            h("span", { class: "field-label" }, "Username"),
            h("div", { class: "at-input" }, h("span", null, "@"), input),
            next &&
              h(
                "span",
                { class: "muted small" },
                `You can change it again on ${dateFmt.format(next)}.`,
              ),
          ),
          error,
          h(
            "div",
            { class: "modal-actions" },
            h(
              "button",
              { type: "button", class: "btn ghost", onclick: close },
              first ? "Later" : "Cancel",
            ),
            submit,
          ),
        );
      },
    }),
  );
}

// Look someone up by username and send a request. `send(name, note)` throws
// a readable error when it can't.
export function addFriendModal(send) {
  openModal({
    title: "Add Friend",
    subtitle:
      "Type their Sipher username. They'll get a friend request, plus your message if you add one.",
    render: (close) => {
      const input = h("input", {
        class: "input",
        placeholder: "username",
        maxLength: 21,
        autocomplete: "off",
        spellcheck: false,
      });
      const note = h("input", {
        class: "input",
        placeholder: "Say hi (optional)",
        maxLength: 200,
      });
      const error = h("p", { class: "form-error", hidden: true });
      const submit = h(
        "button",
        { type: "submit", class: "btn primary" },
        "Send Friend Request",
      );
      return h(
        "form",
        {
          class: "modal-form",
          onsubmit: async (e) => {
            e.preventDefault();
            const name = cleanUsername(input.value);
            if (!name) return;
            error.hidden = true;
            submit.disabled = true;
            try {
              await send(name, note.value.trim());
              close();
            } catch (err) {
              error.textContent = err.message;
              error.hidden = false;
              submit.disabled = false;
            }
          },
        },
        h(
          "label",
          { class: "field" },
          h("span", { class: "field-label" }, "Username"),
          h("div", { class: "at-input" }, h("span", null, "@"), input),
        ),
        h(
          "label",
          { class: "field" },
          h("span", { class: "field-label" }, "Message"),
          note,
        ),
        error,
        h("div", { class: "modal-actions" }, submit),
      );
    },
  });
}

function personRow(person, sub, buttons, onclick) {
  return h(
    "div",
    {
      class: `friend-row${onclick ? " clickable" : ""}`,
      onclick,
    },
    h(
      "div",
      { class: "member-avatar" },
      avatar(person, 32),
      person.online != null &&
        h("span", { class: `status-dot${person.online ? " on" : ""}` }),
    ),
    h(
      "div",
      { class: "friend-names" },
      h("div", { class: "truncate" }, person.displayName || "Unknown"),
      sub && h("div", { class: "truncate muted small" }, sub),
    ),
    h("div", { class: "friend-actions" }, buttons),
  );
}

function smallBtn(name, title, onclick, cls = "") {
  return h(
    "button",
    {
      class: `icon-btn small${cls}`,
      title,
      "aria-label": title,
      onclick: (e) => {
        e.stopPropagation();
        onclick();
      },
    },
    icon(name, 14),
  );
}

// The top of the Direct Messages sidebar: Add Friend, pending requests and
// the friends list.
export function friendsSection({ requests, friends }, actions) {
  const { incoming, outgoing } = requests;
  return [
    h(
      "button",
      { class: "btn primary add-friend", onclick: actions.addFriend },
      icon("plus", 16),
      "Add Friend",
    ),
    incoming.length > 0 && [
      h(
        "div",
        { class: "channel-group" },
        h("span", null, `Requests — ${incoming.length}`),
      ),
      incoming.map((r) =>
        h(
          "div",
          { class: "request" },
          personRow(
            { uid: r.from, displayName: r.fromName },
            r.fromUsername ? `@${r.fromUsername}` : "Friend request",
            [
              smallBtn("check", "Accept", () => actions.acceptRequest(r), " ok"),
              smallBtn("x", "Ignore", () => actions.declineRequest(r), " danger"),
            ],
          ),
          r.note && h("div", { class: "request-note" }, `“${r.note}”`),
        ),
      ),
    ],
    outgoing.length > 0 && [
      h("div", { class: "channel-group" }, h("span", null, "Sent")),
      outgoing.map((r) =>
        personRow(
          { uid: r.to, displayName: r.toName },
          "Waiting for them to accept",
          [smallBtn("x", "Cancel request", () => actions.cancelRequest(r), " danger")],
        ),
      ),
    ],
    friends.length > 0 && [
      h(
        "div",
        { class: "channel-group" },
        h("span", null, `Friends — ${friends.length}`),
      ),
      friends.map((f) =>
        personRow(
          f,
          f.username ? `@${f.username}` : null,
          [
            smallBtn("chat", "Message", () => actions.messageFriend(f)),
            smallBtn("x", "Remove friend", () => actions.removeFriend(f), " danger"),
          ],
          () => actions.messageFriend(f),
        ),
      ),
    ],
  ];
}
