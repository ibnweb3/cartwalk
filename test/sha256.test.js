const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { sha256hex } = require("../lib/sha256-fallback");

const ref = (s) => crypto.createHash("sha256").update(s).digest("hex");

test("the in-page SHA-256 matches Node's on edge-case lengths and non-ASCII text", () => {
  const cases = ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(63), "a".repeat(64), "a".repeat(65), "a".repeat(1000), "café ✓ £ $4.99", "{\"k\":[1,2,{\"z\":null}]}"];
  for (const c of cases) assert.equal(sha256hex(c), ref(c), "mismatch for length " + c.length);
});

test("the function survives being embedded as source text", () => {
  const embedded = new Function("return (" + sha256hex.toString() + ")")();
  assert.equal(embedded("cartwalk"), ref("cartwalk"));
});
