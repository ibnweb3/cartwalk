const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const docs = path.join(root, "docs");
execFileSync(process.execPath, [path.join(root, "scripts", "build-site.js")], { cwd: root, stdio: "ignore" });

const index = fs.readFileSync(path.join(docs, "index.html"), "utf8");
const setup = fs.readFileSync(path.join(docs, "setup.html"), "utf8");
const scripts = require("../package.json").scripts;

test("the hosted pages carry no local file paths", () => {
  for (const html of [index, setup]) {
    assert.ok(!/[A-Za-z]:\\Users|\/Users\/|C:\/Users/.test(html), "a local path leaked into the page");
  }
});

test("every npm script the pages tell people to run exists", () => {
  for (const html of [index, setup]) {
    for (const m of html.matchAll(/npm run (\w[\w:-]*)/g)) assert.ok(scripts[m[1]], "npm run " + m[1] + " is named on the site but not in package.json");
  }
});

test("every local link on the pages points at a file that exists", () => {
  for (const html of [index, setup]) {
    for (const m of html.matchAll(/(?:href|src)="([^"#:]+)(?:#[^"]*)?"/g)) {
      const rel = m[1];
      if (/^(https?:|\/\/|mailto:)/.test(rel)) continue;
      assert.ok(fs.existsSync(path.join(docs, rel)), "missing: docs/" + rel);
    }
  }
});

test("the animation data is the recorded log, not typed in", () => {
  const { readEntries, verify } = require("../lib/log");
  const log = path.join(docs, "demo-run", "loop.jsonl");
  assert.equal(verify(log).ok, true);
  const run = JSON.parse(/window\.CARTWALK_RUN=(\{.*?\});<\/script>/s.exec(index)[1].replace(/\\u003c/g, "<"));
  const verdicts = readEntries(log).filter((e) => e.kind === "verdict");
  assert.equal(run.rounds.length, verdicts.length);
  run.rounds.forEach((r, i) => assert.equal(r.verdict, verdicts[i].data.verdict));
  assert.equal(run.entries, readEntries(log).length);
});

test("the intro and replay respect reduced motion and can be skipped", () => {
  const js = fs.readFileSync(path.join(docs, "assets", "site.js"), "utf8");
  assert.match(js, /prefers-reduced-motion/);
  assert.match(js, /Escape/);
  assert.match(index, /<a class="skip" href="#main">/);
});
