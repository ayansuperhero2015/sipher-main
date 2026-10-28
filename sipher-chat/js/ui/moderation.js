import { REPORT_REASON_LIMIT } from "../api.js";
import { h } from "../dom.js";
import { openModal } from "./modal.js";

const QUICK_REASONS = ["Spam", "Bullying or harassment", "Inappropriate content", "Something else"];

// Asks why a message is being reported. Resolves to the reason, or null.
export function reportModal(msg, authorName) {
  return new Promise((resolve) => {
    let result = null;
    openModal({
      title: "Report Message",
      subtitle: `The server's owner and moderators will see this message from ${authorName} and your reason. ${authorName} won't be told who reported it.`,
      onClose: () => resolve(result),
      render: (close) => {
        const reason = h("textarea", {
          class: "input textarea",
          rows: 2,
          maxLength: REPORT_REASON_LIMIT,
          placeholder: "Tell the moderators what's wrong (optional)",
        });
        let picked = QUICK_REASONS[0];
        const chips = QUICK_REASONS.map((r, i) =>
          h(
            "button",
            {
              type: "button",
              class: `chip${i === 0 ? " active" : ""}`,
              onclick: (e) => {
                picked = r;
                chips.forEach((c) => c.classList.remove("active"));
                e.currentTarget.classList.add("active");
              },
            },
            r,
          ),
        );
        return h(
          "form",
          {
            class: "modal-form",
            onsubmit: (e) => {
              e.preventDefault();
              const extra = reason.value.trim();
              result = extra ? `${picked}: ${extra}` : picked;
              close();
            },
          },
          h("blockquote", { class: "report-quote" }, msg.text.slice(0, 300)),
          h("div", { class: "chips" }, chips),
          reason,
          h(
            "div",
            { class: "modal-actions" },
            h("button", { type: "button", class: "btn ghost", onclick: close }, "Cancel"),
            h("button", { type: "submit", class: "btn primary danger" }, "Report"),
          ),
        );
      },
    });
  });
}

// The moderators' list of reports. `actions`: jump(report), remove(report)
// deletes the message, dismiss(report) clears the report.
export function reportsModal(reports, actions) {
  openModal({
    title: "Reports",
    subtitle: "Messages people in this server have reported. Only the owner and moderators see this.",
    render: (close) => {
      const list = h("div", { class: "pins-list" });
      const item = (r) => {
        const el = h(
          "div",
          { class: "pin-item" },
          h(
            "div",
            { class: "pin-meta" },
            h("span", { class: "strong" }, r.authorName),
            h("span", { class: "muted small" }, `in #${r.channelName}`),
            h("span", { class: "muted small" }, r.createdAt?.toDate?.().toLocaleString() ?? ""),
          ),
          h("div", { class: "pin-text" }, r.text),
          h(
            "div",
            { class: "muted small" },
            `Reported by ${r.reporterName}: ${r.reason}`,
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
                  actions.jump(r);
                },
              },
              "Go to message",
            ),
            h(
              "button",
              {
                class: "link-btn danger-text",
                onclick: async () => {
                  if (await actions.remove(r)) el.remove();
                },
              },
              "Delete message",
            ),
            h(
              "button",
              {
                class: "link-btn",
                onclick: async () => {
                  if (await actions.dismiss(r)) el.remove();
                },
              },
              "Dismiss",
            ),
          ),
        );
        return el;
      };
      list.append(
        ...(reports.length
          ? reports.map(item)
          : [h("p", { class: "muted" }, "No reports. All good!")]),
      );
      return list;
    },
  });
}

// Shows the server's welcome message and rules. With `mustAccept`, the
// "I agree" button resolves to true.
export function rulesModal(server, mustAccept) {
  return new Promise((resolve) => {
    let agreed = false;
    openModal({
      title: `Welcome to ${server.name}!`,
      onClose: () => resolve(agreed),
      render: (close) =>
        h(
          "div",
          { class: "modal-form" },
          server.welcome && h("p", { class: "welcome-text" }, server.welcome),
          server.rules && [
            h("span", { class: "field-label" }, "Server Rules"),
            h("div", { class: "rules-text" }, server.rules),
          ],
          h(
            "div",
            { class: "modal-actions" },
            mustAccept
              ? [
                  h("button", { class: "btn ghost", onclick: close }, "Not now"),
                  h(
                    "button",
                    {
                      class: "btn primary",
                      onclick: () => {
                        agreed = true;
                        close();
                      },
                    },
                    "I agree to the rules",
                  ),
                ]
              : h("button", { class: "btn primary", onclick: close }, "Got it"),
          ),
        ),
    });
  });
}
