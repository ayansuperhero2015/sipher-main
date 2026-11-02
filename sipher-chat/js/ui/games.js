import { h, toast } from "../dom.js";
import { openModal } from "./modal.js";

// Games live in games/<id>/ next to index.svg, at the same commit as this
// file. The first one in the list is shown first.
const GAMES = [
  {
    id: "doors",
    title: "Doors",
    art: "DOORS",
    blurb:
      "The Hotel, The Mines, The Backdoor, The Rooms, The Outdoors, The Archives and The Stairwell. Hide, survive, escape.",
  },
];

// jsDelivr serves .html files as plain text, so the page is fetched and
// opened as a blob instead; a <base> tag keeps its relative links working.
// The tab is opened first, inside the click, so pop-up blockers allow it.
async function launch(game) {
  const tab = window.open("", "_blank");
  if (!tab) return toast("Allow pop-ups for this site to play.", "error");
  try {
    const base = new URL(`../../games/${game.id}/`, import.meta.url).href;
    const res = await fetch(base + "index.html");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const page = (await res.text()).replace(
      /<head>/i,
      `<head><base href="${base}">`,
    );
    tab.location = URL.createObjectURL(new Blob([page], { type: "text/html" }));
  } catch (err) {
    console.error(err);
    tab.close();
    toast(`Couldn't start ${game.title}. Try again.`, "error");
  }
}

export function gamesModal() {
  openModal({
    title: "Games",
    render: (close) =>
      h(
        "div",
        { class: "games-list" },
        ...GAMES.map((game) =>
          h(
            "button",
            {
              class: "game-card",
              onclick: () => {
                launch(game);
                close();
              },
            },
            h("div", { class: "game-art" }, game.art),
            h(
              "div",
              { class: "game-body" },
              h("div", { class: "strong" }, game.title),
              h("div", { class: "game-blurb" }, game.blurb),
            ),
          ),
        ),
        h(
          "div",
          { class: "games-soon" },
          h("span", { class: "games-banner-emoji" }, "🎮"),
          h("div", { class: "strong" }, "More games soon!"),
        ),
      ),
  });
}
