// GIF search, powered by GIPHY. The API key isn't in the code: the owner of
// the main server saves it in Server Settings, and it's read from Firestore
// (config/giphy). Until then the GIF button explains that search isn't set up.
//
// The free key allows 100 calls an hour *in total*, shared by every visitor,
// so a call is the last resort:
//   1. results already loaded in this tab
//   2. results anyone has fetched recently, shared through Firestore
//   3. a live GIPHY call, if this hour's shared budget and this browser's
//      own allowance both have room
//   4. otherwise, older cached results (or a "try later" message)
import {
  getGiphyKey,
  readGifCache,
  reserveGifCall,
  writeGifCache,
} from "./api.js";

const API = "https://api.giphy.com/v1/gifs";
const RATING = "pg-13";
// One call fetches this many, so nobody needs a second page.
const RESULTS_PER_CALL = 50;
// Stay a little under GIPHY's 100/hour so an occasional race can't hit it.
const HOURLY_BUDGET = 90;
// No single browser may use more than this share of the hour's budget.
const PER_BROWSER_HOURLY = 15;
// Trending changes; search results for a word barely do.
const TRENDING_FRESH_MS = 2 * 60 * 60 * 1000;
const SEARCH_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_QUERY = 50;

let keyPromise = null;

// Resolves to the GIPHY key, or "" if none has been set up.
export function giphyKey() {
  keyPromise ??= getGiphyKey().catch(() => {
    keyPromise = null;
    return "";
  });
  return keyPromise;
}

// Call after the key changes in Server Settings.
export function forgetGiphyKey() {
  keyPromise = null;
}

export class GifLimitError extends Error {
  constructor() {
    super(
      "GIF search has hit its hourly limit. Try again in a bit, or paste a GIF link.",
    );
  }
}

const memory = new Map();

// "  Cat  DANCE " and "cat dance" share one cache entry.
export function normalizeQuery(query) {
  return query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_QUERY);
}

function cacheKey(q) {
  return q ? "q_" + encodeURIComponent(q) : "trending";
}

function isFresh(entry, q) {
  const fetched = entry.fetchedAt?.toMillis?.() ?? 0;
  return Date.now() - fetched < (q ? SEARCH_FRESH_MS : TRENDING_FRESH_MS);
}

// Cached entries store just ids and sizes; URLs are rebuilt here, and ids are
// checked so a tampered cache entry can't point anywhere but GIPHY.
function toGifs(results) {
  return (results || [])
    .filter((r) => /^[A-Za-z0-9]+$/.test(r.id))
    .map((r) => ({
      id: r.id,
      title: r.t || "GIF",
      width: r.w,
      height: r.h,
      preview: `https://media.giphy.com/media/${r.id}/200w.webp`,
      url: `https://media.giphy.com/media/${r.id}/giphy.gif`,
    }));
}

// Per-browser allowance, so one person can't use up everyone's searches.
function takeLocalAllowance() {
  const hour = Math.floor(Date.now() / 3_600_000);
  let state = { hour, count: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem("sipher:gifCalls"));
    if (saved?.hour === hour) state = saved;
  } catch {
    // No storage: rely on the shared budget alone.
  }
  if (state.count >= PER_BROWSER_HOURLY) return false;
  state.count += 1;
  try {
    localStorage.setItem("sipher:gifCalls", JSON.stringify(state));
  } catch {
    // Ignore.
  }
  return true;
}

async function fetchFromGiphy(q) {
  const params = new URLSearchParams({
    api_key: await giphyKey(),
    limit: String(RESULTS_PER_CALL),
    rating: RATING,
    bundle: "messaging_non_clips",
  });
  if (q) params.set("q", q);
  const res = await fetch(`${API}/${q ? "search" : "trending"}?${params}`);
  if (res.status === 429) throw new GifLimitError();
  if (!res.ok) throw new Error(`GIF search failed (${res.status}).`);
  const { data } = await res.json();
  return data.map((gif) => ({
    id: gif.id,
    t: (gif.title || "").slice(0, 80),
    w: Number(gif.images.fixed_width.width),
    h: Number(gif.images.fixed_width.height),
  }));
}

// Resolves to { gifs, stale }. `stale` means older cached results were used
// because the hourly limit was reached. Throws GifLimitError if there's
// nothing cached to fall back on.
export async function searchGifs(query) {
  const q = normalizeQuery(query);
  const key = cacheKey(q);
  if (memory.has(key)) return { gifs: memory.get(key), stale: false };

  const cached = await readGifCache(key).catch(() => null);
  if (cached && isFresh(cached, q)) {
    const gifs = toGifs(cached.results);
    memory.set(key, gifs);
    return { gifs, stale: false };
  }

  const fallback = () => {
    if (cached) return { gifs: toGifs(cached.results), stale: true };
    throw new GifLimitError();
  };

  if (!takeLocalAllowance()) return fallback();
  // If the counter can't be reached, still allow the call; GIPHY's own 429
  // is the backstop.
  const allowed = await reserveGifCall(HOURLY_BUDGET).catch(() => true);
  if (!allowed) return fallback();

  let results;
  try {
    results = await fetchFromGiphy(q);
  } catch (err) {
    if (err instanceof GifLimitError) return fallback();
    throw err;
  }
  writeGifCache(key, q, results).catch(() => {});
  const gifs = toGifs(results);
  memory.set(key, gifs);
  return { gifs, stale: false };
}
