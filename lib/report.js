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

const STYLE = `
:root{--bg:#fbfaf7;--fg:#1d2433;--muted:#5d6678;--line:#dcd8cf;--card:#fff;--pass:#176b3a;--passbg:#e3f3e9;--fail:#a3261d;--failbg:#fbe6e3;--warn:#8a5a00;--warnbg:#fbf0d6;--na:#4a5365;--nabg:#e9ebf0;--add:#e3f3e9;--del:#fbe6e3;--accent:#1d2433}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#14171d;--fg:#e8eaee;--muted:#9aa3b2;--line:#2b303a;--card:#1b1f27;--pass:#6fd09a;--passbg:#16301f;--fail:#ff9d94;--failbg:#3a1b18;--warn:#f0c264;--warnbg:#38290c;--na:#aab2c0;--nabg:#262b35;--add:#16301f;--del:#3a1b18;--accent:#e8eaee}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:1.6rem;margin:0 0 4px;text-wrap:balance}
h2{font-size:1.15rem;margin:0 0 4px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
h3{font-size:1rem;margin:16px 0 4px}
.lede{color:var(--muted);margin:0 0 24px}
.meta{color:var(--muted);margin:0 0 10px;font-variant-numeric:tabular-nums}
.round,.chain{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:.95rem}
th,td{text-align:left;vertical-align:top;padding:6px 8px;border-top:1px solid var(--line)}
thead th{color:var(--muted);font-weight:600;border-top:0}
tbody th{font-weight:600;white-space:nowrap}
.tag{display:inline-block;padding:1px 9px;border-radius:99px;font-size:.8rem;font-weight:600;white-space:nowrap}
.tag.pass{color:var(--pass);background:var(--passbg)}
.tag.fail{color:var(--fail);background:var(--failbg)}
.tag.unknown,.tag.inconclusive{color:var(--warn);background:var(--warnbg)}
.tag.na{color:var(--na);background:var(--nabg)}
pre{margin:6px 0 0;padding:10px;border:1px solid var(--line);border-radius:8px;overflow:auto;font:13px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;background:var(--bg)}
pre .add{background:var(--add);display:inline-block;min-width:100%}
pre .del{background:var(--del);display:inline-block;min-width:100%}
pre .hunk,pre .file{color:var(--muted)}
details{margin:8px 0}
summary{cursor:pointer;color:var(--muted)}
.kane{margin:6px 0 0;color:var(--fg)}
.hash{font:13px ui-monospace,Consolas,monospace;word-break:break-all}
button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--bg);cursor:pointer;touch-action:manipulation}
button.plain{background:transparent;color:var(--fg);border-color:var(--line)}
button:focus-visible,summary:focus-visible,pre:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
.row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 8px}
#result{margin:8px 0 0;min-height:1.5em}
#result.good{color:var(--pass);font-weight:600}
#result.bad{color:var(--fail);font-weight:600}
footer{color:var(--muted);font-size:.9rem;margin-top:24px}
`;

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

function renderReport(entries, opts = {}) {
  const { rounds, final } = groupRounds(entries);
  const url = (rounds[0] && rounds[0].url) || "";
  const v = opts.verification || { ok: true, count: entries.length, head: entries.length ? entries[entries.length - 1].hash : "" };
  const credits = entries.filter((e) => e.kind === "kane_run").reduce((n, e) => n + (e.data.credits || 0), 0);
  const verdict = final || (rounds.length && rounds[rounds.length - 1].verdict ? rounds[rounds.length - 1].verdict.verdict : "unknown");
  const data = JSON.stringify(entries).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cartwalk report</title><link rel="icon" href="data:,"><style>${STYLE}</style></head>
<body><main>
<h1>Cartwalk report <span class="tag ${esc(verdict)}">${esc(LABEL[verdict] || verdict)}</span></h1>
<p class="lede">An AI shopper walked <strong>${esc(url)}</strong> to checkout. Plain code judged what it saw. ${rounds.length} round${rounds.length === 1 ? "" : "s"}, about ${Math.round(credits)} Kane credits.</p>
${rounds.map(roundHtml).join("\n")}
<section class="chain" aria-labelledby="chain-h">
  <h2 id="chain-h">The log</h2>
  <p>Every walk, verdict and fix is an entry that carries the hash of the one before it. Editing or deleting anything in the middle breaks the chain. ${esc(String(v.count))} entries; the command-line check says: <strong>${v.ok ? "intact" : "broken"}</strong>.</p>
  <p class="hash">head ${esc(v.head || "")}</p>
  <div class="row"><button id="verify" type="button">Verify in this browser</button><button id="tamper" type="button" class="plain">Change one result, then verify</button></div>
  <p id="result" role="status" aria-live="polite"></p>
  <p class="meta">Entries cut off the end cannot be detected from the file alone. Publish the head hash elsewhere to cover that.</p>
</section>
<footer>Generated by Cartwalk from the log below. Nothing on this page is typed in by hand.</footer>
</main>
<script type="application/json" id="log-data">${data}</script>
<script>${sha256hex.toString()}${CLIENT}</script>
</body></html>`;
}

function reportFromFile(file) {
  const { readEntries } = require("./log");
  return renderReport(readEntries(file), { verification: verify(file) });
}

module.exports = { renderReport, reportFromFile, groupRounds };
