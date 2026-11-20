const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { append, verify, readEntries } = require("../lib/log");

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cw-")), "log.jsonl");

test("a fresh chain verifies and reports its head", () => {
  const f = tmp();
  append(f, "a", { n: 1 }); append(f, "b", { n: 2 });
  const v = verify(f);
  assert.equal(v.ok, true); assert.equal(v.count, 2); assert.equal(v.head.length, 64);
});

test("editing an old entry is detected at that entry", () => {
  const f = tmp();
  append(f, "a", { n: 1 }); append(f, "b", { n: 2 }); append(f, "c", { n: 3 });
  const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
  const e = JSON.parse(lines[1]); e.data.n = 99; lines[1] = JSON.stringify(e);
  fs.writeFileSync(f, lines.join("\n") + "\n");
  const v = verify(f);
  assert.equal(v.ok, false); assert.equal(v.brokenAt, 2);
});

test("deleting a middle entry is detected", () => {
  const f = tmp();
  append(f, "a", {}); append(f, "b", {}); append(f, "c", {});
  const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
  fs.writeFileSync(f, [lines[0], lines[2]].join("\n") + "\n");
  const v = verify(f);
  assert.equal(v.ok, false); assert.equal(v.brokenAt, 3);
});

test("key order does not change the hash", () => {
  const a = tmp(), b = tmp();
  const x = append(a, "k", { p: 1, q: 2 }, "t");
  const y = append(b, "k", { q: 2, p: 1 }, "t");
  assert.equal(x.hash, y.hash);
  assert.equal(readEntries(a).length, 1);
});
