import { h, toast } from "../dom.js";
import { openModal } from "./modal.js";

// Games live in games/<id>/ next to index.svg, at the same commit as this
// file. The first one in the list is shown first. `party` games can be
// played together (they load js/party.js when opened with a party).
const GAMES = [
  {
    id: "doors",
    title: "Doors",
    art: "DOORS",
    party: true,
    blurb:
      "The Hotel, The Mines, The Backdoor, The Rooms, The Outdoors, The Archives and The Stairwell. Hide, survive, escape.",
  },
  {
    id: "bedraid",
    title: "Bed Raid",
    art: "BED RAID",
    party: true,
    blurb:
      "Four teams on floating islands. Farm generators, shop, bridge across, break enemy beds and be the last team standing. Play friends, or bots solo.",
  },
  {
    id: "boomtag",
    title: "Boom Tag",
    art: "BOOM TAG",
    party: true,
    blurb:
      "Pass the bomb before it blows. Five arenas, eight abilities to unlock, power-ups, round modifiers, hats and bots.",
  },
  {
    id: "forknife",
    title: "Forknife",
    art: "FORKNIFE",
    party: true,
    blurb:
      "1v1 build fights. Build walls, floors, ramps and cones, edit them into windows and doors. Ten weapons and five modes. Fight a friend, or a bot solo.",
  },
  {
    id: "splitdoor",
    title: "Split Door X",
    art: "SPLIT DOOR X",
    party: true,
    blurb:
      "Portal arena shooter. Shoot doors onto hex walls and walk, shoot and throw through them. Slayer, FFA, Doorstop, Skeleton Key and Lockpick, with friends on your team and bots filling in.",
  },
  {
    // Hosted elsewhere: the tab goes straight to `url`, which must be served
    // as text/html (rawcdn.githack.com does this for GitHub files; jsDelivr
    // doesn't). Opening it at its real address keeps its own loading working.
    id: "geometrydash",
    title: "Geometry Dash",
    art: "GEOMETRY DASH",
    url: "https://rawcdn.githack.com/freebuisness/html/63c1608976000f23e4466c6d3b58f283149eeff5/868-F3.html",
    blurb: "Jump and fly your way through danger in this rhythm-based action platformer.",
  },
];
const byId = (id) => GAMES.find((g) => g.id === id);

// jsDelivr serves .html files as plain text, so the page is fetched and
// opened as a blob instead; a <base> tag keeps its relative links working.
// The tab is opened first, inside the click, so pop-up blockers allow it.
// `getParty` (optional) resolves to { id, name } to play in a party.
export async function launchGame(gameId, getParty) {
  const game = byId(gameId);
  if (!game) return toast("That game isn't available.", "error");
  const tab = window.open("", "_blank");
  if (!tab) return toast("Allow pop-ups for this site to play.", "error");
  if (game.url) {
    tab.opener = null;
    tab.location = game.url;
    return;
  }
  try {
    const party = getParty ? await getParty() : null;
    const base = new URL(`../../games/${game.id}/`, import.meta.url).href;
    const res = await fetch(base + "index.html");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const setup =
      `<base href="${base}">` +
      (party
        ? `<script>window.SIPHER_PARTY = ${JSON.stringify(party).replace(/</g, "\\u003c")};</script>`
        : "");
    const page = (await res.text()).replace(/<head>/i, `<head>${setup}`);
    tab.location = URL.createObjectURL(new Blob([page], { type: "text/html" }));
  } catch (err) {
    console.error(err);
    tab.close();
    toast(`Couldn't start ${game.title}. Try again.`, "error");
  }
}

// Party invites are ordinary messages ending in this token, so they need
// no new message fields; the chat shows them as a card with a Join button.
const PARTY_RE = /\n?sipher:party\/([a-z0-9]+)\/([A-Za-z0-9_-]{10,40})\s*$/;

export function partyInvite(name, gameId, partyId) {
  const game = byId(gameId);
  return `🎮 ${name} started a ${game.title} party! Join to play together.\nsipher:party/${gameId}/${partyId}`;
}

// { game, id, text } for an invite message, or null.
export function partyIn(text) {
  const m = PARTY_RE.exec(text || "");
  if (!m || !byId(m[1])) return null;
  return { game: m[1], id: m[2], text: text.slice(0, m.index).trim() };
}

export function partyCard(invite, onJoin) {
  const game = byId(invite.game);
  return h(
    "div",
    { class: "party-invite" },
    h("div", { class: "game-art small" }, game.art),
    h(
      "div",
      { class: "party-invite-body" },
      h("div", { class: "game-blurb" }, invite.text),
      h(
        "button",
        { class: "btn primary small", onclick: () => onJoin(invite) },
        "Join party",
      ),
    ),
  );
}

// `startParty(gameId)` (optional) makes a party, posts the invite and
// resolves to { id, name }; without it only solo play is offered.
export function gamesModal({ startParty } = {}) {
  openModal({
    title: "Games",
    render: (close) =>
      h(
        "div",
        { class: "games-list" },
        ...GAMES.map((game) =>
          h(
            "div",
            { class: "game-card" },
            h("div", { class: `game-art game-art-${game.id}` }, game.art),
            h(
              "div",
              { class: "game-body" },
              h("div", { class: "strong" }, game.title),
              h("div", { class: "game-blurb" }, game.blurb),
              h(
                "div",
                { class: "game-actions" },
                startParty &&
                  game.party &&
                  h(
                    "button",
                    {
                      class: "btn primary small",
                      onclick: () => {
                        launchGame(game.id, () => startParty(game.id));
                        close();
                      },
                    },
                    "Play with friends",
                  ),
                h(
                  "button",
                  {
                    class: `btn ${startParty && game.party ? "ghost" : "primary"} small`,
                    onclick: () => {
                      launchGame(game.id);
                      close();
                    },
                  },
                  game.party ? "Play solo" : "Play",
                ),
              ),
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
