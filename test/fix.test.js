const test = require("node:test");
const assert = require("node:assert");
const { tidyDiff, buildPrompt } = require("../lib/fix");

const RAW = [
  'diff --git "a/C:\\\\Users\\\\someone/tmp/cw-before-x/server.js" "b/C:\\\\Users\\\\someone\\\\proj\\\\store/server.js"',
  "index 1111111..2222222 100644",
  '--- "a/C:\\\\Users\\\\someone/tmp/cw-before-x/server.js"',
  '+++ "b/C:\\\\Users\\\\someone\\\\proj\\\\store/server.js"',
  "@@ -7 +7 @@",
  "-const T = 7500;",
  "+const T = 5000;",
  "",
].join("\n");

test("tidyDiff keeps the change and drops every local path", () => {
  const out = tidyDiff(RAW);
  assert.match(out, /^file: server\.js\n@@ -7 \+7 @@/);
  assert.match(out, /-const T = 7500;/);
  assert.match(out, /\+const T = 5000;/);
  assert.ok(!/someone|Users|tmp/.test(out));
});

test("tidyDiff of nothing is empty", () => {
  assert.equal(tidyDiff(""), "");
});

test("the agent prompt carries the failed checks and the evidence", () => {
  const p = buildPrompt(
    { checks: [{ id: "shipping_promise", status: "fail", detail: "promises free over $50, charged $4.99" }, { id: "step_budget", status: "pass", detail: "5 steps" }] },
    { evidence: ["evidence: network_failure: POST /api/cart -> 500"] }
  );
  assert.match(p, /shipping_promise: promises free over \$50/);
  assert.match(p, /POST \/api\/cart -> 500/);
  assert.ok(!/step_budget/.test(p));
});
