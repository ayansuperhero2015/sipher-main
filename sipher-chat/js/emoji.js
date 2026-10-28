// Emoji for the picker and :shortcodes: (typing :fire: sends 🔥).
// Each entry: [emoji, shortcode, extra search words].
import { h } from "./dom.js";

const GROUPS = [
  [
    "Smileys",
    [
      ["😀", "grinning", "happy smile"],
      ["😃", "smiley", "happy"],
      ["😄", "smile", "happy"],
      ["😁", "grin", "teeth"],
      ["😆", "laughing", "lol"],
      ["😅", "sweat_smile", "nervous"],
      ["🤣", "rofl", "lol laugh"],
      ["😂", "joy", "lol laugh cry"],
      ["🙂", "slight_smile", ""],
      ["🙃", "upside_down", ""],
      ["😉", "wink", ""],
      ["😊", "blush", "happy"],
      ["😇", "innocent", "angel halo"],
      ["🥰", "smiling_hearts", "love"],
      ["😍", "heart_eyes", "love"],
      ["🤩", "star_struck", "wow"],
      ["😘", "kissing_heart", "kiss"],
      ["😋", "yum", "tasty"],
      ["😛", "tongue", ""],
      ["😜", "wink_tongue", "crazy"],
      ["🤪", "zany", "crazy goofy"],
      ["🤑", "money_mouth", "rich"],
      ["🤗", "hugging", "hug"],
      ["🤭", "hand_over_mouth", "oops giggle"],
      ["🤫", "shush", "quiet secret"],
      ["🤔", "thinking", "hmm"],
      ["🤐", "zipper_mouth", "secret"],
      ["🤨", "raised_eyebrow", "sus suspicious"],
      ["😐", "neutral", "meh"],
      ["😑", "expressionless", "bruh"],
      ["😶", "no_mouth", "speechless"],
      ["😏", "smirk", ""],
      ["😒", "unamused", "annoyed"],
      ["🙄", "eye_roll", "whatever"],
      ["😬", "grimace", "awkward yikes"],
      ["😌", "relieved", "calm"],
      ["😔", "pensive", "sad"],
      ["😪", "sleepy", "tired"],
      ["😴", "sleeping", "zzz tired"],
      ["😷", "mask", "sick"],
      ["🤒", "sick", "fever ill"],
      ["🤢", "nauseated", "gross sick"],
      ["🤮", "vomit", "gross puke"],
      ["🥵", "hot", "sweat"],
      ["🥶", "cold", "freezing"],
      ["😵", "dizzy_face", "dead"],
      ["🤯", "mind_blown", "exploding head"],
      ["🤠", "cowboy", "yeehaw"],
      ["🥳", "partying", "party celebrate"],
      ["😎", "sunglasses", "cool"],
      ["🤓", "nerd", "smart glasses"],
      ["🧐", "monocle", "fancy"],
      ["😕", "confused", ""],
      ["😟", "worried", ""],
      ["😮", "open_mouth", "wow surprised"],
      ["😲", "astonished", "shocked"],
      ["😳", "flushed", "embarrassed"],
      ["🥺", "pleading", "puppy eyes please"],
      ["😨", "fearful", "scared"],
      ["😰", "anxious", "sweat"],
      ["😢", "cry", "sad tear"],
      ["😭", "sob", "crying sad"],
      ["😱", "scream", "shocked"],
      ["😤", "triumph", "huff angry"],
      ["😡", "rage", "angry mad"],
      ["😠", "angry", "mad"],
      ["🤬", "cursing", "swearing angry"],
      ["😈", "smiling_imp", "devil evil"],
      ["💀", "skull", "dead dying lol"],
      ["☠️", "skull_crossbones", "dead"],
      ["💩", "poop", ""],
      ["🤡", "clown", ""],
      ["👻", "ghost", "boo"],
      ["👽", "alien", "ufo"],
      ["🤖", "robot", "bot"],
      ["😺", "smiley_cat", "cat"],
      ["🙈", "see_no_evil", "monkey"],
      ["🗿", "moai", "stone face"],
    ],
  ],
  [
    "People",
    [
      ["👋", "wave", "hi hello bye"],
      ["👌", "ok_hand", "okay"],
      ["🤌", "pinched", "italian"],
      ["✌️", "v", "peace victory"],
      ["🤞", "crossed_fingers", "luck"],
      ["🤟", "love_you", ""],
      ["🤘", "metal", "rock"],
      ["👈", "point_left", ""],
      ["👉", "point_right", ""],
      ["👆", "point_up", ""],
      ["👇", "point_down", ""],
      ["👍", "thumbsup", "like yes +1"],
      ["👎", "thumbsdown", "dislike no -1"],
      ["✊", "fist", ""],
      ["👊", "punch", "fist bump"],
      ["👏", "clap", "applause"],
      ["🙌", "raised_hands", "hooray"],
      ["🫶", "heart_hands", "love"],
      ["🙏", "pray", "please thanks"],
      ["💪", "muscle", "strong flex"],
      ["🧠", "brain", "smart"],
      ["👀", "eyes", "look"],
      ["👁️", "eye", ""],
      ["🫡", "salute", ""],
      ["🤝", "handshake", "deal"],
      ["💅", "nail_care", "sassy"],
      ["🤷", "shrug", "idk"],
      ["🤦", "facepalm", "ugh"],
      ["🙋", "raising_hand", "me"],
    ],
  ],
  [
    "Hearts",
    [
      ["❤️", "heart", "love red"],
      ["🧡", "orange_heart", ""],
      ["💛", "yellow_heart", ""],
      ["💚", "green_heart", ""],
      ["💙", "blue_heart", ""],
      ["💜", "purple_heart", ""],
      ["🖤", "black_heart", ""],
      ["🤍", "white_heart", ""],
      ["💔", "broken_heart", "sad"],
      ["💕", "two_hearts", "love"],
      ["💖", "sparkling_heart", ""],
      ["💯", "100", "hundred perfect"],
      ["💢", "anger", ""],
      ["💥", "boom", "explosion"],
      ["💫", "dizzy", ""],
      ["💦", "sweat_drops", "water"],
      ["💤", "zzz", "sleep"],
    ],
  ],
  [
    "Things",
    [
      ["🔥", "fire", "lit hot"],
      ["✨", "sparkles", "shiny"],
      ["⭐", "star", ""],
      ["🌟", "glowing_star", ""],
      ["⚡", "zap", "lightning sipher"],
      ["🌈", "rainbow", ""],
      ["☀️", "sunny", "sun"],
      ["🌙", "moon", "night"],
      ["❄️", "snowflake", "cold"],
      ["🎉", "tada", "party celebrate"],
      ["🎊", "confetti", "party"],
      ["🎂", "birthday", "cake"],
      ["🎁", "gift", "present"],
      ["🏆", "trophy", "win"],
      ["🥇", "first_place", "gold medal"],
      ["🎮", "video_game", "gaming controller"],
      ["🎧", "headphones", "music"],
      ["🎵", "music", "note song"],
      ["📚", "books", "study school homework"],
      ["✏️", "pencil", "write"],
      ["📝", "memo", "notes"],
      ["💻", "computer", "laptop"],
      ["📱", "phone", "mobile"],
      ["⏰", "alarm", "clock time"],
      ["💡", "bulb", "idea"],
      ["💰", "moneybag", "money rich"],
      ["🚀", "rocket", "launch"],
      ["⚽", "soccer", "football"],
      ["🏀", "basketball", ""],
      ["🍕", "pizza", "food"],
      ["🍔", "hamburger", "burger food"],
      ["🍟", "fries", "food"],
      ["🌮", "taco", "food"],
      ["🍿", "popcorn", "movie"],
      ["🍩", "doughnut", "donut"],
      ["🍪", "cookie", ""],
      ["☕", "coffee", "tea"],
      ["🧋", "bubble_tea", "boba"],
      ["🐐", "goat", "greatest"],
      ["🐶", "dog", "puppy"],
      ["🐱", "cat", "kitty"],
      ["🐸", "frog", ""],
      ["🦆", "duck", ""],
      ["🦈", "shark", ""],
      ["🌹", "rose", "flower"],
    ],
  ],
  [
    "Symbols",
    [
      ["✅", "white_check_mark", "yes done check"],
      ["❌", "x", "no wrong"],
      ["❓", "question", "?"],
      ["❗", "exclamation", "!"],
      ["⚠️", "warning", "caution"],
      ["🚫", "no_entry", "forbidden"],
      ["🆗", "ok", "okay"],
      ["🆒", "cool", ""],
      ["🆕", "new", ""],
      ["🔴", "red_circle", ""],
      ["🟢", "green_circle", ""],
      ["🔵", "blue_circle", ""],
      ["➡️", "arrow_right", ""],
      ["⬅️", "arrow_left", ""],
      ["⬆️", "arrow_up", ""],
      ["⬇️", "arrow_down", ""],
      ["🔁", "repeat", ""],
      ["📌", "pushpin", "pin"],
      ["🔒", "lock", ""],
      ["🔔", "bell", "notification"],
    ],
  ],
];

const ALL = GROUPS.flatMap(([, list]) => list);
const BY_CODE = new Map(ALL.map(([emoji, code]) => [code, emoji]));
// A few extra names people often type.
for (const [alias, code] of [
  ["+1", "thumbsup"],
  ["-1", "thumbsdown"],
  ["like", "thumbsup"],
  ["lol", "joy"],
  ["heart_eyes_cat", "heart_eyes"],
  ["thinking_face", "thinking"],
  ["crying", "sob"],
  ["dead", "skull"],
  ["lit", "fire"],
  ["party", "tada"],
  ["check", "white_check_mark"],
  ["thumbs_up", "thumbsup"],
  ["thumbs_down", "thumbsdown"],
])
  BY_CODE.set(alias, BY_CODE.get(code));

// Turns :fire: into 🔥 (outside `code`). Unknown codes are left alone.
export function replaceShortcodes(text) {
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(/:([a-z0-9_+-]{1,32}):/gi, (whole, code) =>
            BY_CODE.get(code.toLowerCase()) ?? whole,
          ),
    )
    .join("");
}

// Shortcode suggestions for what's been typed after a colon.
export function searchEmoji(q, max = 8) {
  q = q.toLowerCase();
  const starts = [];
  const contains = [];
  for (const [emoji, code, words] of ALL) {
    if (code.startsWith(q)) starts.push({ emoji, code });
    else if (code.includes(q) || words.includes(q)) contains.push({ emoji, code });
  }
  return [...starts, ...contains].slice(0, max);
}

// A panel of emoji with a search box; `onPick(emoji)` inserts one.
export function createEmojiPicker(onPick) {
  const search = h("input", {
    class: "input emoji-search",
    placeholder: "Find an emoji",
    oninput: () => draw(),
  });
  const grid = h("div", { class: "emoji-grid" });
  const panel = h(
    "div",
    { class: "emoji-panel", hidden: true },
    search,
    grid,
  );

  function button([emoji, code]) {
    return h(
      "button",
      {
        class: "emoji-choice",
        title: `:${code}:`,
        // mousedown, so the message box keeps its cursor position.
        onmousedown: (e) => {
          e.preventDefault();
          onPick(emoji);
        },
      },
      emoji,
    );
  }

  function draw() {
    const q = search.value.trim().toLowerCase();
    grid.replaceChildren();
    if (q) {
      const found = ALL.filter(
        ([, code, words]) => code.includes(q) || words.includes(q),
      );
      for (const e of found) grid.append(button(e));
      if (found.length === 0)
        grid.append(h("p", { class: "muted small pad" }, "No emoji found."));
      return;
    }
    for (const [name, list] of GROUPS) {
      grid.append(h("div", { class: "emoji-group" }, name));
      for (const e of list) grid.append(button(e));
    }
  }

  draw();
  return {
    panel,
    toggle() {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        search.value = "";
        draw();
        search.focus();
      }
    },
    hide() {
      panel.hidden = true;
    },
  };
}
