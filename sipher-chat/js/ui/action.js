// Handles the links in Firebase's account emails (verify email, reset
// password, undo an email change) inside Sipher, instead of on Firebase's
// hosted page. For the emails to link here, set the action URL in the
// Firebase console (Authentication → Templates → Customize action URL) to
// this page's address.
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { clear, h, logo } from "../dom.js";
import { auth } from "../firebase.js";

const MODES = [
  "verifyEmail",
  "resetPassword",
  "recoverEmail",
  "verifyAndChangeEmail",
];

// Returns { mode, oobCode } when the page was opened from an email link.
export function emailActionFromUrl() {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");
  return MODES.includes(mode) && oobCode ? { mode, oobCode } : null;
}

const ERRORS = {
  "auth/expired-action-code":
    "This link has expired. Request a new email and try again.",
  "auth/invalid-action-code":
    "This link is invalid or has already been used. Request a new email and try again.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "This account no longer exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
};

function message(err) {
  return ERRORS[err.code] || err.message || "Something went wrong.";
}

// The app's address without the parameters Firebase adds to email links.
function appUrl() {
  const params = new URLSearchParams(location.search);
  for (const key of [
    "mode",
    "oobCode",
    "apiKey",
    "lang",
    "continueUrl",
    "tenantId",
  ])
    params.delete(key);
  const search = params.toString();
  return location.origin + location.pathname + (search ? "?" + search : "");
}

export function renderEmailAction(container, { mode, oobCode }) {
  const body = h("div", { class: "modal-form" });
  const title = h("h1", { class: "auth-title" });
  const card = h(
    "div",
    { class: "auth-card action-card" },
    h("div", { class: "auth-logo" }, logo(40)),
    title,
    body,
  );
  clear(container).append(h("div", { class: "auth-screen" }, card));

  const continueButton = (label = "Continue to Sipher") =>
    h(
      "a",
      {
        class: "btn primary block",
        href: appUrl(),
        style: { marginTop: "16px" },
      },
      label,
    );

  function show(heading, text, ...extra) {
    title.textContent = heading;
    clear(body).append(
      h("p", { class: "auth-subtitle" }, text),
      ...extra.filter(Boolean),
    );
  }

  function fail(err) {
    show("That didn't work", message(err), continueButton("Back to Sipher"));
  }

  show("Just a moment…", "Checking your link.");

  if (mode === "verifyEmail") {
    applyActionCode(auth, oobCode)
      .then(async () => {
        // Refresh a session open in this browser so the app sees the change.
        await auth.currentUser?.reload().catch(() => {});
        show(
          "Email verified!",
          "Thanks, your email address is confirmed.",
          continueButton(),
        );
      })
      .catch(fail);
  } else if (mode === "recoverEmail" || mode === "verifyAndChangeEmail") {
    checkActionCode(auth, oobCode)
      .then(async (info) => {
        await applyActionCode(auth, oobCode);
        const email = info.data.email || info.data.previousEmail;
        show(
          mode === "recoverEmail" ? "Email restored" : "Email updated",
          mode === "recoverEmail"
            ? `Your sign-in email is back to ${email}. If you didn't ask for the change, reset your password too.`
            : `You can now sign in with ${email}.`,
          continueButton(),
        );
      })
      .catch(fail);
  } else if (mode === "resetPassword") {
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        const password = h("input", {
          class: "input",
          type: "password",
          autocomplete: "new-password",
          minLength: 6,
          required: true,
        });
        const error = h("div", { class: "auth-error", role: "alert" });
        const submit = h(
          "button",
          { class: "btn primary block", type: "submit" },
          "Save Password",
        );
        const form = h(
          "form",
          {
            onsubmit: async (e) => {
              e.preventDefault();
              error.textContent = "";
              submit.disabled = true;
              try {
                await confirmPasswordReset(auth, oobCode, password.value);
                show(
                  "Password changed",
                  "You can now log in with your new password.",
                  continueButton("Log In"),
                );
              } catch (err) {
                error.textContent = message(err);
                submit.disabled = false;
              }
            },
          },
          h(
            "label",
            { class: "field" },
            h("span", { class: "field-label" }, "New password"),
            password,
          ),
          error,
          submit,
        );
        show("Reset your password", `For ${email}`, form);
        password.focus();
      })
      .catch(fail);
  }
}
