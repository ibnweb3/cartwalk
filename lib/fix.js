// The coding agent's turn. It gets the failed checks and Kane's evidence, edits
// only the store's own folder, and its edit is recorded as a diff. It proposes;
// the next Kane run and rules.js decide whether the proposal worked.
const { spawn, execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

function buildPrompt(verdict, run) {
  const problems = verdict.checks.filter((c) => c.status === "fail").map((c) => "- " + c.id + ": " + c.detail);
  const evidence = run.evidence && run.evidence.length ? run.evidence.join("\n") : "(none)";
  return [
    "You are fixing a small web store whose source is in the current directory.",
    "An automated shopper (an AI agent trying to buy one item) tested the store and these checks failed:",
    ...problems,
    "",
    "Evidence from the shopper's run:",
    evidence,
    "",
    "Rules:",
    "- Edit only files in the current directory.",
    "- Make the smallest change that fixes the failed checks. Do not add features or restyle anything.",
    "- If a check compares a promise on the page with what the code does, make them agree.",
    "- When you are done, reply with two sentences: what you changed and why.",
  ].join("\n");
}

// Diff of this round only: copy the folder before the agent runs, compare after.
function snapshot(dir) {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "cw-before-"));
  fs.cpSync(path.resolve(dir), copy, { recursive: true });
  return copy;
}

function diffAgainst(copy, dir) {
  try {
    execFileSync("git", ["diff", "--no-index", "--no-color", copy, path.resolve(dir)], { encoding: "utf8" });
    return "";
  } catch (err) {
    // git exits 1 when the folders differ; the diff is on stdout.
    return err.stdout ? String(err.stdout) : "";
  }
}

// Keep only what changed: a file name and its hunks. Drops the temp-folder and
// home-directory paths git puts in the headers, so the log is safe to publish.
function tidyDiff(raw) {
  return raw.split(/^diff --git .*$/m).slice(1).map((chunk) => {
    const plus = /^\+\+\+ "?(.*?)"?$/m.exec(chunk);
    const name = plus ? plus[1].split(/[\\/]/).pop() : "file";
    const at = chunk.indexOf("@@");
    return "file: " + name + "\n" + (at >= 0 ? chunk.slice(at) : "");
  }).join("\n");
}

function runAgent(dir, prompt, timeoutMs = 240000) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude -p --permission-mode acceptEdits --allowedTools Read,Edit,Glob,Grep", { cwd: path.resolve(dir), shell: true });
    let out = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("coding agent timed out")); }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, text: out.trim() }); });
    child.stdin.end(prompt);
  });
}

// Returns { summary, diff }. An empty diff means the agent changed nothing.
async function proposeFix(dir, verdict, run) {
  const copy = snapshot(dir);
  const result = await runAgent(dir, buildPrompt(verdict, run));
  const diff = tidyDiff(diffAgainst(copy, dir));
  fs.rmSync(copy, { recursive: true, force: true });
  return { summary: result.text, diff, exit: result.code };
}

module.exports = { proposeFix, buildPrompt, tidyDiff };
