import { h, toast } from "../dom.js";
import {
  ACCENTS,
  THEMES,
  enableNotifications,
  notificationsSupported,
  notify,
  prefs,
  savePrefs,
  themeById,
} from "../prefs.js";
import { openModal } from "./modal.js";

// Theme, accent colour, sounds and notifications (saved on this device).
export function appearanceModal() {
  openModal({
    title: "Appearance & Notifications",
    subtitle: "These settings are saved on this device.",
    render: () => {
      const choiceRow = (items, key, swatch) => {
        const row = h("div", { class: "choice-row" });
        const draw = () =>
          row.replaceChildren(
            ...items.map((item) =>
              h(
                "button",
                {
                  type: "button",
                  class: `choice small${prefs[key] === item.id ? " active" : ""}`,
                  onclick: () => {
                    savePrefs({ [key]: item.id });
                    draw();
                  },
                },
                swatch(item),
                item.name,
              ),
            ),
          );
        draw();
        row.redraw = draw;
        return row;
      };
      const toggle = (label, hint, checked, onchange) => {
        const box = h("input", { type: "checkbox", checked, onchange: () => onchange(box) });
        return h(
          "label",
          { class: "toggle-row" },
          box,
          h(
            "span",
            null,
            h("span", { class: "strong" }, label),
            h("span", { class: "muted small toggle-hint" }, hint),
          ),
        );
      };
      // Theme cards, each with a tiny picture of the app in its colours.
      const grid = h("div", { class: "theme-grid" });
      const drawThemes = () =>
        grid.replaceChildren(
          ...THEMES.map((t) =>
            h(
              "button",
              {
                type: "button",
                class: `theme-card${prefs.theme === t.id ? " active" : ""}`,
                onclick: () => {
                  savePrefs({ theme: t.id });
                  drawThemes();
                  accents.redraw();
                },
              },
              h(
                "span",
                { class: "theme-preview" },
                h("span", { style: { background: t.rail } }),
                h("span", { style: { background: t.sidebar } }),
                h(
                  "span",
                  { style: { background: t.glow ? `${t.glow}, ${t.chat}` : t.chat } },
                  h("i", { style: { background: t.muted } }),
                  h("i", { class: "short", style: { background: t.accent } }),
                  h("i", { style: { background: t.input } }),
                ),
              ),
              t.name,
            ),
          ),
        );
      drawThemes();
      const accents = choiceRow(ACCENTS, "accent", (a) =>
        h("span", {
          class: "accent-swatch",
          style: { background: a.color || themeById(prefs.theme).accent },
        }),
      );
      return h(
        "div",
        { class: "modal-form" },
        h(
          "div",
          { class: "field" },
          h("span", { class: "field-label" }, "Theme"),
          grid,
        ),
        h(
          "div",
          { class: "field" },
          h("span", { class: "field-label" }, "Accent colour"),
          accents,
          h(
            "span",
            { class: "muted small" },
            "“Theme” uses the theme's own colour. Pick another to mix and match.",
          ),
        ),
        h(
          "div",
          { class: "field" },
          h("span", { class: "field-label" }, "Notifications"),
          toggle(
            "Sounds",
            "A ding when you get a direct message or someone @mentions you.",
            prefs.sounds,
            (box) => {
              savePrefs({ sounds: box.checked });
              if (box.checked) notify("Sipher", "Sounds are on.");
            },
          ),
          toggle(
            "Desktop notifications",
            notificationsSupported()
              ? "A pop-up for DMs and @mentions while Sipher is in the background."
              : "This browser doesn't support desktop notifications.",
            prefs.notifications,
            async (box) => {
              if (!box.checked) return savePrefs({ notifications: false });
              const ok = await enableNotifications();
              box.checked = ok;
              savePrefs({ notifications: ok });
              if (!ok)
                toast("Notifications are blocked. Allow them in your browser's site settings.", "error");
            },
          ),
        ),
      );
    },
  });
}
