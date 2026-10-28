import { append, clear, h, icon } from "../dom.js";
import {
  GifLimitError,
  giphyKey,
  normalizeQuery,
  searchGifs,
} from "../gifs.js";

// Searches cost from a small shared hourly budget, so wait for a pause in
// typing (or Enter) and skip queries too short to be useful.
const SEARCH_DELAY_MS = 800;
const MIN_QUERY = 2;

// The GIF search popover above the composer. `onPick(url)` sends a GIF.
export function createGifPicker(onPick) {
  let open = false;
  let timer = null;
  let latest = 0; // only the newest request may update the panel
  let shown = null; // normalized query currently on screen

  const search = h("input", {
    class: "input gif-search",
    placeholder: "Search GIPHY",
    "aria-label": "Search GIFs",
    oninput: () => {
      clearTimeout(timer);
      timer = setTimeout(load, SEARCH_DELAY_MS);
    },
    onkeydown: (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(timer);
        load();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        hide();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        grid.querySelector("button")?.focus();
      }
    },
  });
  const grid = h("div", { class: "gif-grid" });
  const status = h("div", { class: "gif-status muted" });
  const panel = h(
    "div",
    { class: "gif-panel", hidden: true, role: "dialog", "aria-label": "GIFs" },
    h(
      "div",
      { class: "gif-head" },
      search,
      h(
        "button",
        { class: "icon-btn", title: "Close", onclick: () => hide() },
        icon("x", 18),
      ),
    ),
    status,
    grid,
    h("div", { class: "gif-attribution" }, "Powered by GIPHY"),
  );
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      hide();
    }
  });

  function setStatus(text) {
    status.textContent = text;
    status.hidden = !text;
  }

  async function load() {
    let query = normalizeQuery(search.value);
    if (query.length < MIN_QUERY) query = ""; // show trending instead
    if (query === shown) return;
    // Superseded requests aren't cancelled: their call is already paid for,
    // and finishing lets the results land in the shared cache.
    const request = ++latest;
    setStatus("Loading…");
    try {
      const { gifs, stale } = await searchGifs(query);
      if (request !== latest) return;
      shown = query;
      setStatus(
        stale
          ? "GIF search is at its hourly limit, so these results may be a little old."
          : gifs.length
            ? ""
            : `No GIFs found for “${query}”.`,
      );
      append(
        clear(grid),
        gifs.map((gif) =>
          h(
            "button",
            {
              class: "gif-item",
              title: gif.title,
              onclick: () => {
                hide();
                onPick(gif.url);
              },
            },
            h("img", {
              src: gif.preview,
              alt: gif.title,
              loading: "lazy",
              width: gif.width,
              height: gif.height,
              referrerPolicy: "no-referrer",
            }),
          ),
        ),
      );
    } catch (err) {
      if (request !== latest) return;
      clear(grid);
      shown = null;
      setStatus(
        err instanceof GifLimitError
          ? err.message
          : "Couldn't load GIFs. Check your connection and try again.",
      );
    }
  }

  function onOutside(e) {
    if (!panel.contains(e.target) && !button.contains(e.target)) hide();
  }

  async function show() {
    open = true;
    panel.hidden = false;
    button.classList.add("active");
    document.addEventListener("mousedown", onOutside, true);
    const ready = Boolean(await giphyKey());
    if (!open) return;
    search.hidden = !ready;
    if (!ready) {
      clear(grid);
      shown = null;
      setStatus(
        "GIF search isn't set up yet. The main server's owner can add a GIPHY " +
          "key in Server Settings. You can still paste GIPHY, Tenor or Imgur links.",
      );
      return;
    }
    search.focus();
    load();
  }

  function hide() {
    if (!open) return;
    open = false;
    panel.hidden = true;
    button.classList.remove("active");
    document.removeEventListener("mousedown", onOutside, true);
  }

  const button = h(
    "button",
    {
      class: "icon-btn gif-btn",
      title: "GIFs",
      "aria-label": "Search GIFs",
      onclick: () => (open ? hide() : show()),
    },
    "GIF",
  );

  return { button, panel, hide };
}
