// The optional swear-word filter. When a server owner switches it on in
// Server Settings, these words show as ∗∗∗ for everyone in that server
// (messages aren't changed).

// Matched as the start of a word ("fuck" also catches "fucking").
const STEMS = [
  "fuck", "fuk", "fck", "shit", "bitch", "bastard", "asshole", "pussy",
  "cunt", "whore", "slut", "motherf", "bullshit", "dumbass",
  "jackass", "wank", "twat", "retard", "nigg", "fag", "piss",
];
// Matched only as whole words, since they're inside normal words
// ("class", "hello", "cocktail").
const WORDS = [
  "ass", "asses", "hell", "damn", "crap", "cock", "cocks", "dick", "dicks",
  "dickhead", "tits", "boob", "boobs", "stfu", "wtf", "kys",
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FILTER_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[
    ...STEMS.map((s) => `${escapeRe(s)}[\\p{L}]*`),
    ...WORDS.map(escapeRe),
  ].join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);

// The pattern to hide, or null when the server has the filter off.
export function filterFor(server) {
  return server?.filter ? FILTER_RE : null;
}

// Uses "∗" rather than "*", which the message formatting would read as bold.
export function censor(text, re) {
  if (!re) return text;
  return text.replace(re, (word) => "∗".repeat(Math.min(word.length, 8)));
}
