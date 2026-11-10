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

// Photos in messages. firestore.rules allows up to 750,000 characters.
export const MAX_PHOTO_CHARS = 700_000;
const PHOTO_SIDE = 1600;

function readDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Couldn't read that image."));
    r.readAsDataURL(file);
  });
}

// A photo as a data URL small enough to send: shrunk to at most 1600px and
// re-encoded, stepping the quality and size down until it fits. Small GIFs
// are sent as they are so they keep their animation.
export async function photoToDataURL(file) {
  if (file.type === "image/gif" && file.size * 1.37 < MAX_PHOTO_CHARS) {
    const url = await readDataURL(file);
    if (url.startsWith("data:image/gif;base64,") && url.length <= MAX_PHOTO_CHARS) return url;
  }
  const bitmap = await loadImage(file);
  let side = PHOTO_SIDE;
  for (let attempt = 0; attempt < 6; attempt++) {
    const k = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * k));
    const hgt = Math.max(1, Math.round(bitmap.height * k));
    const canvas = h("canvas", { width: w, height: hgt });
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, hgt);
    for (const q of [0.85, 0.72, 0.6]) {
      let url = canvas.toDataURL("image/webp", q);
      if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", q);
      if (url.length <= MAX_PHOTO_CHARS) return url;
    }
    side = Math.round(side * 0.75);
  }
  throw new Error("That image is too large to send.");
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
