#!/usr/bin/env node
// cartwalk: send a Kane shopper to a store, let plain code judge what it saw,
// let a coding agent fix what failed, and keep a log nobody can quietly edit.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { runKane, checkStoreUrl } = require("../lib/kane");
const { SHOPPER_OBJECTIVE } = require("../lib/shopper");
const { evaluate } = require("../lib/rules");
const { proposeFix } = require("../lib/fix");
const log = require("../lib/log");

const USAGE = `cartwalk check  <url>            run one shopper walk and judge it
cartwalk loop   <url> --fix-dir <dir> --serve <file.js>
                                 walk, let the coding agent fix, walk again (default 3 rounds)
cartwalk verify [--log <file>]   check that a log has not been edited
cartwalk report <log> [--out <file.html>]
                                 write a one-page HTML report with an in-browser verifier
cartwalk tamper <log>            edit a COPY of the log (a failed check becomes a pass) and show verify catch it
cartwalk help                    show this text

exit codes for check and loop: 0 pass, 1 fail, 2 inconclusive or could not run

options: --log <file>  --budget <steps, default 20>  --timeout <sec, default 300>
         --steps <max Kane steps, default 30>  --rounds <n, default 3>`;

function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const name = argv[i].slice(2);
      if (name === "help") { opt.help = true; continue; }
      if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) throw new Error(`--${name} needs a value`);
      opt[name] = argv[++i];
    }
    else pos.push(argv[i]);
  }
  return { pos, opt };
}

const ts = () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const MARK = { pass: "PASS", fail: "FAIL", na: "n/a ", unknown: "??? " };

function printVerdict(round, run, v) {
  console.log(`\nround ${round}: ${v.verdict.toUpperCase()}  (${run.stepCount} steps, ${Math.round(run.durationSec || 0)}s, ${run.credits ? run.credits.toFixed(0) : "?"} credits)`);
  for (const c of v.checks) console.log(`  ${MARK[c.status]}  ${c.id}: ${c.detail.split("\n")[0].slice(0, 160)}`);
}

// One walk. A run that ends stuck or errored is retried once and both attempts
// are logged, so a flaky Kane run never gets recorded as a store failure.
async function walk(url, o, logFile, round) {
  log.append(logFile, "walk_start", { round, url, objective: SHOPPER_OBJECTIVE });
  let run;
  for (let attempt = 1; attempt <= 2; attempt++) {
    run = await runKane({ url, objective: SHOPPER_OBJECTIVE, timeoutSec: Number(o.timeout || 300), maxSteps: Number(o.steps || 30) });
    log.append(logFile, "kane_run", { round, attempt, status: run.status, reasonCode: run.reasonCode, summary: run.summary, values: run.values, stepCount: run.stepCount, credits: run.credits, durationSec: run.durationSec, testUrl: run.testUrl });
    if (run.status === "passed" || run.status === "failed") break;
    console.log(`  Kane ended ${run.reasonCode || run.status}; ${attempt === 1 ? "retrying once" : "giving up"}`);
  }
  const verdict = evaluate(run, { stepBudget: Number(o.budget || 20) });
  log.append(logFile, "verdict", { round, verdict: verdict.verdict, checks: verdict.checks });
  printVerdict(round, run, verdict);
  return { run, verdict };
}

async function waitFor(url, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.status < 500) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function startServer(file, url) {
  const port = new URL(url).port || "80";
  const child = spawn(process.execPath, [path.resolve(file)], { env: { ...process.env, PORT: port }, stdio: "ignore" });
  return child;
}

async function check(url, o) {
  checkStoreUrl(url);
  const logFile = o.log || "cartwalk-log.jsonl";
  const { verdict } = await walk(url, o, logFile, 1);
  const v = log.verify(logFile);
  console.log(`\nlog: ${logFile} (${v.count} entries, head ${v.head ? v.head.slice(0, 12) : "broken"})`);
  return verdict.verdict === "pass" ? 0 : verdict.verdict === "fail" ? 1 : 2;
}

async function loop(url, o) {
  if (!o["fix-dir"] || !o.serve) { console.error("loop needs --fix-dir and --serve\n\n" + USAGE); return 2; }
  checkStoreUrl(url);
  if (!fs.existsSync(o["fix-dir"]) || !fs.existsSync(o.serve)) { console.error("--fix-dir and --serve must point to existing paths"); return 2; }
  if (await waitFor(url, 600)) { console.error(`something is already serving ${url}; stop it first so cartwalk can restart the store after each fix`); return 2; }
  const logFile = o.log || path.join("runs", `loop-${ts()}.jsonl`);
  const rounds = Number(o.rounds || 3);
  let server = startServer(o.serve, url);
  const stop = () => { try { server.kill(); } catch { /* already gone */ } };
  process.on("exit", stop);
  if (!(await waitFor(url))) { stop(); console.error("the store did not start"); return 2; }
  let final = "fail";
  try {
    for (let round = 1; round <= rounds; round++) {
      const { run, verdict } = await walk(url, o, logFile, round);
      if (verdict.verdict !== "fail") { final = verdict.verdict; break; }
      if (round === rounds) break;
      console.log(`  asking the coding agent to fix ${verdict.checks.filter((c) => c.status === "fail").length} failed check(s)...`);
      stop();
      const fix = await proposeFix(o["fix-dir"], verdict, run);
      log.append(logFile, "fix_proposed", { round, summary: fix.summary, diffSha256: sha(fix.diff), diff: fix.diff, agentExit: fix.exit });
      console.log("  agent: " + fix.summary.replace(/\s+/g, " ").slice(0, 300));
      if (!fix.diff.trim()) { console.log("  the agent changed nothing; stopping"); break; }
      server = startServer(o.serve, url);
      if (!(await waitFor(url))) { console.error("the store did not restart after the fix"); break; }
    }
  } finally { stop(); }
  log.append(logFile, "final", { verdict: final });
  const v = log.verify(logFile);
  console.log(`\nfinal: ${final.toUpperCase()}`);
  console.log(`log: ${logFile} (${v.count} entries, chain ${v.ok ? "intact" : "BROKEN"}, head ${v.head ? v.head : "n/a"})`);
  return final === "pass" ? 0 : final === "fail" ? 1 : 2;
}

function verifyCmd(o) {
  const file = o.log || "cartwalk-log.jsonl";
  if (!fs.existsSync(file)) { console.error(`no such log: ${file}\nname one with --log <file>`); return 2; }
  const v = log.verify(file);
  if (v.ok) { console.log(`ok: ${v.count} entries, chain intact\nhead: ${v.head}`); return 0; }
  console.log(`BROKEN: ${v.reason}`);
  return 1;
}

function reportCmd(file, o) {
  if (!fs.existsSync(file)) { console.error("no such log: " + file); return 2; }
  const out = o.out || file.replace(/\.jsonl$/, "") + "-report.html";
  fs.writeFileSync(out, require("../lib/report").reportFromFile(file));
  console.log("wrote " + out);
  return 0;
}

// Proves the log is tamper-evident without touching the real one: change a copy, verify it.
function tamperCmd(file) {
  if (!fs.existsSync(file)) { console.error("no such log: " + file); return 2; }
  const entries = log.readEntries(file);
  const target = entries.find((e) => e.kind === "verdict" && e.data.checks.some((c) => c.status === "fail"));
  if (!target) { console.error("this log has no failed check to tamper with"); return 2; }
  const check = target.data.checks.find((c) => c.status === "fail");
  const copy = file.replace(/\.jsonl$/, "") + ".tampered.jsonl";
  console.log(`original: ${log.verify(file).ok ? "chain intact" : "BROKEN"}`);
  console.log(`editing a copy: entry ${target.seq}, check "${check.id}", fail -> pass`);
  check.status = "pass";
  fs.writeFileSync(copy, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  const v = log.verify(copy);
  console.log(`tampered copy (${copy}): ${v.ok ? "chain intact (this should not happen)" : "BROKEN: " + v.reason}`);
  return v.ok ? 1 : 0;
}

(async () => {
  let pos, opt;
  try { ({ pos, opt } = parseArgs(process.argv.slice(2))); } catch (err) { console.error("cartwalk: " + err.message); process.exitCode = 2; return; }
  const cmd = pos[0];
  try {
    if (opt.help || cmd === "help") { console.log(USAGE); process.exitCode = 0; }
    else if (cmd === "check" && pos[1]) process.exitCode = await check(pos[1], opt);
    else if (cmd === "loop" && pos[1]) process.exitCode = await loop(pos[1], opt);
    else if (cmd === "verify") process.exitCode = verifyCmd(opt);
    else if (cmd === "report" && pos[1]) process.exitCode = reportCmd(pos[1], opt);
    else if (cmd === "tamper" && pos[1]) process.exitCode = tamperCmd(pos[1]);
    else { console.log(USAGE); process.exitCode = cmd ? 2 : 0; }
  } catch (err) { console.error("cartwalk: " + err.message); process.exitCode = 2; }
})();
