// Serve docs/ locally to preview the hosted site: node scripts/serve-docs.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "docs");
const port = Number(process.argv[2] || 4300);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".jsonl": "text/plain", ".md": "text/plain", ".diff": "text/plain" };

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]).split("/").filter((s) => s && s !== "..").join("/");
  if (!rel || req.url.split("?")[0].endsWith("/")) rel = (rel ? rel + "/" : "") + "index.html";
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log("docs on http://localhost:" + port));
