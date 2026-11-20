// Runs one Kane CLI objective and turns its NDJSON stream into a plain object.
// Kane is the eyes: it walks the site and reports what it saw. It does not
// decide anything here; rules.js does.
const { spawn } = require("child_process");

// kane-cli is an npm shim, so on Windows it needs a shell. That means the
// objective is pasted into a command line, so refuse characters a shell would
// treat as syntax instead of trying to escape them.
const UNSAFE = /["&|<>%^`\\\r\n]/;

function parseStream(text) {
  const events = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try { events.push(JSON.parse(t)); } catch { /* not an event line */ }
  }
  return events;
}

// Steps the shopper actually performed: done events with a remark, minus the
// bookkeeping ones (waiting, analysing, asserting).
function countActions(events) {
  return events.filter((e) => e.status === "done" && e.remark && !/^(wait|analyze|assert)\b/i.test(e.remark)).length;
}

function collectValues(end) {
  const values = {};
  const fs = (end && end.final_state) || {};
  for (const [k, v] of Object.entries(fs)) if (k !== "url") values[k] = v;
  const mem = (end && end.context && end.context.memory) || {};
  for (const [k, m] of Object.entries(mem)) if (m && m.extracted_value != null) values[k] = m.extracted_value;
  const vars = (end && end.context && end.context.variables) || {};
  for (const [k, m] of Object.entries(vars)) if (m && m.value != null && values[k] == null) values[k] = m.value;
  return values;
}

function summarise(stdout, exit) {
  const events = parseStream(stdout);
  const end = events.find((e) => e.type === "run_end");
  if (!end) {
    return { exit, status: "errored", reasonCode: "no_run_end", summary: "Kane ended without a result", values: {}, stepCount: countActions(events), credits: 0, durationSec: 0, evidence: [] };
  }
  const summary = String(end.summary || "");
  return {
    exit,
    status: end.status,
    reasonCode: end.reason_code,
    summary,
    values: collectValues(end),
    stepCount: countActions(events),
    credits: end.credits_consumed,
    durationSec: end.duration,
    testUrl: end.test_url,
    evidence: summary.split("\n").filter((l) => l.startsWith("evidence:")),
  };
}

// shell:true on Windows means child.kill() only stops cmd.exe, not Kane under it.
function killTree(child) {
  try {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGKILL");
  } catch { /* already gone */ }
}

// The store address is pasted into the same command line, so it must be a
// plain http(s) address with nothing a shell would read as syntax.
function checkStoreUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error(`"${url}" is not a web address; use something like https://your-store.example`); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error(`"${url}" must start with http:// or https://`);
  if (/[\s"'&|<>%^`\\;$()]/.test(url)) throw new Error("the store address contains a character that is unsafe to pass through a shell");
  return url;
}

function runKane({ url, objective, timeoutSec = 300, maxSteps = 30 }) {
  checkStoreUrl(url);
  if (UNSAFE.test(objective)) throw new Error("objective contains a character that is unsafe to pass through a shell");
  const args = ["run", `"${objective}"`, "--agent", "--headless", "--url", url, "--timeout", String(timeoutSec), "--max-steps", String(maxSteps)];
  return new Promise((resolve, reject) => {
    const child = spawn("kane-cli " + args.join(" "), { shell: true });
    let out = "";
    // Kane's own --timeout is not always honoured while a page request hangs
    // (one run took 645s against a 180s cap), so enforce a hard limit here.
    const hardLimit = setTimeout(() => killTree(child), (timeoutSec + 45) * 1000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", () => {});
    child.on("error", (e) => { clearTimeout(hardLimit); reject(e); });
    child.on("close", (code) => { clearTimeout(hardLimit); resolve(summarise(out, code)); });
  });
}

module.exports = { runKane, checkStoreUrl, summarise, parseStream, countActions, collectValues };
