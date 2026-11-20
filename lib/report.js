// Turns a Cartwalk log into one self-contained HTML page: the rounds, the checks,
// the coding agent's diffs, and a verifier that re-computes the hash chain in
// the browser. No server, no build step; open the file.
const { verify } = require("./log");
const { sha256hex } = require("./sha256-fallback");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LABEL = { pass: "Pass", fail: "Fail", na: "Not triggered", unknown: "Unknown", inconclusive: "Inconclusive" };

function groupRounds(entries) {
  const rounds = new Map();
  const get = (n) => { if (!rounds.has(n)) rounds.set(n, { n, url: "", runs: [], verdict: null, fix: null }); return rounds.get(n); };
  let final = null;
  for (const e of entries) {
    const d = e.data || {};
    if (e.kind === "walk_start") { get(d.round).url = d.url; }
    else if (e.kind === "kane_run") get(d.round).runs.push(d);
    else if (e.kind === "verdict") get(d.round).verdict = d;
    else if (e.kind === "fix_proposed") get(d.round).fix = d;
    else if (e.kind === "final") final = d.verdict;
  }
  return { rounds: [...rounds.values()].sort((a, b) => a.n - b.n), final };
}

function diffHtml(diff) {
  return diff.split("\n").map((l) => {
    const cls = l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : l.startsWith("@@") ? "hunk" : l.startsWith("file:") ? "file" : "";
    return `<span class="${cls}">${esc(l)}</span>`;
  }).join("\n");
}

function roundHtml(r) {
  const v = r.verdict;
  const last = r.runs[r.runs.length - 1] || {};
  const checks = v ? v.checks.map((c) => `<tr><td><span class="tag ${esc(c.status)}">${esc(LABEL[c.status] || c.status)}</span></td><th scope="row">${esc(c.id)}</th><td>${esc(String(c.detail).split("\n")[0])}</td></tr>`).join("") : "";
  const meta = [
    last.stepCount != null ? `${last.stepCount} steps` : "",
    last.durationSec ? `${Math.round(last.durationSec)} s` : "",
    last.credits ? `${Math.round(last.credits)} Kane credits` : "",
    r.runs.length > 1 ? `${r.runs.length} attempts` : "",
  ].filter(Boolean).join(" · ");
  return `<section class="round" aria-labelledby="r${r.n}">
  <h2 id="r${r.n}">Round ${r.n} <span class="tag ${v ? esc(v.verdict) : "unknown"}">${esc(LABEL[v ? v.verdict : "unknown"])}</span></h2>
  <p class="meta">${esc(meta)}</p>
  ${v ? `<table><thead><tr><th>Result</th><th>Check</th><th>What was found</th></tr></thead><tbody>${checks}</tbody></table>` : ""}
  ${last.summary && v && v.verdict === "fail" ? `<details><summary>What Kane reported</summary><p class="kane">${esc(last.summary).replace(/\n/g, "<br>")}</p></details>` : ""}
  ${r.fix ? `<div class="fix"><h3>The coding agent's fix</h3><p>${esc(r.fix.summary)}</p><pre class="diff" tabindex="0">${diffHtml(r.fix.diff || "")}</pre></div>` : ""}
</section>`;
}

const { BASE: STYLE } = require("./theme");

// Same canonical JSON and hash as lib/log.js, so the page can check the chain itself.
const CLIENT = `
(function () {
  var GENESIS = new Array(65).join("0");
  var original = JSON.parse(document.getElementById("log-data").textContent);
  function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort().map(function (k) { return JSON.stringify(k) + ":" + canon(v[k]); }).join(",") + "}";
    }
    return JSON.stringify(v === undefined ? null : v);
  }
  function sha256(s) {
    if (window.crypto && window.crypto.subtle) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
      });
    }
    return Promise.resolve(sha256hex(s));
  }
  async function check(entries) {
    var prev = GENESIS;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.prev !== prev) return { ok: false, at: e.seq, why: "does not link to the entry before it" };
      var h = await sha256(e.prev + canon({ seq: e.seq, ts: e.ts, kind: e.kind, data: e.data }));
      if (h !== e.hash) return { ok: false, at: e.seq, why: "was changed after it was written" };
      prev = e.hash;
    }
    return { ok: true, count: entries.length, head: prev };
  }
  var out = document.getElementById("result");
  function show(r, note) {
    out.className = r.ok ? "good" : "bad";
    out.textContent = r.ok
      ? (note || "") + "Chain intact: " + r.count + " entries, head " + r.head.slice(0, 16) + "..."
      : (note || "") + "Chain BROKEN at entry " + r.at + ": it " + r.why + ".";
  }
  document.getElementById("verify").addEventListener("click", async function () { show(await check(original)); });
  document.getElementById("tamper").addEventListener("click", async function () {
    var copy = JSON.parse(JSON.stringify(original));
    var target = copy.find(function (e) { return e.kind === "verdict"; }) || copy[1];
    var c = target.data.checks.find(function (x) { return x.status === "fail"; });
    if (c) { c.status = "pass"; c.detail = "(quietly changed)"; } else { target.data.verdict = "pass"; }
    show(await check(copy), "Changed one failed check to a pass in entry " + target.seq + ". ");
  });
})();
`;

// Optional "taste it" block for the hosted copy of the report. Every command
// named here exists in package.json; the links are relative so the page works
// from any folder it is hosted in.
function introHtml(intro) {
  const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
  return `<section class="round intro" aria-labelledby="intro-h">
  <h2 id="intro-h">Can an AI agent buy from your store?</h2>
  <p>Cartwalk sends a Kane CLI shopper through a store to checkout, lets plain code judge what it saw, lets a coding agent fix what failed, and keeps a log nobody can quietly edit. Below is one real run on a small shop with two planted mistakes.</p>
  <h3>Taste it</h3>
  <ol>
    <li><strong>Here, now.</strong> Scroll to the log at the bottom and press <em>Change one result, then verify</em>.</li>
    <li><strong>No Kane needed.</strong> Clone the repo and run <code>npm run offline</code>: it verifies the recorded log, tampers with a copy, and builds this report.</li>
    <li><strong>With Kane.</strong> Run <code>npm run taste</code>: it starts the broken shop, sends a real shopper, and shows the failure it finds (usually 3 to 7 minutes).</li>
  </ol>
  <p>${intro.repoUrl ? link(intro.repoUrl, "Source and README") : ""}${intro.logHref ? " · " + link(intro.logHref, "The raw log of this run") : ""}</p>
</section>`;
}

// The pieces of a report, so the hosted site can place them inside its own page
// while the standalone report puts them in a bare one.
function runParts(entries, opts = {}) {
  const { rounds, final } = groupRounds(entries);
  const url = (rounds[0] && rounds[0].url) || "";
  const v = opts.verification || { ok: true, count: entries.length, head: entries.length ? entries[entries.length - 1].hash : "" };
  const credits = entries.filter((e) => e.kind === "kane_run").reduce((n, e) => n + (e.data.credits || 0), 0);
  const verdict = final || (rounds.length && rounds[rounds.length - 1].verdict ? rounds[rounds.length - 1].verdict.verdict : "unknown");
  const data = JSON.stringify(entries).replace(/</g, "\\u003c");
  const roundsHtml = rounds.map(roundHtml).join("\n");
  const chainHtml = `<section class="chain" aria-labelledby="chain-h">
  <h2 id="chain-h">The log</h2>
  <p>Every walk, verdict and fix is an entry that carries the hash of the one before it. Editing or deleting anything in the middle breaks the chain. ${esc(String(v.count))} entries; the command-line check says: <strong>${v.ok ? "intact" : "broken"}</strong>.</p>
  <p class="hash">head ${esc(v.head || "")}</p>
  <div class="row"><button id="verify" type="button">Verify in this browser</button><button id="tamper" type="button" class="plain">Change one result, then verify</button></div>
  <p id="result" role="status" aria-live="polite"></p>
  <p class="meta">Entries cut off the end cannot be detected from the file alone. Publish the head hash elsewhere to cover that.</p>
</section>`;
  const scripts = `<script type="application/json" id="log-data">${data}</script>
<script>${sha256hex.toString()}${CLIENT}</script>`;
  return { rounds, verdict, url, credits, roundsHtml, chainHtml, scripts };
}

function renderReport(entries, opts = {}) {
  const p = runParts(entries, opts);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cartwalk report</title><link rel="icon" href="data:,"><style>${STYLE}</style></head>
<body><main>
<h1>Cartwalk report <span class="tag ${esc(p.verdict)}">${esc(LABEL[p.verdict] || p.verdict)}</span></h1>
<p class="lede">An AI shopper walked <strong>${esc(p.url)}</strong> to checkout. Plain code judged what it saw. ${p.rounds.length} round${p.rounds.length === 1 ? "" : "s"}, about ${Math.round(p.credits)} Kane credits.</p>
${opts.intro ? introHtml(opts.intro) : ""}
${p.roundsHtml}
${p.chainHtml}
<footer>Generated by Cartwalk from the log below. Nothing on this page is typed in by hand.</footer>
</main>
${p.scripts}
</body></html>`;
}

function reportFromFile(file, extra = {}) {
  const { readEntries } = require("./log");
  return renderReport(readEntries(file), { verification: verify(file), ...extra });
}

module.exports = { renderReport, reportFromFile, groupRounds, runParts, esc, LABEL };
