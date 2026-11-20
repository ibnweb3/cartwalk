const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { append, readEntries } = require("../lib/log");
const { renderReport } = require("../lib/report");

function sampleLog() {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cw-rep-")), "log.jsonl");
  append(f, "walk_start", { round: 1, url: "http://localhost:4180", objective: "o" });
  append(f, "kane_run", { round: 1, attempt: 1, status: "failed", summary: "evidence: POST /api/cart -> 500 <script>alert(1)</script>", stepCount: 6, durationSec: 150, credits: 30 });
  append(f, "verdict", { round: 1, verdict: "fail", checks: [{ id: "reached_checkout", status: "fail", detail: "cart failed <b>bold</b>" }, { id: "step_budget", status: "pass", detail: "6 steps" }] });
  append(f, "fix_proposed", { round: 1, summary: "Added the lamp.", diff: "file: server.js\n@@ -1 +1 @@\n-old\n+new" });
  append(f, "final", { verdict: "pass" });
  return f;
}

test("the report shows rounds, checks, the fix diff and a verifier", () => {
  const html = renderReport(readEntries(sampleLog()));
  assert.match(html, /Round 1/);
  assert.match(html, /reached_checkout/);
  assert.match(html, /class="add">\+new/);
  assert.match(html, /class="del">-old/);
  assert.match(html, /id="verify"/);
  assert.match(html, /Cartwalk report <span class="tag pass">Pass/);
});

test("text from the log cannot inject markup, in the page or in the embedded data", () => {
  const html = renderReport(readEntries(sampleLog()));
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(!html.includes("<b>bold</b>"));
  const embedded = /<script type="application\/json" id="log-data">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.ok(!embedded.includes("<"));
  assert.doesNotThrow(() => JSON.parse(embedded));
});

test("an empty log still renders", () => {
  assert.match(renderReport([]), /Cartwalk report/);
});

test("the intro block appears only when asked for, and names real commands", () => {
  const entries = readEntries(sampleLog());
  assert.ok(!renderReport(entries).includes("Taste it"));
  const html = renderReport(entries, { intro: { repoUrl: "https://github.com/ibnweb3/cartwalk", logHref: "demo-run/loop.jsonl" } });
  assert.match(html, /Taste it/);
  assert.match(html, /npm run offline/);
  assert.match(html, /npm run taste/);
  assert.match(html, /href="demo-run\/loop\.jsonl"/);
  const scripts = require("../package.json").scripts;
  assert.ok(scripts.offline && scripts.taste, "the commands the page names must exist in package.json");
});
