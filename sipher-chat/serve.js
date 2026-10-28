// Runs Sipher on your own computer for testing: node serve.js
// then open http://localhost:5500 (it uses the real Firebase project).
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 5500;
const types = {
  ".svg": "image/svg+xml",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/") url = "/index.svg";
    const file = path.join(__dirname, path.normalize(url));
    if (!file.startsWith(__dirname)) {
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
      });
      res.end(body);
    });
  })
  .listen(PORT, () => console.log(`Sipher is running at http://localhost:${PORT}`));
