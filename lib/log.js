// Hash-chained, append-only log. Every entry carries the hash of the one before
// it, so editing or deleting anything in the middle breaks the chain and
// `verify` says where. Cutting entries off the END cannot be detected from the
// file alone; publish `head` (the latest hash) somewhere outside to cover that.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const GENESIS = "0".repeat(64);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Stable JSON: object keys sorted, so the same data always hashes the same.
function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  return JSON.stringify(v === undefined ? null : v);
}

function readEntries(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function entryHash(e) {
  return sha256(e.prev + canon({ seq: e.seq, ts: e.ts, kind: e.kind, data: e.data }));
}

function append(file, kind, data, ts = new Date().toISOString()) {
  const entries = readEntries(file);
  const last = entries[entries.length - 1];
  const e = { seq: entries.length + 1, ts, kind, data, prev: last ? last.hash : GENESIS };
  e.hash = entryHash(e);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(e) + "\n");
  return e;
}

function verify(file) {
  let entries;
  try { entries = readEntries(file); } catch (err) { return { ok: false, count: 0, reason: "unreadable line: " + err.message }; }
  let prev = GENESIS;
  for (const e of entries) {
    if (e.prev !== prev) return { ok: false, count: entries.length, brokenAt: e.seq, reason: "entry " + e.seq + " does not link to the one before it" };
    if (entryHash(e) !== e.hash) return { ok: false, count: entries.length, brokenAt: e.seq, reason: "entry " + e.seq + " was changed after it was written" };
    prev = e.hash;
  }
  return { ok: true, count: entries.length, head: prev };
}

module.exports = { append, verify, readEntries, canon, GENESIS };
