import { ACCESS_NOTE_LIMIT } from "../api.js";
import { append, avatar, clear, h, icon, logo } from "../dom.js";
import { openModal } from "./modal.js";

// The full-page screen shown instead of the app until you're let in.
// `view`: "code" (type the access code), "waiting" (asked, not let in yet),
// "banned", or "setup" (the database still has the old rules). `actions`: submit(code, note) resolving to an error message
// or null, signOut().
export function renderGate(container, view, name, actions) {
  let body;
  if (view === "code") {
    const error = h("div", { class: "auth-error", role: "alert" });
    const code = h("input", {
      class: "input gate-code",
      placeholder: "ABC123",
      maxLength: 12,
      autocomplete: "off",
      required: true,
    });
    const note = h("input", {
      class: "input",
      maxLength: ACCESS_NOTE_LIMIT,
      placeholder: "e.g. Sam Lee, 8th grade, Mr. Diaz's class",
      required: true,
    });
    const submit = h("button", { class: "btn primary block", type: "submit" }, "Ask to Join");
    body = h(
      "form",
      {
        class: "auth-card",
        onsubmit: async (e) => {
          e.preventDefault();
          submit.disabled = true;
          error.textContent = "";
          const problem = await actions.submit(
            code.value.trim().toUpperCase(),
            note.value.trim(),
          );
          if (problem) {
            error.textContent = problem;
            submit.disabled = false;
          }
        },
      },
      h("div", { class: "auth-logo" }, logo(40)),
      h("h1", { class: "auth-title" }, "Enter the access code"),
      h(
        "p",
        { class: "auth-subtitle" },
        "Sipher is just for our school. Ask a friend who's already on it for the code.",
      ),
      h("label", { class: "field" }, h("span", { class: "field-label" }, "Access code"), code),
      h("label", { class: "field" }, h("span", { class: "field-label" }, "Who are you?"), note),
      error,
      submit,
    );
  } else if (view === "setup") {
    body = h(
      "div",
      { class: "auth-card" },
      h("div", { class: "auth-logo" }, logo(40)),
      h("h1", { class: "auth-title" }, "Sipher is being updated"),
      h(
        "p",
        { class: "auth-subtitle" },
        "The database's new security rules haven't been published yet. Owner: publish them in the Firebase console (Firestore Database → Rules), then reload this page.",
      ),
      h(
        "button",
        { type: "button", class: "btn primary block", onclick: () => location.reload() },
        "Reload",
      ),
    );
  } else {
    const banned = view === "banned";
    body = h(
      "div",
      { class: "auth-card" },
      h("div", { class: "auth-logo" }, logo(40)),
      h("h1", { class: "auth-title" }, banned ? "You've been banned" : "Waiting to be let in"),
      h(
        "p",
        { class: "auth-subtitle" },
        banned
          ? "This account can't use Sipher anymore."
          : `Thanks, ${name}! The owner will check who you are and let you in. This page will open by itself when they do.`,
      ),
      !banned && h("div", { class: "gate-spinner" }),
    );
  }
  addLogOut(body, actions);
  clear(container).append(h("div", { class: "auth-screen" }, body));
}

function addLogOut(card, actions) {
  card.append(
    h(
      "p",
      { class: "auth-toggle" },
      h("button", { type: "button", class: "link-btn", onclick: actions.signOut }, "Log out"),
    ),
  );
}

// The admin's "Who Can Join" window: the access code, people waiting, and
// banned people. Returns update(data), which refreshes it and returns
// false once it has been closed. `data`: { code, waiting, bans }. `actions`: newCode(),
// approve(p), reject(p), ban(p), unban(b).
export function accessModal(data, actions) {
  let body = null;
  let open = true;
  const draw = (d) => {
    if (!body) return;
    append(clear(body), [
      h(
        "div",
        { class: "field" },
        h("span", { class: "field-label" }, "Access code"),
        h(
          "div",
          { class: "access-code-row" },
          h("span", { class: "access-code" }, d.code || "…"),
          h(
            "button",
            {
              class: "btn secondary",
              title: "Copy",
              onclick: () => d.code && navigator.clipboard?.writeText(d.code),
            },
            icon("copy", 16),
          ),
          h("button", { class: "btn secondary", onclick: actions.newCode }, "New Code"),
        ),
        h(
          "span",
          { class: "muted small" },
          "New people need this code, then you let them in below. People already on Sipher don't need it. Made a new code? The old one stops working.",
        ),
      ),
      h("h3", { class: "modal-section" }, `Waiting (${d.waiting.length})`),
      d.waiting.length === 0 && h("p", { class: "muted small" }, "Nobody is waiting."),
      d.waiting.map((p) =>
        h(
          "div",
          { class: "access-row" },
          avatar({ uid: p.uid, displayName: p.name }, 32),
          h(
            "div",
            { class: "access-info" },
            h("div", { class: "strong truncate" }, p.name),
            h("div", { class: "muted small" }, p.note || "(didn't say)"),
          ),
          h("button", { class: "btn primary small", onclick: () => actions.approve(p) }, "Let In"),
          h("button", { class: "btn secondary small", onclick: () => actions.reject(p) }, "Turn Away"),
          h("button", { class: "btn ghost danger-text small", onclick: () => actions.ban(p) }, "Ban"),
        ),
      ),
      h("h3", { class: "modal-section" }, `Banned (${d.bans.length})`),
      d.bans.length === 0 && h("p", { class: "muted small" }, "Nobody is banned."),
      d.bans.map((b) =>
        h(
          "div",
          { class: "access-row" },
          avatar({ uid: b.uid, displayName: b.name }, 32),
          h("div", { class: "access-info" }, h("div", { class: "strong truncate" }, b.name)),
          h("button", { class: "btn secondary small", onclick: () => actions.unban(b) }, "Unban"),
        ),
      ),
    ]);
  };
  openModal({
    title: "Who Can Join",
    subtitle: "Only you (the main server's owner) can see this.",
    onClose: () => {
      open = false;
    },
    render: () => {
      body = h("div", { class: "access-panel" });
      draw(data);
      return body;
    },
  });
  return (d) => {
    if (!open) return false;
    draw(d);
    return true;
  };
}
