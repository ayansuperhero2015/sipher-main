import { ABOUT_LIMIT, RULES_LIMIT, WELCOME_LIMIT } from "../api.js";
import { avatar, clear, h, toast } from "../dom.js";
import { loadImage, pickImage } from "../image.js";
import { cropModal } from "./crop.js";
import { openModal } from "./modal.js";

// A preview with Upload / Remove buttons. `preview(image)` draws the current
// image (or the initials fallback when it's null).
function imageField(label, initial, preview) {
  let image = initial || null;
  const box = h("div", { class: "image-preview" });
  const remove = h(
    "button",
    {
      type: "button",
      class: "link-btn danger-text",
      onclick: () => {
        image = null;
        draw();
      },
    },
    "Remove",
  );
  function draw() {
    clear(box).append(preview(image));
    remove.hidden = !image;
  }
  const upload = h(
    "button",
    {
      type: "button",
      class: "btn secondary",
      onclick: async () => {
        const file = await pickImage();
        if (!file) return;
        try {
          const cropped = await cropModal(await loadImage(file), label);
          if (cropped instanceof Error) throw cropped;
          if (!cropped) return;
          image = cropped;
          draw();
        } catch (err) {
          toast(err.message, "error");
        }
      },
    },
    "Upload Image",
  );
  draw();
  return {
    el: h(
      "div",
      { class: "field" },
      h("span", { class: "field-label" }, label),
      h(
        "div",
        { class: "image-field" },
        box,
        h("div", { class: "image-actions" }, upload, remove),
      ),
      h(
        "span",
        { class: "muted small" },
        "You can drag and zoom to choose what shows. GIFs keep their first frame.",
      ),
    ),
    value: () => image,
  };
}

// Name + picture dialog. Resolves to { name, image }, or null if cancelled.
function nameAndImageModal({
  title,
  nameLabel,
  name,
  maxLength,
  imageLabel,
  image,
  preview,
  extra,
  more,
}) {
  return new Promise((resolve) => {
    let result = null;
    openModal({
      title,
      onClose: () => resolve(result),
      render: (close) => {
        const input = h("input", {
          class: "input",
          value: name,
          maxLength,
          required: true,
        });
        const picker = imageField(imageLabel, image, (img) =>
          preview(img, input.value),
        );
        // Optional extra text setting (the GIPHY key on the main server).
        const extraInput =
          extra &&
          h("input", {
            class: "input",
            value: extra.value || "",
            placeholder: extra.placeholder || "",
            maxLength: 64,
            autocomplete: "off",
            spellcheck: false,
          });
        // Further settings: { el, value() } whose value is merged in.
        const moreFields = more?.();
        return h(
          "form",
          {
            class: "modal-form",
            onsubmit: (e) => {
              e.preventDefault();
              const value = input.value.trim();
              if (!value) return;
              result = {
                name: value,
                image: picker.value(),
                extra: extraInput ? extraInput.value.trim() : undefined,
                ...moreFields?.value(),
              };
              close();
            },
          },
          picker.el,
          h(
            "label",
            { class: "field" },
            h("span", { class: "field-label" }, nameLabel),
            input,
          ),
          extra &&
            h(
              "label",
              { class: "field" },
              h("span", { class: "field-label" }, extra.label),
              extraInput,
              h("span", { class: "muted small" }, extra.hint),
            ),
          moreFields?.el,
          h(
            "div",
            { class: "modal-actions" },
            h(
              "button",
              { type: "button", class: "btn ghost", onclick: close },
              "Cancel",
            ),
            h("button", { type: "submit", class: "btn primary" }, "Save"),
          ),
        );
      },
    });
  });
}

// `giphyKey` is only passed for the main server's owner.
export function serverSettingsModal(server, giphyKey) {
  return nameAndImageModal({
    extra: giphyKey !== undefined && {
      label: "GIPHY API key (GIF search)",
      value: giphyKey,
      placeholder: "Paste your key from developers.giphy.com",
      hint: "Stored in your Firebase database, not on GitHub. Every signed-in user's browser uses it to search GIFs.",
    },
    title: "Server Settings",
    nameLabel: "Server name",
    name: server.name,
    maxLength: 50,
    imageLabel: "Server icon",
    image: server.icon,
    preview: (icon, name) =>
      avatar({ uid: server.id, displayName: name, photoURL: icon }, 80),
    more: () => {
      const welcome = textArea(server.welcome, WELCOME_LIMIT, "Hey, welcome! Say hi in #general.");
      const rules = textArea(server.rules, RULES_LIMIT, "1. Be nice\n2. No spam\n3. Keep it school-friendly", 5);
      const filter = h("input", { type: "checkbox", checked: Boolean(server.filter) });
      return {
        el: [
          h(
            "label",
            { class: "field" },
            h("span", { class: "field-label" }, "Welcome message"),
            welcome,
            h("span", { class: "muted small" }, "Shown to people the first time they open the server."),
          ),
          h(
            "label",
            { class: "field" },
            h("span", { class: "field-label" }, "Server rules"),
            rules,
            h(
              "span",
              { class: "muted small" },
              "If you write rules, members must accept them before they can chat. Changing them asks everyone to accept again.",
            ),
          ),
          h(
            "label",
            { class: "toggle-row" },
            filter,
            h(
              "span",
              null,
              h("span", { class: "strong" }, "Hide swear words"),
              h("span", { class: "muted small toggle-hint" }, "Swear words show as ∗∗∗ for everyone in this server."),
            ),
          ),
        ],
        value: () => ({
          welcome: welcome.value.trim(),
          rules: rules.value.trim(),
          filter: filter.checked,
        }),
      };
    },
  });
}

function textArea(value, maxLength, placeholder, rows = 3) {
  return h("textarea", {
    class: "input textarea",
    value: value || "",
    maxLength,
    placeholder,
    rows,
  });
}

export function profileSettingsModal(uid, profile) {
  return nameAndImageModal({
    title: "My Account",
    nameLabel: "Display name",
    name: profile.displayName,
    maxLength: 32,
    imageLabel: "Avatar",
    image: profile.photoURL,
    preview: (photo, name) =>
      avatar({ uid, displayName: name, photoURL: photo }, 80),
    more: () => {
      const about = textArea(profile.about, ABOUT_LIMIT, "A little about you: hobbies, classes, favourite games…");
      return {
        el: h(
          "label",
          { class: "field" },
          h("span", { class: "field-label" }, "About me"),
          about,
          h("span", { class: "muted small" }, "Shows on your profile card when people click your name."),
        ),
        value: () => ({ about: about.value.trim() }),
      };
    },
  });
}
