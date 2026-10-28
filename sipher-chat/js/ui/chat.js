import { MESSAGE_LIMIT, REACTIONS } from "../api.js";
import { append, avatar, clear, h, icon, toast } from "../dom.js";
import { createEmojiPicker, replaceShortcodes, searchEmoji } from "../emoji.js";
import { embedFor } from "../embeds.js";
import { censor } from "../filter.js";
import { createGifPicker } from "./gifpicker.js";
import { openModal } from "./modal.js";
import { parsePollCommand, pollCard } from "./polls.js";

const GROUP_GAP_MS = 7 * 60 * 1000;
const MAX_EMBEDS = 4;
const MAX_SUGGESTIONS = 6;
// How often "I'm typing" is re-sent while you keep typing.
const TYPING_EVERY_MS = 4000;
// Letters, digits and _ can't touch a mention, so "a@b.com" isn't one.
const WORD = "[\\p{L}\\p{N}_]";

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function toDate(ts) {
  return ts?.toDate ? ts.toDate() : new Date();
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function stamp(date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, now)) return `Today at ${timeFmt.format(date)}`;
  if (sameDay(date, yesterday)) return `Yesterday at ${timeFmt.format(date)}`;
  return `${date.toLocaleDateString()} ${timeFmt.format(date)}`;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionPattern(names) {
  return `(?<!${WORD})@(?:${names.map(escapeRe).join("|")})(?!${WORD})`;
}

// ---- lightweight markdown: ```blocks```, `code`, **bold**, ~~strike~~,
// ||spoilers||, *italic*, links and @mentions ----

const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(~~[^~\n]+~~)|(\|\|[^|\n]+\|\|)|(\*[^*\s][^*\n]*\*)|(https?:\/\/[^\s<]*[^\s<.,:;"')\]!?])/g;

// Splits plain text around @mentions of known names.
function mentions(text, re) {
  if (!re) return [text];
  const out = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(h("span", { class: "mention" }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function inline(text, re) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(mentions(text.slice(last, m.index), re));
    const [token, code, bold, strike, spoiler, italic, url] = m;
    if (code) out.push(h("code", { class: "inline-code" }, code.slice(1, -1)));
    else if (bold) out.push(h("strong", null, mentions(bold.slice(2, -2), re)));
    else if (strike) out.push(h("s", null, strike.slice(2, -2)));
    else if (spoiler)
      out.push(
        h(
          "span",
          {
            class: "spoiler",
            title: "Spoiler: click to show",
            onclick: (e) => e.currentTarget.classList.add("revealed"),
          },
          spoiler.slice(2, -2),
        ),
      );
    else if (italic) out.push(h("em", null, mentions(italic.slice(1, -1), re)));
    else if (url)
      out.push(
        h(
          "a",
          { href: url, target: "_blank", rel: "noopener noreferrer" },
          url,
        ),
      );
    last = m.index + token.length;
  }
  if (last < text.length) out.push(mentions(text.slice(last), re));
  return out;
}

function formatText(text, re) {
  return text
    .split(/```(?:[a-zA-Z0-9]*\n)?([\s\S]*?)```/g)
    .map((part, i) =>
      i % 2 ? h("pre", { class: "code-block" }, part) : inline(part, re),
    );
}

// Links outside code blocks that can be shown inline (GIFs, images, videos).
function embedsIn(text) {
  const prose = text.replace(/```[\s\S]*?```|`[^`\n]+`/g, " ");
  const seen = new Set();
  const out = [];
  for (const [url] of prose.matchAll(INLINE)) {
    if (!url.startsWith("http")) continue;
    const embed = embedFor(url);
    if (!embed || seen.has(embed.src)) continue;
    seen.add(embed.src);
    out.push(embed);
    if (out.length === MAX_EMBEDS) break;
  }
  return out;
}

// ---- the chat pane ----

export function createChat(el, actions) {
  const drafts = new Map();
  let channel = null;
  let messages = [];
  let hasMore = false;
  let members = new Map();
  let me = null;
  let canModerate = false;
  let canPin = false;
  let editingId = null;
  // The message the composer is answering.
  let replying = null;
  // Highlights @Name for everyone in the conversation, and spots our own.
  let mentionRe = null;
  let mentionsMeRe = null;
  let mentionKey = null;
  let mentionVersion = 0;
  // Rendered rows by message id, reused while nothing about them changes so
  // GIFs keep playing and edits in progress survive new messages arriving.
  let rowCache = new Map();
  // Whether the view is following the newest message.
  let pinned = true;
  // While older messages load: distance from the bottom to keep in place.
  let anchor = null;
  let olderFrom = 0;
  // The open reaction picker, if any.
  let openPicker = null;
  // @mention / :emoji: suggestions under the cursor:
  // { kind, start, end, items, index }.
  let suggest = null;
  // People you've blocked: their messages are folded away.
  let blocked = new Set();
  let revealed = new Set();
  // The server's swear filter pattern, if it's on.
  let filterRe = null;
  let canReport = false;
  // Slow mode for this channel (seconds) and when you last posted, per channel.
  let slowMode = 0;
  const lastSent = new Map();
  let slowTimer = null;
  let lastTyping = 0;

  const title = h("div", { class: "chat-title" });
  const header = h(
    "header",
    { class: "chat-header" },
    h(
      "button",
      {
        class: "icon-btn mobile-only",
        title: "Channels",
        onclick: actions.toggleSidebar,
      },
      icon("menu"),
    ),
    title,
    h("div", { class: "spacer" }),
    h(
      "button",
      {
        class: "icon-btn",
        title: "Search Messages",
        onclick: () => openSearch(),
      },
      icon("search"),
    ),
    h(
      "button",
      {
        class: "icon-btn",
        title: "Pinned Messages",
        onclick: () => actions.showPins(),
      },
      icon("pin"),
    ),
    h(
      "button",
      {
        class: "icon-btn",
        title: "Member List",
        onclick: actions.toggleMembers,
      },
      icon("users"),
    ),
  );
  const list = h("div", {
    class: "messages",
    role: "log",
    "aria-live": "polite",
  });
  const scroller = h("div", { class: "messages-scroller" }, list);
  const jumpBtn = h(
    "button",
    {
      class: "jump-latest",
      hidden: true,
      onclick: () => {
        scroller.scrollTop = scroller.scrollHeight;
      },
    },
    "Jump to latest",
    icon("down", 14),
  );
  scroller.addEventListener(
    "scroll",
    () => {
      pinned = nearBottom();
      jumpBtn.hidden = pinned;
    },
    { passive: true },
  );

  document.addEventListener("click", (e) => {
    if (openPicker && !openPicker.contains(e.target)) closePicker();
  });

  // Media sizes aren't known until it loads; keep following the bottom.
  function settle() {
    if (pinned) scroller.scrollTop = scroller.scrollHeight;
  }

  function media(embed, onFail) {
    const fail = () => {
      wrap.remove();
      onFail();
    };
    const el =
      embed.kind === "video"
        ? h("video", {
            src: embed.src,
            autoplay: true,
            loop: true,
            muted: true,
            playsInline: true,
            onloadeddata: settle,
            onerror: fail,
          })
        : h("img", {
            src: embed.src,
            alt: "",
            referrerPolicy: "no-referrer",
            onload: settle,
            onerror: fail,
          });
    const wrap = h(
      "a",
      {
        class: "embed",
        href: embed.src,
        target: "_blank",
        rel: "noopener noreferrer",
      },
      el,
    );
    return wrap;
  }

  const input = h("textarea", {
    class: "composer-input",
    rows: 1,
    maxLength: MESSAGE_LIMIT,
    oninput: () => {
      autosize(input);
      if (channel) drafts.set(channel.id, input.value);
      updateSuggestions();
      sendTyping();
    },
    onblur: () => closeSuggestions(),
    onkeydown: (e) => {
      if (suggest && !e.isComposing) {
        const n = suggest.items.length;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          suggest.index =
            (suggest.index + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
          return renderSuggestions();
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          return pickSuggestion(suggest.index);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          return closeSuggestions();
        }
      }
      if (e.key === "Escape" && replying) {
        e.preventDefault();
        cancelReply();
      } else if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send();
      } else if (e.key === "ArrowUp" && !input.value) {
        const mine = [...messages].reverse().find((m) => m.authorId === me);
        if (mine) {
          e.preventDefault();
          startEdit(mine.id);
        }
      }
    },
  });
  const sendBtn = h(
    "button",
    { class: "icon-btn send", title: "Send", onclick: () => send() },
    icon("send"),
  );
  const gifs = createGifPicker((url) => {
    if (input.disabled) return toast("You can't post here right now.");
    if (slowWait() > 0) return toast(`Slow mode: wait ${slowWait()}s.`);
    const extra = replyExtra();
    cancelReply();
    noteSent();
    actions.send(url, extra).catch(() => {});
    input.focus();
  });
  const emoji = createEmojiPicker((e) => insertText(e));
  const emojiBtn = h(
    "button",
    {
      class: "icon-btn",
      title: "Emoji",
      onclick: (e) => {
        e.stopPropagation();
        gifs.hide();
        emoji.toggle();
      },
    },
    icon("smile"),
  );
  async function createPoll() {
    if (slowWait() > 0) return toast(`Slow mode: wait ${slowWait()}s.`);
    const poll = await actions.createPoll();
    if (poll) sendPoll(poll);
  }

  // Wraps the selected text (or a placeholder) in markers like ||…||.
  function wrapSelection(before, after, placeholder) {
    if (input.disabled) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const inner = input.value.slice(start, end) || placeholder;
    input.value =
      input.value.slice(0, start) + before + inner + after + input.value.slice(end);
    input.setSelectionRange(start + before.length, start + before.length + inner.length);
    autosize(input);
    if (channel) drafts.set(channel.id, input.value);
    input.focus();
  }

  // The ⋯ menu: polls, games and other extras.
  const moreItem = (name, label, hint, onclick, needsSend = true) =>
    h(
      "button",
      {
        class: "more-item",
        dataset: needsSend ? { send: "1" } : null,
        // mousedown, so the message box keeps its selection.
        onmousedown: (e) => e.preventDefault(),
        onclick: (e) => {
          // Don't let the click also close the panel it opens.
          e.stopPropagation();
          morePanel.hidden = true;
          onclick();
        },
      },
      h("span", { class: "more-icon" }, icon(name, 18)),
      h(
        "span",
        { class: "more-text" },
        h("span", { class: "strong" }, label),
        h("span", { class: "muted small" }, hint),
      ),
    );
  const morePanel = h(
    "div",
    { class: "more-panel", hidden: true },
    moreItem("chart", "Create Poll", "Let everyone vote", createPoll),
    moreItem("gamepad", "Games", "Play with people here", () => actions.openGames(), false),
    moreItem("smile", "Emoji", "Pick an emoji", () => emoji.toggle()),
    moreItem("gif", "GIFs", "Search for a GIF", () => gifs.button.click()),
    moreItem("eyeOff", "Spoiler", "Hide text until clicked", () =>
      wrapSelection("||", "||", "spoiler"),
    ),
    moreItem("code", "Code Block", "Share code neatly", () =>
      wrapSelection("```\n", "\n```", "code here"),
    ),
    moreItem("search", "Search Messages", "Find something said here", () => openSearch(), false),
    moreItem("pin", "Pinned Messages", "See what's pinned", () => actions.showPins(), false),
  );
  const moreBtn = h(
    "button",
    {
      class: "icon-btn",
      title: "More",
      "aria-label": "More options",
      onclick: (e) => {
        e.stopPropagation();
        gifs.hide();
        emoji.hide();
        morePanel.hidden = !morePanel.hidden;
        // Things that write in the message box are off when you can't post.
        for (const b of morePanel.querySelectorAll("[data-send]"))
          b.disabled = input.disabled;
      },
    },
    icon("dots"),
  );
  document.addEventListener("click", (e) => {
    if (!emoji.panel.contains(e.target) && !emojiBtn.contains(e.target))
      emoji.hide();
    if (!morePanel.contains(e.target) && !moreBtn.contains(e.target))
      morePanel.hidden = true;
  });
  const replyBar = h("div", { class: "reply-bar", hidden: true });
  const suggestions = h("div", { class: "mention-popup", hidden: true });
  const typingLine = h("div", { class: "typing-line" });
  const slowLine = h("span", { class: "slow-line", hidden: true });
  // Shown instead of the message box when you can't post yet (rules).
  const gate = h("div", { class: "composer-gate", hidden: true });
  const composer = h(
    "div",
    { class: "composer" },
    jumpBtn,
    gifs.panel,
    emoji.panel,
    morePanel,
    suggestions,
    replyBar,
    gate,
    h(
      "div",
      { class: "composer-box" },
      moreBtn,
      input,
      emojiBtn,
      gifs.button,
      sendBtn,
    ),
    h("div", { class: "composer-foot" }, typingLine, slowLine),
  );

  const empty = h("div", { class: "chat-empty" });
  append(el, [header, scroller, composer, empty]);

  function autosize(t) {
    // Measuring before the layout settles can come out far too tall, and an
    // empty box is always one line anyway.
    if (!t.value) return (t.style.height = "");
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 240) + "px";
  }

  function nameOf(uid, fallback) {
    return members.get(uid)?.displayName || fallback || "Unknown";
  }

  // ---- replies ----

  function replyExtra() {
    if (!replying) return {};
    return {
      replyTo: {
        ...replying,
        authorName: nameOf(replying.authorId, replying.authorName),
      },
    };
  }

  function startReply(msg) {
    replying = msg;
    renderReplyBar();
    input.focus();
  }

  function cancelReply() {
    replying = null;
    renderReplyBar();
  }

  function renderReplyBar() {
    replyBar.hidden = !replying;
    clear(replyBar);
    if (!replying) return;
    append(replyBar, [
      h(
        "span",
        { class: "truncate" },
        "Replying to ",
        h("strong", null, nameOf(replying.authorId, replying.authorName)),
      ),
      h(
        "button",
        {
          class: "icon-btn small",
          title: "Cancel reply",
          onclick: () => {
            cancelReply();
            input.focus();
          },
        },
        icon("x", 14),
      ),
    ]);
  }

  async function send() {
    const raw = input.value.trim();
    if (!raw || !channel || input.disabled) return;
    const wait = slowWait();
    if (wait > 0) return toast(`Slow mode is on. You can send again in ${wait}s.`);
    const poll = parsePollCommand(raw);
    if (/^\/poll\b/i.test(raw) && !poll)
      return toast("Polls look like: /poll Question | Answer 1 | Answer 2");
    const text = replaceShortcodes(raw);
    const reply = replying;
    const extra = poll ? { poll } : replyExtra();
    input.value = "";
    drafts.delete(channel.id);
    autosize(input);
    closeSuggestions();
    cancelReply();
    stopTyping();
    noteSent();
    try {
      await actions.send(poll ? poll.question : text, extra);
    } catch {
      // actions.send already reported the error; give the text back.
      lastSent.delete(channel.id);
      input.value = raw;
      drafts.set(channel.id, raw);
      autosize(input);
      replying = reply;
      renderReplyBar();
    }
  }

  function sendPoll(poll) {
    noteSent();
    actions.send(poll.question, { poll }).catch(() => lastSent.delete(channel?.id));
  }

  // Puts text at the cursor (used by the emoji picker).
  function insertText(text) {
    if (input.disabled) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const caret = start + text.length;
    input.setSelectionRange(caret, caret);
    autosize(input);
    if (channel) drafts.set(channel.id, input.value);
    input.focus();
  }

  // ---- typing & slow mode ----

  function sendTyping() {
    if (!input.value.trim()) return stopTyping();
    if (Date.now() - lastTyping < TYPING_EVERY_MS) return;
    lastTyping = Date.now();
    actions.typing(true);
  }

  function stopTyping() {
    if (!lastTyping) return;
    lastTyping = 0;
    actions.typing(false);
  }

  function renderTyping(people) {
    const names = people.map((p) => nameOf(p.uid, p.name));
    let text = "";
    if (names.length === 1) text = `${names[0]} is typing…`;
    else if (names.length === 2) text = `${names[0]} and ${names[1]} are typing…`;
    else if (names.length === 3)
      text = `${names[0]}, ${names[1]} and ${names[2]} are typing…`;
    else if (names.length > 3) text = "Several people are typing…";
    append(clear(typingLine), [
      text && h("span", { class: "typing-dots" }, h("i"), h("i"), h("i")),
      text,
    ]);
  }

  // Seconds left before you may post again in this channel (0 = now).
  function slowWait() {
    if (!slowMode || !channel) return 0;
    const since = Date.now() - (lastSent.get(channel.id) || 0);
    return Math.max(0, Math.ceil(slowMode - since / 1000));
  }

  function noteSent() {
    if (!slowMode || !channel) return;
    lastSent.set(channel.id, Date.now());
    renderSlow();
  }

  function renderSlow() {
    clearTimeout(slowTimer);
    slowLine.hidden = !slowMode;
    if (!slowMode) return;
    const wait = slowWait();
    append(clear(slowLine), [
      icon("clock", 14),
      wait > 0 ? `Slow mode: ${wait}s` : `Slow mode: ${slowMode}s between messages`,
    ]);
    if (wait > 0) slowTimer = setTimeout(renderSlow, 1000);
  }

  // ---- search ----

  // Searches the messages already loaded (text and author names).
  function openSearch() {
    if (!channel) return;
    openModal({
      title: "Search Messages",
      subtitle: `In ${channel.dm ? channel.name : "#" + channel.name}. Only loaded messages are searched${hasMore ? "; use “Load older messages” to search further back" : ""}.`,
      render: (close) => {
        const box = h("input", {
          class: "input",
          placeholder: "Search for a word or a name",
          oninput: () => draw(),
        });
        const results = h("div", { class: "pins-list search-results" });
        function draw() {
          const q = box.value.trim().toLowerCase();
          if (!q) return append(clear(results), []);
          const found = messages
            .filter(
              (m) =>
                !blocked.has(m.authorId) &&
                (m.text.toLowerCase().includes(q) ||
                  nameOf(m.authorId, m.authorName).toLowerCase().includes(q)),
            )
            .reverse()
            .slice(0, 50);
          append(clear(results), [
            found.length === 0 && h("p", { class: "muted" }, "No messages found."),
            found.map((m) =>
              h(
                "button",
                {
                  class: "pin-item search-hit",
                  onclick: () => {
                    close();
                    jumpTo(m.id);
                  },
                },
                h(
                  "div",
                  { class: "pin-meta" },
                  h("span", { class: "strong" }, nameOf(m.authorId, m.authorName)),
                  h("span", { class: "muted small" }, stamp(toDate(m.createdAt))),
                ),
                h(
                  "div",
                  { class: "pin-text" },
                  censor(m.text.length > 200 ? m.text.slice(0, 200) + "…" : m.text, filterRe),
                ),
              ),
            ),
          ]);
        }
        return h("div", { class: "modal-form" }, box, results);
      },
    });
  }

  // ---- @mention suggestions ----

  function updateSuggestions() {
    const pos = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, pos);
    const colon = before.match(/(?:^|\s):([a-z0-9_+-]{2,32})$/i);
    if (colon) {
      const items = searchEmoji(colon[1], MAX_SUGGESTIONS);
      if (items.length === 0) return closeSuggestions();
      suggest = {
        kind: "emoji",
        start: pos - colon[1].length - 1,
        end: pos,
        items,
        index: 0,
      };
      return renderSuggestions();
    }
    const match = before.match(/(?:^|\s)@([^\s@]{0,32})$/);
    if (!match || !channel) return closeSuggestions();
    const q = match[1].toLowerCase();
    const starts = (m) => (m.displayName.toLowerCase().startsWith(q) ? 0 : 1);
    const people = [...members.values()]
      .filter(
        (m) =>
          m.uid !== me &&
          m.displayName &&
          m.displayName.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          starts(a) - starts(b) || a.displayName.localeCompare(b.displayName),
      );
    const everyone =
      !channel.dm && "everyone".startsWith(q)
        ? [{ uid: "", displayName: "everyone", everyone: true }]
        : [];
    const items = [...everyone, ...people].slice(0, MAX_SUGGESTIONS);
    if (items.length === 0) return closeSuggestions();
    suggest = {
      kind: "member",
      start: pos - match[1].length - 1,
      end: pos,
      items,
      index: 0,
    };
    renderSuggestions();
  }

  function renderSuggestions() {
    suggestions.hidden = false;
    if (suggest.kind === "emoji") {
      return append(clear(suggestions), [
        h("div", { class: "mention-head" }, "Emoji"),
        suggest.items.map((e, i) =>
          h(
            "button",
            {
              class: `mention-item${i === suggest.index ? " active" : ""}`,
              onmousedown: (ev) => {
                ev.preventDefault();
                pickSuggestion(i);
              },
            },
            h("span", { class: "emoji-big" }, e.emoji),
            h("span", { class: "truncate" }, `:${e.code}:`),
          ),
        ),
      ]);
    }
    append(clear(suggestions), [
      h("div", { class: "mention-head" }, "Members"),
      suggest.items.map((m, i) =>
        h(
          "button",
          {
            class: `mention-item${i === suggest.index ? " active" : ""}`,
            // mousedown, so the composer keeps focus.
            onmousedown: (e) => {
              e.preventDefault();
              pickSuggestion(i);
            },
          },
          m.everyone
            ? h("span", { class: "mention-everyone" }, "@")
            : avatar(m, 24),
          h("span", { class: "truncate" }, m.displayName),
          m.everyone &&
            h("span", { class: "muted small" }, "Mention everyone here"),
        ),
      ),
    ]);
  }

  function pickSuggestion(i) {
    const item = suggest.items[i];
    const text = suggest.kind === "emoji" ? item.emoji : `@${item.displayName} `;
    input.value =
      input.value.slice(0, suggest.start) + text + input.value.slice(suggest.end);
    const caret = suggest.start + text.length;
    input.setSelectionRange(caret, caret);
    closeSuggestions();
    autosize(input);
    if (channel) drafts.set(channel.id, input.value);
    input.focus();
  }

  function closeSuggestions() {
    suggest = null;
    suggestions.hidden = true;
  }

  function mentionsMe(msg) {
    if (msg.authorId === me) return false;
    if (msg.replyTo?.authorId === me) return true;
    return Boolean(mentionsMeRe?.test(msg.text));
  }

  // Rebuilds the mention patterns when someone's name changes.
  function updateMentionPatterns(meName) {
    const names = [
      ...new Set([...members.values()].map((m) => m.displayName)),
    ]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const source = mentionPattern(["everyone", ...names]);
    const key = `${meName}\n${source}`;
    if (key === mentionKey) return;
    mentionKey = key;
    mentionRe = new RegExp(source, "gu");
    mentionsMeRe = new RegExp(
      mentionPattern(["everyone", ...(meName ? [meName] : [])]),
      "u",
    );
    mentionVersion++;
  }

  // ---- message actions ----

  function startEdit(id) {
    editingId = id;
    render(true);
  }

  function stopEdit() {
    editingId = null;
    render(false);
    input.focus();
  }

  function react(msg, emoji) {
    closePicker();
    const current = msg.reactions?.[me];
    actions.react(msg, current === emoji ? null : emoji);
  }

  function closePicker() {
    if (!openPicker) return;
    openPicker.hidden = true;
    openPicker.closest(".message")?.classList.remove("tools-open");
    openPicker = null;
  }

  function togglePicker(picker) {
    const wasOpen = openPicker === picker;
    closePicker();
    if (wasOpen) return;
    picker.hidden = false;
    picker.closest(".message")?.classList.add("tools-open");
    openPicker = picker;
  }

  async function copyText(msg) {
    try {
      await navigator.clipboard.writeText(msg.text);
      toast("Copied to clipboard.", "ok");
    } catch {
      toast("Couldn't copy that message.", "error");
    }
  }

  // Scrolls to a loaded message and flashes it. False if it isn't loaded.
  function jumpTo(id) {
    const row = rowCache.get(id)?.el;
    if (!row?.isConnected) return false;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.remove("flash");
    void row.offsetWidth;
    row.classList.add("flash");
    return true;
  }

  function nearBottom() {
    return (
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120
    );
  }

  function loadOlder(btn) {
    btn.disabled = true;
    btn.textContent = "Loading…";
    anchor = scroller.scrollHeight - scroller.scrollTop;
    olderFrom = messages.length;
    actions.loadOlder();
  }

  // ---- rendering ----

  function editor(msg) {
    const box = h("textarea", {
      class: "edit-input",
      value: msg.text,
      maxLength: MESSAGE_LIMIT,
      oninput: () => autosize(box),
      onkeydown: async (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          stopEdit();
        } else if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          save();
        }
      },
    });
    async function save() {
      const text = box.value.trim();
      if (!text) return actions.remove(msg).then(stopEdit);
      if (text !== msg.text) await actions.edit(msg, text);
      stopEdit();
    }
    queueMicrotask(() => {
      autosize(box);
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    });
    return h(
      "div",
      { class: "edit-wrap" },
      box,
      h(
        "div",
        { class: "edit-hint" },
        "escape to ",
        h("button", { class: "link-btn", onclick: stopEdit }, "cancel"),
        " • enter to ",
        h("button", { class: "link-btn", onclick: save }, "save"),
      ),
    );
  }

  function replyQuote(reply) {
    const name = nameOf(reply.authorId, reply.authorName);
    const author = { ...members.get(reply.authorId), uid: reply.authorId };
    return h(
      "button",
      {
        class: "reply-quote",
        title: "Jump to the original message",
        onclick: () => {
          if (!jumpTo(reply.id))
            toast(
              "That message isn't loaded (or was deleted). Try “Load older messages”.",
            );
        },
      },
      avatar({ ...author, displayName: name }, 16),
      h("span", { class: "reply-author" }, name),
      h(
        "span",
        { class: "reply-text truncate" },
        blocked.has(reply.authorId)
          ? "Blocked message"
          : censor(reply.text.replace(/\s+/g, " "), filterRe),
      ),
    );
  }

// One line standing in for a run of messages from someone you blocked.
  function blockedRow(ids) {
    return h(
      "div",
      { class: "message blocked-message" },
      h("div", { class: "message-gutter" }),
      h(
        "div",
        { class: "message-body muted small" },
        ids.length === 1
          ? "1 message from someone you blocked. "
          : `${ids.length} messages from someone you blocked. `,
        h(
          "button",
          {
            class: "link-btn",
            onclick: () => {
              ids.forEach((id) => revealed.add(id));
              render(true);
            },
          },
          "Show",
        ),
      ),
    );
  }

  function isHidden(msg) {
    return blocked.has(msg.authorId) && !revealed.has(msg.id);
  }

  function reactionBar(msg) {
    const byEmoji = new Map();
    for (const [uid, emoji] of Object.entries(msg.reactions || {})) {
      if (!byEmoji.has(emoji)) byEmoji.set(emoji, []);
      byEmoji.get(emoji).push(uid);
    }
    const shown = REACTIONS.filter((e) => byEmoji.has(e));
    if (shown.length === 0) return null;
    return h(
      "div",
      { class: "reactions" },
      shown.map((emoji) => {
        const uids = byEmoji.get(emoji);
        return h(
          "button",
          {
            class: `reaction${uids.includes(me) ? " mine" : ""}`,
            title: uids.map((u) => nameOf(u, "Someone")).join(", "),
            onclick: () => react(msg, emoji),
          },
          h("span", null, emoji),
          h("span", { class: "reaction-count" }, uids.length),
        );
      }),
    );
  }

  function toolbar(msg) {
    const mine = msg.authorId === me;
    const picker = h(
      "div",
      { class: "react-picker", hidden: true },
      REACTIONS.map((emoji) =>
        h(
          "button",
          {
            class: `react-choice${msg.reactions?.[me] === emoji ? " mine" : ""}`,
            onclick: () => react(msg, emoji),
          },
          emoji,
        ),
      ),
    );
    const tool = (name, label, onclick, extraClass = "") =>
      h(
        "button",
        {
          class: `icon-btn small${extraClass}`,
          title: label,
          "aria-label": label,
          onclick,
        },
        icon(name, 16),
      );
    return h(
      "div",
      { class: "message-tools" },
      tool("smile", "Add Reaction", (e) => {
        e.stopPropagation();
        togglePicker(picker);
      }),
      tool("reply", "Reply", () => startReply(msg)),
      tool("forward", "Forward", () => actions.forward(msg)),
      canPin &&
        tool(
          "pin",
          msg.pinned ? "Unpin Message" : "Pin Message",
          () => actions.pin(msg, !msg.pinned),
          msg.pinned ? " active" : "",
        ),
      tool("copy", "Copy Text", () => copyText(msg)),
      canReport && !mine && tool("flag", "Report Message", () => actions.report(msg)),
      mine && !msg.poll && tool("edit", "Edit", () => startEdit(msg.id)),
      (mine || canModerate) &&
        tool("trash", "Delete", (e) => actions.remove(msg, e.shiftKey), " danger"),
      picker,
    );
  }

  function messageRow(msg, grouped) {
    const date = toDate(msg.createdAt);
    const author = members.get(msg.authorId) || {
      uid: msg.authorId,
      displayName: msg.authorName,
    };
    const name = author.displayName || msg.authorName || "Unknown";
    const openProfile = () => actions.openProfile(msg.authorId, name);

    let content;
    if (msg.id === editingId) {
      content = editor(msg);
    } else if (msg.poll) {
      content = pollCard(
        { ...msg, poll: { ...msg.poll, question: censor(msg.poll.question, filterRe) } },
        me,
        actions.vote,
        (uid) => nameOf(uid, "Someone"),
      );
    } else {
      const embeds = embedsIn(msg.text);
      // A message that is just a GIF link shows only the GIF, like Discord.
      const soleLink =
        embeds.length === 1 && /^https?:\/\/\S+$/.test(msg.text.trim());
      const text = h(
        "div",
        { class: "message-text", hidden: soleLink && !msg.editedAt },
        formatText(censor(msg.text, filterRe), mentionRe),
        msg.editedAt &&
          h(
            "span",
            { class: "edited", title: stamp(toDate(msg.editedAt)) },
            " (edited)",
          ),
      );
      content = [
        text,
        embeds.length > 0 &&
          h(
            "div",
            { class: "embeds" },
            embeds.map((e) => media(e, () => (text.hidden = false))),
          ),
      ];
      if (msg.forwarded) {
        content = h(
          "div",
          { class: "forward-box" },
          h(
            "div",
            { class: "forward-label" },
            icon("forward", 14),
            `Forwarded from ${msg.forwarded.authorName || "someone"}`,
            msg.forwarded.from && ` · ${msg.forwarded.from}`,
          ),
          content,
        );
      }
    }

    const tools = msg.id !== editingId && toolbar(msg);
    const extras = [
      msg.pinned &&
        h("div", { class: "pinned-label" }, icon("pin", 12), "Pinned"),
      reactionBar(msg),
    ];
    const cls = [
      "message",
      grouped && "grouped",
      msg.pending && "pending",
      mentionsMe(msg) && "mentioned",
    ]
      .filter(Boolean)
      .join(" ");

    if (grouped) {
      return h(
        "div",
        { class: cls, dataset: { id: msg.id } },
        h(
          "span",
          { class: "message-gutter", title: stamp(date) },
          timeFmt.format(date),
        ),
        h("div", { class: "message-body" }, content, extras),
        tools,
      );
    }
    return h(
      "div",
      { class: cls, dataset: { id: msg.id } },
      msg.replyTo && replyQuote(msg.replyTo),
      h(
        "button",
        { class: "message-avatar", title: `View ${name}'s profile`, onclick: openProfile },
        avatar({ ...author, displayName: name }, 40),
      ),
      h(
        "div",
        { class: "message-body" },
        h(
          "div",
          { class: "message-meta" },
          h(
            "button",
            {
              class: `message-author${author.role && author.role !== "member" ? " role-" + author.role : ""}`,
              onclick: openProfile,
            },
            name,
          ),
          author.role === "mod" &&
            h("span", { class: "mod-tag", title: "Moderator" }, "MOD"),
          h(
            "span",
            { class: "message-time", title: date.toLocaleString() },
            stamp(date),
          ),
        ),
        content,
        extras,
      ),
      tools,
    );
  }

  function render(keepScroll) {
    const stick = !keepScroll || nearBottom();
    const top = !channel
      ? null
      : hasMore
        ? h(
            "div",
            { class: "load-older" },
            h(
              "button",
              {
                class: "btn secondary",
                onclick: (e) => loadOlder(e.currentTarget),
              },
              "Load older messages",
            ),
          )
        : h(
            "div",
            { class: "channel-intro" },
            channel.dm
              ? h("div", { class: "channel-intro-icon" }, avatar(channel.dm, 68))
              : h("div", { class: "channel-intro-icon" }, icon("hash", 40)),
            h(
              "h1",
              null,
              channel.dm ? channel.name : `Welcome to #${channel.name}!`,
            ),
            h(
              "p",
              { class: "muted" },
              channel.dm
                ? `This is the beginning of your direct message history with ${channel.name}.`
                : `This is the start of the #${channel.name} channel.`,
            ),
          );
    const rows = [top];

    const nextCache = new Map();
    let prev = null;
    let hiddenRun = null;
    for (const msg of messages) {
      if (isHidden(msg)) {
        // Back-to-back messages from blocked people share one line.
        if (!hiddenRun) {
          hiddenRun = [];
          rows.push({ blockedIds: hiddenRun });
        }
        hiddenRun.push(msg.id);
        continue;
      }
      const afterHidden = Boolean(hiddenRun);
      hiddenRun = null;
      const date = toDate(msg.createdAt);
      const prevDate = prev && toDate(prev.createdAt);
      if (!prev || !sameDay(prevDate, date)) {
        rows.push(
          h(
            "div",
            { class: "day-divider" },
            h("span", null, dayFmt.format(date)),
          ),
        );
      }
      const grouped =
        prev &&
        !afterHidden &&
        !msg.replyTo &&
        prev.authorId === msg.authorId &&
        sameDay(prevDate, date) &&
        date - prevDate < GROUP_GAP_MS;
      rows.push(cachedRow(msg, Boolean(grouped), nextCache));
      prev = msg;
    }

    rowCache = nextCache;
    append(
      clear(list),
      rows.map((r) => (r?.blockedIds ? blockedRow(r.blockedIds) : r)),
    );
    if (stick) {
      scroller.scrollTop = scroller.scrollHeight;
      pinned = true;
      jumpBtn.hidden = true;
    }
  }

  function cachedRow(msg, grouped, nextCache) {
    const author = members.get(msg.authorId);
    const photo = author?.photoURL || "";
    const sig = JSON.stringify([
      msg.text,
      msg.editedAt?.toMillis?.() ?? null,
      msg.pending,
      grouped,
      msg.id === editingId,
      canModerate,
      canPin,
      me,
      mentionVersion,
      author?.displayName ?? msg.authorName,
      photo.length,
      photo.slice(-48),
      toDate(msg.createdAt).getTime(),
      msg.replyTo ?? null,
      msg.forwarded ?? null,
      msg.reactions ?? null,
      Boolean(msg.pinned),
      msg.poll ?? null,
      msg.votes ?? null,
      blocked.has(msg.replyTo?.authorId),
      filterRe?.source ?? null,
      canReport,
      author?.role ?? null,
    ]);
    const hit = rowCache.get(msg.id);
    const el = hit && hit.sig === sig ? hit.el : messageRow(msg, grouped);
    nextCache.set(msg.id, { sig, el });
    return el;
  }

  return {
    setContext(next) {
      me = next.uid;
      canModerate = next.canModerate;
      canPin = next.canPin;
      canReport = Boolean(next.canReport);
      members = next.members;
      blocked = next.blocked || new Set();
      filterRe = next.filter || null;
      // next.gate: { text, button, onClick } when you can't post yet.
      const gated = Boolean(next.gate);
      const canSend = next.canSend !== false && !gated;
      input.disabled = !canSend;
      emojiBtn.disabled = !canSend;
      composer.classList.toggle("locked", !canSend);
      gate.hidden = !gated;
      if (gated)
        append(clear(gate), [
          h("span", null, next.gate.text),
          h("button", { class: "btn primary", onclick: next.gate.onClick }, next.gate.button),
        ]);
      updateMentionPatterns(next.meName);
      const changed = next.channel?.id !== channel?.id;
      if (changed) {
        stopTyping();
        renderTyping([]);
      }
      channel = next.channel;
      slowMode = next.slowMode || 0;
      renderSlow();

      el.classList.toggle("no-channel", !channel);
      clear(empty).append(next.emptyMessage || "");
      if (!channel) {
        clear(title);
        clear(list);
        return;
      }
      input.placeholder = gated
        ? ""
        : canSend
          ? `Message ${channel.dm ? "@" : "#"}${channel.name}`
          : next.lockedText || "Only the owner and moderators can post here";
      append(clear(title), [
        icon(channel.dm ? "at" : "hash", 22),
        h("span", { class: "truncate" }, channel.name),
        channel.private &&
          h(
            "span",
            { class: "channel-badge", title: "Only you can see this channel" },
            "private",
          ),
        channel.readOnly &&
          h(
            "span",
            { class: "channel-badge", title: "Only the owner and moderators can post here" },
            "read-only",
          ),
        channel.slowMode > 0 &&
          h(
            "span",
            { class: "channel-badge", title: `Everyone waits ${channel.slowMode}s between messages` },
            "slow mode",
          ),
      ]);

      if (changed) {
        gifs.hide();
        emoji.hide();
        morePanel.hidden = true;
        revealed = new Set();
        closeSuggestions();
        cancelReply();
        editingId = null;
        messages = [];
        hasMore = false;
        anchor = null;
        rowCache = new Map();
        input.value = drafts.get(channel.id) || "";
        autosize(input);
        render(false);
        input.focus();
      } else {
        render(true);
      }
    },
    setMessages(next, more = false) {
      const first = messages.length === 0;
      messages = next;
      hasMore = more;
      render(!first || anchor != null);
      if (anchor != null) {
        // Older messages went in above; keep what was on screen in place.
        scroller.scrollTop = scroller.scrollHeight - anchor;
        if (next.length > olderFrom || !more) anchor = null;
      }
    },
    setTyping: renderTyping,
    jumpTo,
  };
}
