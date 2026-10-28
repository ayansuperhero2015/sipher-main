// Tiny DOM helpers. Everything is built with createElementNS because the page
// is an SVG document: innerHTML and plain createElement would produce XML
// elements that the browser doesn't render as HTML.
export const XHTML = "http://www.w3.org/1999/xhtml";
const SVG = "http://www.w3.org/2000/svg";

export function h(tag, props, ...children) {
  const el = document.createElementNS(XHTML, tag);
  setProps(el, props);
  append(el, children);
  return el;
}

function setProps(el, props) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "style" && typeof value === "object")
      Object.assign(el.style, value);
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in el && key !== "list") el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

const ICONS = {
  hash: "M10 3 8 21M16 3l-2 18M4 8h17M3 16h17",
  plus: "M12 5v14M5 12h14",
  users:
    "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  chevron: "m6 9 6 6 6-6",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash:
    "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  send: "m22 2-7 20-4-9-9-4zM22 2 11 13",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  compass:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z",
  x: "M18 6 6 18M6 6l12 12",
  menu: "M3 6h18M3 12h18M3 18h18",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  at: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8",
  reply: "M9 17 4 12l5-5M20 18v-2a4 4 0 0 0-4-4H4",
  forward: "m15 17 5-5-5-5M4 18v-2a4 4 0 0 1 4-4h12",
  smile:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
  pin: "M12 17v5M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V17h14v-1.8a2 2 0 0 0-1.1-1.8l-1.8-.9a2 2 0 0 1-1.1-1.8V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  down: "M12 5v14M19 12l-7 7-7-7",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  check: "M20 6 9 17l-5-5",
  chart: "M3 3v18h18M8 17v-5M13 17V8M18 17v-9",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3",
  flag: "M4 22V4a1 1 0 0 1 1-1h13l-3 5 3 5H5",
  palette:
    "M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.4 3.4A1.7 1.7 0 0 1 12 22M7.5 11.5h.01M10.5 7.5h.01M15.5 7.5h.01",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  gamepad:
    "M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-4 3.6L2 15a3 3 0 0 0 5.3 2.3L9 15h6l1.7 2.3A3 3 0 0 0 22 15l-.7-6.4a4 4 0 0 0-4-3.6",
  gif: "M3 5h18v14H3zM9 10H7v4h2v-1.5M12 10v4M15 14v-4h2.5M15 12h2",
  eyeOff:
    "M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7M6.6 6.6A13 13 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2",
  code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
};

export function icon(name, size = 20) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("class", "icon");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", ICONS[name]);
  svg.append(path);
  return svg;
}

// The Sipher mark: a purple lightning bolt.
const LOGO_PATH = "M13 2 3 14h9l-1 8 10-12h-9l1-8z";

export function logo(size = 24) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("class", "logo");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", LOGO_PATH);
  path.setAttribute("fill", "currentColor");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

const COLORS = [
  "#5865f2",
  "#3ba55c",
  "#faa61a",
  "#ed4245",
  "#eb459e",
  "#00a8fc",
  "#9b59b6",
  "#e67e22",
];

export function colorFor(id = "") {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function initials(name = "?") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function avatar(user, size = 40) {
  const name = user?.displayName || "?";
  const el = h("div", {
    class: "avatar",
    style: {
      width: size + "px",
      height: size + "px",
      fontSize: Math.round(size * 0.4) + "px",
      background: colorFor(user?.uid || name),
    },
    title: name,
  });
  if (user?.photoURL) {
    const img = h("img", {
      src: user.photoURL,
      alt: "",
      referrerPolicy: "no-referrer",
    });
    img.addEventListener("error", () => img.replaceWith(initials(name)));
    el.append(img);
  } else {
    el.append(initials(name));
  }
  return el;
}

export function toast(message, kind = "info") {
  const host = document.getElementById("root");
  const el = h("div", { class: `toast toast-${kind}` }, message);
  host.append(el);
  setTimeout(() => el.classList.add("toast-out"), 3200);
  setTimeout(() => el.remove(), 3600);
}
