// Server icons and avatars are stored inline in Firestore as small data URLs,
// so they need no Firebase Storage bucket.
import { h } from "./dom.js";

const ICON_SIZE = 128;
// Firestore documents max out at 1 MiB; keep images far below that.
export const MAX_IMAGE_CHARS = 200_000;

// Opens the file chooser. Resolves to the chosen File, or null if cancelled.
export function pickImage() {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept: "image/*" });
    input.addEventListener("change", () => resolve(input.files[0] || null));
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

function encode(canvas) {
  // WebP keeps transparency and is small; browsers that can't encode it fall
  // back to PNG, so try JPEG if that comes out too big.
  let url = canvas.toDataURL("image/webp", 0.85);
  if (!url.startsWith("data:image/webp") && url.length > MAX_IMAGE_CHARS / 2) {
    url = canvas.toDataURL("image/jpeg", 0.85);
  }
  return url;
}

export async function loadImage(file) {
  if (!file.type.startsWith("image/"))
    throw new Error("That file isn't an image.");
  try {
    // Animated GIFs decode to their first frame.
    return await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't read that image.");
  }
}

// Draws the square source region (sx, sy, side) of `bitmap` at icon size.
export function cropToDataURL(bitmap, sx, sy, side, size = ICON_SIZE) {
  const canvas = h("canvas", { width: size, height: size });
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  const url = encode(canvas);
  if (url.length > MAX_IMAGE_CHARS) throw new Error("That image is too large.");
  return url;
}
