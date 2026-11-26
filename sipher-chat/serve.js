// Runs Sipher on your own computer for testing: node serve.js
// then open http://localhost:5500 (it uses the real Firebase project).
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 5500;
// Only this computer can reach it, not everyone on the same Wi-Fi.
const HOST = "127.0.0.1";
const ROOT = __dirname + path.sep;
const types = {
  ".svg": "image/svg+xml",
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
};

http
  .createServer((req, res) => {
    let url;
    try {
      url = decodeURIComponent(req.url.split("?")[0]);
    } catch {
      res.writeHead(400);
      return res.end("Bad request");
    }
    if (url === "/") url = "/index.svg";
    const file = path.join(__dirname, path.normalize(url));
    // Stay inside this folder (a plain startsWith(__dirname) would also let
    // through a neighbour like ../sipher-chat-backup), and skip dotfiles.
    const hidden = url.split(/[\\/]/).some((part) => part.startsWith("."));
    if (!file.startsWith(ROOT) || hidden || url.includes("\0")) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.writeHead(200, {
        "Content-Type": (types[path.extname(file)] || "text/plain") + "; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    });
  })
  .listen(PORT, HOST, () => console.log(`Sipher is running at http://localhost:${PORT}`));
