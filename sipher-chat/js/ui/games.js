import { h } from "../dom.js";
import { openModal } from "./modal.js";

// Games will be playable with people in a chat. None are built yet.
export function gamesModal() {
  openModal({
    title: "Games",
    render: () =>
      h(
        "div",
        { class: "games-soon" },
        h("span", { class: "games-banner-emoji" }, "🎮"),
        h("div", { class: "strong" }, "Coming soon!"),
      ),
  });
}
