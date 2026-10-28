// Turns links in messages into inline GIFs, images and videos. Works with
// GIPHY, Tenor and Imgur page links as well as direct media URLs; none of it
// needs an API key.

const IMAGE_EXT = /\.(gif|png|jpe?g|webp|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

// Returns { kind: "image" | "video", src } for a link, or null.
export function embedFor(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname;

  // GIPHY: giphy.com/gifs/some-title-ID, giphy.com/embed/ID, media*.giphy.com/media/ID/...
  if (host === "giphy.com") {
    const m = path.match(
      /^\/(?:gifs|stickers|embed)\/(?:.*-)?([A-Za-z0-9]+)\/?$/,
    );
    if (m)
      return {
        kind: "image",
        src: `https://media.giphy.com/media/${m[1]}/giphy.gif`,
      };
  }
  if (/^(media\d*|i)\.giphy\.com$/.test(host)) {
    const m = path.match(/^\/media\/(?:v1\.[^/]+\/)?([A-Za-z0-9]+)\//);
    if (m)
      return {
        kind: "image",
        src: `https://media.giphy.com/media/${m[1]}/giphy.gif`,
      };
    if (IMAGE_EXT.test(path)) return { kind: "image", src: url.href };
  }

  // Tenor: adding .gif to a tenor.com/view link redirects to the GIF itself.
  if (host === "tenor.com") {
    const m = path.match(/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?view\/[^/]+-\d+$/);
    if (m) return { kind: "image", src: `https://tenor.com${path}.gif` };
  }
  if (/^(media|c)\.tenor\.com$/.test(host)) {
    if (VIDEO_EXT.test(path)) return { kind: "video", src: url.href };
    return { kind: "image", src: url.href };
  }

  // Imgur: .gifv pages are really MP4s.
  if (host === "i.imgur.com") {
    if (/\.gifv$/i.test(path))
      return { kind: "video", src: url.href.replace(/\.gifv$/i, ".mp4") };
  }

  if (IMAGE_EXT.test(path)) return { kind: "image", src: url.href };
  if (VIDEO_EXT.test(path)) return { kind: "video", src: url.href };
  return null;
}
