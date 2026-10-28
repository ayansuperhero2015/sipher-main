// Settings that belong to this device rather than the account: theme,
// accent colour, sounds and desktop notifications.

// Each theme recolours the whole app: the base colours here, and
// css/styles.css mixes the in-between shades (hover, borders…) from them.
// rail = server list, sidebar = channel list, chat = messages, input = the
// message box. glow is an optional background behind the messages.
export const THEMES = [
  {
    id: "dark",
    name: "Classic",
    rail: "#1e1f22", sidebar: "#2b2d31", chat: "#313338", input: "#383a40",
    text: "#dbdee1", strong: "#f2f3f5", muted: "#949ba4",
    accent: "#7c3aed", brand: "#a855f7", link: "#00a8fc",
  },
  {
    id: "midnight",
    name: "Midnight",
    rail: "#000000", sidebar: "#0a0a0c", chat: "#000000", input: "#141417",
    text: "#d4d6da", strong: "#ffffff", muted: "#8a8f98",
    accent: "#7c3aed", brand: "#a78bfa", link: "#38bdf8",
  },
  {
    id: "ocean",
    name: "Ocean",
    rail: "#06121f", sidebar: "#0b1d31", chat: "#0f2640", input: "#16314f",
    text: "#d3e3f1", strong: "#f0f8ff", muted: "#7f9bb5",
    accent: "#0ea5a4", brand: "#5eead4", link: "#67e8f9",
    glow: "radial-gradient(900px 500px at 100% 0%, rgba(20, 184, 166, 0.14), transparent 60%), radial-gradient(700px 500px at 0% 100%, rgba(59, 130, 246, 0.12), transparent 60%)",
  },
  {
    id: "forest",
    name: "Forest",
    rail: "#0b140e", sidebar: "#122018", chat: "#16281e", input: "#1e3427",
    text: "#d6e6da", strong: "#f1fbf3", muted: "#86a08e",
    accent: "#16a34a", brand: "#86efac", link: "#7dd3fc",
    glow: "radial-gradient(900px 600px at 100% 100%, rgba(34, 197, 94, 0.12), transparent 60%)",
  },
  {
    id: "sunset",
    name: "Sunset",
    rail: "#170b16", sidebar: "#22101f", chat: "#2a1427", input: "#3a1d35",
    text: "#f3dde6", strong: "#fff4f7", muted: "#b48ea1",
    accent: "#f05a28", brand: "#fb7185", link: "#fdba74",
    glow: "radial-gradient(1000px 500px at 100% 0%, rgba(249, 115, 22, 0.18), transparent 60%), radial-gradient(800px 500px at 0% 100%, rgba(236, 72, 153, 0.16), transparent 60%)",
  },
  {
    id: "neon",
    name: "Neon",
    rail: "#030308", sidebar: "#08081a", chat: "#0b0b1f", input: "#15152e",
    text: "#dcdcff", strong: "#ffffff", muted: "#8b8bb8",
    accent: "#d946ef", brand: "#22d3ee", link: "#22d3ee",
    glow: "radial-gradient(800px 500px at 0% 0%, rgba(217, 70, 239, 0.18), transparent 60%), radial-gradient(800px 500px at 100% 100%, rgba(34, 211, 238, 0.15), transparent 60%)",
  },
  {
    id: "crimson",
    name: "Crimson",
    rail: "#120607", sidebar: "#1c0b0d", chat: "#230e11", input: "#331519",
    text: "#f0d9db", strong: "#fff5f5", muted: "#ab8a8e",
    accent: "#dc2626", brand: "#f87171", link: "#fca5a5",
    glow: "radial-gradient(900px 500px at 50% 0%, rgba(220, 38, 38, 0.14), transparent 60%)",
  },
  {
    id: "coffee",
    name: "Coffee",
    rail: "#17110d", sidebar: "#211812", chat: "#2a1f18", input: "#382a20",
    text: "#ecdcc9", strong: "#fff8ee", muted: "#a8927c",
    accent: "#b7793f", brand: "#e0b084", link: "#f3c48b",
  },
  {
    id: "nord",
    name: "Nord",
    rail: "#242933", sidebar: "#2e3440", chat: "#3b4252", input: "#434c5e",
    text: "#e5e9f0", strong: "#eceff4", muted: "#a3acbd",
    accent: "#5e81ac", brand: "#88c0d0", link: "#88c0d0",
  },
  {
    id: "light",
    name: "Light",
    rail: "#e3e5e8", sidebar: "#f2f3f5", chat: "#ffffff", input: "#ebedef",
    text: "#313338", strong: "#060607", muted: "#5c5e66",
    accent: "#6d28d9", brand: "#7c3aed", link: "#006ce7",
    menu: "#ffffff", light: true,
  },
  {
    id: "candy",
    name: "Candy",
    rail: "#f8cfe0", sidebar: "#fde4ef", chat: "#fff6fa", input: "#fbe1ec",
    text: "#4a2a3b", strong: "#2a0f1e", muted: "#8a5d73",
    accent: "#e11d74", brand: "#db2777", link: "#c026d3",
    menu: "#ffffff", light: true,
    glow: "radial-gradient(800px 500px at 100% 0%, rgba(244, 114, 182, 0.16), transparent 60%), radial-gradient(700px 500px at 0% 100%, rgba(167, 139, 250, 0.14), transparent 60%)",
  },
  {
    id: "lavender",
    name: "Lavender",
    rail: "#ddd4f3", sidebar: "#ebe5fa", chat: "#f8f5ff", input: "#e6def8",
    text: "#2f2549", strong: "#170f2e", muted: "#6c6288",
    accent: "#7c3aed", brand: "#6d28d9", link: "#4f46e5",
    menu: "#ffffff", light: true,
  },
  {
    id: "mint",
    name: "Mint",
    rail: "#cfeee2", sidebar: "#e3f7ef", chat: "#f5fdf9", input: "#dcf3e9",
    text: "#1f3b31", strong: "#0b231a", muted: "#5b7d70",
    accent: "#059669", brand: "#047857", link: "#0e7490",
    menu: "#ffffff", light: true,
  },
];

// "theme" keeps the theme's own colour; the others override it.
export const ACCENTS = [
  { id: "theme", name: "Theme" },
  { id: "purple", name: "Purple", color: "#7c3aed", brand: "#a855f7" },
  { id: "blue", name: "Blue", color: "#2563eb", brand: "#60a5fa" },
  { id: "teal", name: "Teal", color: "#0d9488", brand: "#2dd4bf" },
  { id: "green", name: "Green", color: "#16a34a", brand: "#4ade80" },
  { id: "yellow", name: "Gold", color: "#ca8a04", brand: "#facc15" },
  { id: "orange", name: "Orange", color: "#ea580c", brand: "#fb923c" },
  { id: "red", name: "Red", color: "#dc2626", brand: "#f87171" },
  { id: "pink", name: "Pink", color: "#db2777", brand: "#f472b6" },
];

const DEFAULTS = { theme: "dark", accent: "theme", sounds: true, notifications: false };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("sipher:prefs") || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export const prefs = load();

export function savePrefs(changes) {
  Object.assign(prefs, changes);
  try {
    localStorage.setItem("sipher:prefs", JSON.stringify(prefs));
  } catch {
    // Private mode: the settings still apply until the tab closes.
  }
  applyTheme();
}

export function themeById(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function applyTheme() {
  const root = document.documentElement;
  const t = themeById(prefs.theme);
  const accent = ACCENTS.find((a) => a.id === prefs.accent && a.color);
  const vars = {
    "--bg-rail": t.rail,
    "--bg-sidebar": t.sidebar,
    "--bg-chat": t.chat,
    "--bg-input": t.input,
    "--text": t.text,
    "--text-strong": t.strong,
    "--text-muted": t.muted,
    "--accent": accent?.color || t.accent,
    "--brand": accent?.brand || t.brand,
    "--link": t.link,
    "--chat-glow": t.glow || "none",
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  // Light themes need a light menu (the default mixes in black).
  if (t.menu) root.style.setProperty("--bg-menu", t.menu);
  else root.style.removeProperty("--bg-menu");
  root.setAttribute("data-theme", t.id);
  root.style.colorScheme = t.light ? "light" : "dark";
}

export function notificationsSupported() {
  return typeof Notification !== "undefined";
}

// Asks the browser for permission. Resolves to true if notifications can show.
export async function enableNotifications() {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

let audio = null;

// A short two-note "ding", made on the fly so there's no sound file to load.
function ding() {
  try {
    audio ||= new AudioContext();
    const t = audio.currentTime;
    for (const [freq, start] of [
      [880, 0],
      [1320, 0.09],
    ]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + start);
      gain.gain.exponentialRampToValueAtTime(0.15, t + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.25);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + start);
      osc.stop(t + start + 0.3);
    }
  } catch {
    // Audio can be blocked until the page has been clicked once.
  }
}

// A sound (if on), plus a desktop pop-up when the tab is in the background
// (if allowed). `onClick` runs when the pop-up is clicked.
export function notify(title, body, onClick) {
  if (prefs.sounds) ding();
  if (
    !prefs.notifications ||
    !notificationsSupported() ||
    Notification.permission !== "granted" ||
    document.visibilityState === "visible"
  )
    return;
  try {
    const n = new Notification(title, { body, tag: title });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
}
