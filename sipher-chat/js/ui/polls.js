import { POLL_MAX_OPTIONS } from "../api.js";
import { h, icon } from "../dom.js";
import { openModal } from "./modal.js";

// Turns "/poll Question | A | B" into { question, options }, or null.
export function parsePollCommand(text) {
  const m = text.match(/^\/poll\s+([\s\S]+)$/i);
  if (!m) return null;
  const [question, ...options] = m[1].split("|").map((s) => s.trim());
  const opts = options.filter(Boolean).slice(0, POLL_MAX_OPTIONS);
  if (!question || opts.length < 2) return null;
  return { question: question.slice(0, 200), options: opts.map((o) => o.slice(0, 80)) };
}

// Asks for a question and 2-6 answers. Resolves to { question, options } or null.
export function pollModal() {
  return new Promise((resolve) => {
    let result = null;
    openModal({
      title: "Create a Poll",
      subtitle: "Tip: you can also type  /poll Question | Answer 1 | Answer 2",
      onClose: () => resolve(result),
      render: (close) => {
        const question = h("input", {
          class: "input",
          placeholder: "Pizza or tacos?",
          maxLength: 200,
          required: true,
        });
        const answers = h("div", { class: "poll-answers" });
        const error = h("p", { class: "form-error", hidden: true });
        const addAnswer = (value = "") => {
          if (answers.children.length >= POLL_MAX_OPTIONS) return;
          answers.append(
            h("input", {
              class: "input",
              placeholder: `Answer ${answers.children.length + 1}`,
              maxLength: 80,
              value,
            }),
          );
          more.hidden = answers.children.length >= POLL_MAX_OPTIONS;
        };
        const more = h(
          "button",
          { type: "button", class: "link-btn", onclick: () => addAnswer() },
          "+ Add another answer",
        );
        addAnswer();
        addAnswer();
        return h(
          "form",
          {
            class: "modal-form",
            onsubmit: (e) => {
              e.preventDefault();
              const options = [...answers.children]
                .map((i) => i.value.trim())
                .filter(Boolean);
              if (options.length < 2) {
                error.textContent = "A poll needs at least two answers.";
                error.hidden = false;
                return;
              }
              result = { question: question.value.trim(), options };
              close();
            },
          },
          h("label", { class: "field" }, h("span", { class: "field-label" }, "Question"), question),
          h("div", { class: "field" }, h("span", { class: "field-label" }, "Answers"), answers, more),
          error,
          h(
            "div",
            { class: "modal-actions" },
            h("button", { type: "button", class: "btn ghost", onclick: close }, "Cancel"),
            h("button", { type: "submit", class: "btn primary" }, "Post Poll"),
          ),
        );
      },
    });
  });
}

// The poll inside a message. Click an answer to vote; click it again to
// take the vote back.
export function pollCard(msg, me, onVote, nameOf) {
  const { question, options } = msg.poll;
  const votes = msg.votes || {};
  const counts = options.map(() => []);
  for (const [uid, i] of Object.entries(votes))
    if (counts[i]) counts[i].push(uid);
  const total = Object.values(counts).reduce((n, c) => n + c.length, 0);
  const mine = votes[me];
  return h(
    "div",
    { class: "poll" },
    h("div", { class: "poll-question" }, icon("chart", 16), question),
    options.map((label, i) => {
      const n = counts[i].length;
      const pct = total ? Math.round((n / total) * 100) : 0;
      return h(
        "button",
        {
          class: `poll-option${mine === i ? " mine" : ""}`,
          title: n ? counts[i].map((u) => nameOf(u)).join(", ") : "No votes yet",
          onclick: () => onVote(msg, mine === i ? null : i),
        },
        h("span", { class: "poll-bar", style: { width: `${pct}%` } }),
        h("span", { class: "poll-label truncate" }, mine === i && icon("check", 14), label),
        h("span", { class: "poll-count" }, `${n} · ${pct}%`),
      );
    }),
    h(
      "div",
      { class: "muted small" },
      `${total} vote${total === 1 ? "" : "s"}${mine == null ? " · click an answer to vote" : ""}`,
    ),
  );
}
