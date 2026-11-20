#!/usr/bin/env node
// npm run build:pages -> writes the hosted site into docs/ (GitHub Pages serves that folder).
// The animated run on the landing page and the report under it are both built from
// docs/demo-run/loop.jsonl, so they cannot disagree with the log.
const fs = require("fs");
const path = require("path");
const { readEntries, verify } = require("../lib/log");
const { runParts, groupRounds, esc } = require("../lib/report");
const { BASE } = require("../lib/theme");
const { SHOPPER_OBJECTIVE } = require("../lib/shopper");

const root = path.join(__dirname, "..");
const docs = path.join(root, "docs");
const LOG = path.join(docs, "demo-run", "loop.jsonl");
const REPO = "https://github.com/ibnweb3/cartwalk";
const NPX = "npx github:ibnweb3/cartwalk";

const entries = readEntries(LOG);
const verification = verify(LOG);
if (!verification.ok) throw new Error("docs/demo-run/loop.jsonl does not verify: " + verification.reason);
const parts = runParts(entries, { verification });

// What the landing page's animation plays: taken from the log, nothing typed by hand.
const { rounds } = groupRounds(entries);
const firstSentence = (s, n) => String(s || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s/)[0].slice(0, n);
const RUN = {
  entries: entries.length,
  rounds: rounds.map((r) => ({
    n: r.n,
    verdict: r.verdict ? r.verdict.verdict : "unknown",
    checks: r.verdict ? r.verdict.checks.map((c) => ({ id: c.id, status: c.status })) : [],
    firstFail: r.verdict ? firstSentence((r.verdict.checks.find((c) => c.status === "fail") || {}).detail, 110) : "",
    fixSummary: r.fix ? firstSentence(r.fix.summary, 150).replace(/`/g, "") : "",
    diff: r.fix ? String(r.fix.diff || "").split("\n").slice(0, 9).join("\n") : "",
  })),
};

const CURSOR_SVG = '<svg width="16" height="20" viewBox="0 0 18 22" aria-hidden="true"><path d="M1.5 1.5v16l4.6-4.3 3 6.9 3.1-1.4-3-6.8 6.3-.4z" fill="#6d6af7" stroke="#0b0d10" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const LOGO = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="2" y="2" width="22" height="22" rx="5" fill="none" stroke="#6d6af7" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M9 7v12l3.4-3.1 2.2 5 2.3-1-2.2-5 4.6-.3z" fill="#6d6af7"/></svg>`;
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26"><rect width="26" height="26" rx="6" fill="#0b0d10"/><rect x="3" y="3" width="20" height="20" rx="4" fill="none" stroke="#6d6af7" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M9 7v12l3.4-3.1 2.2 5 2.3-1-2.2-5 4.6-.3z" fill="#6d6af7"/></svg>`;

const cmd = (text) => `<div class="cmd"><pre tabindex="0"><code>${esc(text)}</code></pre><button type="button" class="copy" aria-label="Copy command">Copy</button></div>`;

function page({ title, desc, current, body, intro, extraHead = "", extraBody = "" }) {
  const nav = [
    ["index.html#how", "How it works", ""],
    ["index.html#run", "A real run", ""],
    ["setup.html", "Set it up", "setup"],
    [REPO, "GitHub", ""],
  ].map(([href, text, key]) => `<a href="${href}"${key && key === current ? ' aria-current="page"' : ""}>${text}</a>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><meta name="theme-color" content="#0b0d10">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="assets/site.css">${extraHead}</head>
<body${intro ? " data-intro" : ""}>
<a class="skip" href="#main">Skip to content</a>
<div class="wrap">
<header class="nav"><a class="brand" href="index.html" aria-label="Cartwalk home">${LOGO}<span>Cartwalk</span></a><nav class="nav-links" aria-label="Main">${nav}</nav></header>
<main id="main" style="padding:0;max-width:none">
${body}
</main>
<footer class="foot"><span>Apache-2.0 · Built for the KaneCLI Online Hackathon</span><span><a href="${REPO}">Source</a> · <a href="${REPO}#readme">README</a> · <a href="demo-run/loop.jsonl">Recorded log</a></span></footer>
</div>
${extraBody}
<script src="assets/site.js"></script>
</body></html>`;
}

/* ---------- landing page ---------- */
const checksRows = [
  ["reached_checkout", "Did the shopper get from the product page to checkout?", "Passes when Kane finishes and reports the payment page, or a contact-details step first (Cartwalk fills in no personal details, so it says payment was not probed). Fails, with Kane's evidence, only when Kane confirms a product bug such as a failed add to cart, or when Checkout leads somewhere else. If Kane cannot follow the instruction (for example the store has no banner to read) the result is unknown, never a store failure."],
  ["step_budget", "Did it take a sane number of steps?", "Counts the clicks, typing and page loads Kane performed. Fails over the budget (20 by default, --budget to change)."],
  ["price_math", "Does the cart add up?", "One unit was added, so the item price must equal the subtotal. Unknown if either was not reported."],
  ["shipping_promise", "Does the store keep its free-shipping promise?", "Reads the threshold from the banner (\"over $50\"). If the subtotal is at or over it, shipping must be free. Not triggered below it; unknown if no threshold can be read."],
];

const indexBody = `
<section class="hero" aria-labelledby="h1">
  <span class="label">/hero · 1200 × auto</span>
  <h1 id="h1">Can an AI agent buy from <span class="sel">your store?</span></h1>
  <p class="sub">More people now ask an AI to shop for them. If a popup, a button or a banner that disagrees with the cart stops it, you lose the sale and never see an error. Cartwalk sends a Kane CLI shopper through your store to find out, lets a coding agent fix what it finds, and keeps a log nobody can quietly edit.</p>
  <div class="cta"><a class="btn" href="setup.html">Set it up</a><a class="btn plain" href="#run">Watch the recorded run</a></div>
  <p class="label hint">Scroll to watch a real run · Esc skips the intro</p>
</section>

<section class="block" id="how" aria-labelledby="how-h">
  <span class="label">/how-it-works</span>
  <h2 id="how-h">Walk, judge, fix, prove</h2>
  <p class="lede">An AI proposes, plain code decides, and every step is written to a log that cannot be edited without it showing.</p>
  <div class="grid4">
    <div class="card"><span class="step">01 · walk</span><h3>Kane shops your store</h3><p>In real Chrome, in plain English, with no selectors: read the shipping banner, pick the most expensive product, add one, open the cart, click Checkout. It never pays and types nothing into checkout.</p></div>
    <div class="card"><span class="step">02 · judge</span><h3>Plain code decides</h3><p>Kane reports what it saw. Arithmetic and comparisons give each of four checks a pass or a fail. No model's opinion is involved, and a missing value is "unknown", never a quiet pass.</p></div>
    <div class="card"><span class="step">03 · fix</span><h3>A coding agent repairs it</h3><p>Failed checks and Kane's evidence go to Claude Code, which can only read and edit your store's folder. Its diff goes in the log.</p></div>
    <div class="card"><span class="step">04 · prove</span><h3>Kane walks again</h3><p>A fix only counts if the next walk passes. Every walk, verdict and diff is hash-chained: edit or delete one in the middle and verification names the entry.</p></div>
  </div>
  <div class="card" id="instruction" style="margin-top:12px"><span class="step">the whole instruction Kane receives · lib/shopper.js</span><p class="mono" style="font-size:.9rem;color:var(--fg);margin-top:8px">${esc(SHOPPER_OBJECTIVE)}</p></div>
</section>

<section class="block" id="run" aria-labelledby="run-h">
  <span class="label">/recorded-run</span>
  <h2 id="run-h">A real run, round by round</h2>
  <p class="lede">A small shop with two ordinary mistakes planted in it: the Desk Lamp cannot be added to the cart, and the banner promises free shipping over $50 while the code only waives it over $75. Below, the replay of what the log recorded.</p>
  <div class="stage" id="stage" role="group" aria-label="Replay of the recorded run">
    <p class="sr-only">Animated replay of the recorded run. Round 1 fails because the Desk Lamp cannot be added to the cart. Round 2 fails because shipping is charged on a cart over the free-shipping threshold. Round 3 passes. The same results are listed as text below.</p>
    <div class="stage-bar"><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div><span class="label stage-title">/recorded-run · localhost:4180</span><span class="spacer"></span><button type="button" class="plain" data-replay style="padding:4px 12px;font-size:13px">Replay</button></div>
    <div class="stage-body">
      <div class="layers"><h4>Checks</h4>
        <div class="layer" data-check="reached_checkout"><span>reached_checkout</span><span class="tag unknown">Unknown</span></div>
        <div class="layer" data-check="step_budget"><span>step_budget</span><span class="tag unknown">Unknown</span></div>
        <div class="layer" data-check="price_math"><span>price_math</span><span class="tag unknown">Unknown</span></div>
        <div class="layer" data-check="shipping_promise"><span>shipping_promise</span><span class="tag unknown">Unknown</span></div>
      </div>
      <div class="canvas">
        <span class="round-chip tag unknown">Ready</span>
        <div class="shop">
          <div class="shop-banner">Free shipping on orders over $50</div>
          <div class="shop-body">
            <div class="shop-product"><div class="shop-row"><span>Desk Lamp</span><b>$55.00</b></div><span class="shop-btn">Add to cart</span><div class="shop-err"></div></div>
            <div class="shop-cart"><div class="shop-row"><span>Desk Lamp × 1</span><b>$55.00</b></div><div class="shop-row"><span>Subtotal</span><b>$55.00</b></div><div class="shop-row shop-ship"><span>Shipping</span><b>$4.99</b></div></div>
          </div>
        </div>
      </div>
    </div>
    <div class="feed" aria-hidden="true"></div>
    <pre class="stage-diff" aria-hidden="true"></pre>
  </div>
  <p class="note">The replay is generated from <a href="demo-run/loop.jsonl">docs/demo-run/loop.jsonl</a>: the verdicts, the checks and the agent's diffs are the logged ones. The dollar amounts are from the demo shop.</p>
  <div style="margin-top:28px">${parts.roundsHtml}${parts.chainHtml}</div>
</section>

<section class="block" id="checks" aria-labelledby="checks-h">
  <span class="label">/the-deciding-code</span>
  <h2 id="checks-h">What the code decides</h2>
  <p class="lede">These four checks live in <a href="${REPO}/blob/main/lib/rules.js">lib/rules.js</a>, with unit tests. A value Kane did not report is "unknown", and unknown never counts as a pass.</p>
  <div class="checks"><div class="tbl scroll-x"><table><thead><tr><th>Check</th><th>The question</th><th>How it is decided</th></tr></thead><tbody>
  ${checksRows.map(([id, q, how]) => `<tr><th scope="row">${esc(id)}</th><td>${esc(q)}</td><td style="color:var(--muted)">${esc(how)}</td></tr>`).join("")}
  </tbody></table></div></div>
</section>

<section class="block" id="taste" aria-labelledby="taste-h">
  <span class="label">/taste-it</span>
  <h2 id="taste-h">Three ways to try it</h2>
  <p class="lede">From a minute in the browser to a real walk of your own store.</p>
  <div class="grid3">
    <div class="card"><span class="step">1 minute · browser</span><h3>Look</h3><p>Scroll up to the log and press <em>Change one result, then verify</em>. The page re-computes the hash chain itself and names the entry you changed.</p></div>
    <div class="card"><span class="step">2 minutes · Node only</span><h3>Check the claims</h3><p>No Kane, no network. It verifies the recorded log, tampers with a copy and builds a report.</p>${cmd("git clone " + REPO + "\ncd cartwalk\nnpm run offline")}</div>
    <div class="card"><span class="step">3 to 7 minutes · Kane</span><h3>Watch it catch a bug</h3><p>Starts the broken shop and sends a real shopper. About 25 to 50 Kane credits.</p>${cmd("npm run taste")}<p style="margin-top:8px"><a href="setup.html">Full setup, for any store</a></p></div>
  </div>
</section>

<section class="block" id="limits" aria-labelledby="limits-h">
  <span class="label">/limits</span>
  <h2 id="limits-h">What it does not do</h2>
  <div class="card"><ul style="margin:0">
    <li>It has been run on one third-party store (Saleor's public demo) once, plus the bundled shop. One walk is not a benchmark.</li>
    <li>Many real stores ask for contact details before payment. Cartwalk types nothing into checkout, so it says checkout was reached and that payment was not probed.</li>
    <li>It tests one flow: the most expensive product, one unit, to checkout. No coupons, logins or real payment.</li>
    <li>The coding agent has no shell, so it cannot run your store. Kane's next walk is the only proof a fix worked.</li>
    <li>Kane's speed varies: walks took 2.5 to 4.5 minutes, and one test run ended inconclusive when Kane's service was slow. The recorded logs are the fallback.</li>
    <li>The log catches edits and deletions in the middle. It cannot see entries cut off the end; publish the head hash elsewhere to cover that.</li>
  </ul></div>
</section>
<script>window.CARTWALK_RUN=${JSON.stringify(RUN).replace(/</g, "\\u003c")};</script>`;

/* ---------- setup page ---------- */
const need = [
  ["Node.js 20 or newer", "Required. Runs Cartwalk itself.", null],
  ["Kane CLI", "Required. The shopper. You need a free TestMu AI account; log in once.", "npm install -g @testmuai/kane-cli\nkane-cli login"],
  ["Google Chrome", "Required by Kane. If it is installed somewhere unusual, point Kane at it with the KANE_CLI_CHROME_PATH environment variable.", null],
  ["Claude Code CLI", "Only for the fix loop. Install it and log in so that `claude` works in a terminal. Not needed for check, report, verify or tamper.", null],
];

const setupBody = `
<section class="hero" style="padding-bottom:16px" aria-labelledby="h1">
  <span class="label">/setup</span>
  <h1 id="h1" style="max-width:18ch">Set up Cartwalk on any machine, for any store</h1>
  <p class="sub">Five minutes of setup, then one command. It needs Node, Kane CLI and Chrome. It was built and tested on Windows 11; macOS and Linux should work but I have not run them.</p>
</section>

<section class="block" style="padding-top:24px">
<ol class="steps">
  <li><h3>Install what it needs</h3>
    <div class="two">${need.map(([n, d, c]) => `<div class="card"><h3 style="margin-top:0">${esc(n)}</h3><p>${esc(d)}</p>${c ? cmd(c) : ""}</div>`).join("")}</div>
    <p>Check Kane works: <code>kane-cli --version</code> should print a version. Kane's free tier gave me 10,000 credits; a walk costs about 25 to 50.</p>
  </li>
  <li><h3>Get Cartwalk</h3>
    <p><strong>No install</strong> (downloads from GitHub the first time you run it):</p>${cmd(NPX + " help")}
    <p><strong>Or clone it</strong>, if you want to read or change the code:</p>${cmd("git clone " + REPO + "\ncd cartwalk\nnpm test")}
    <p>In the examples below, <code>cartwalk</code> means either <code>${esc(NPX)}</code> or, inside the clone, <code>node bin/cartwalk.js</code>.</p>
  </li>
  <li><h3>Walk your store</h3>
    <p>Point it at any store's address, including one running on your own machine:</p>${cmd("cartwalk check https://your-store.example")}
    <p>A walk usually takes 3 to 7 minutes. Kane opens Chrome headless, reads the shipping banner, adds the most expensive product to the cart, opens the cart and presses Checkout. Here is real output from a walk of Saleor's public demo:</p>
    <pre tabindex="0"><code>round 1: PASS  (9 steps, 250s, 53 credits)
  PASS  reached_checkout: the shopper reached checkout, which asks for contact details before payment; Cartwalk does not fill those in, so payment itself was not probed
  PASS  step_budget: 9 steps (budget 20)
  PASS  price_math: 1 x $300.00 = $300.00
  PASS  shipping_promise: subtotal $300.00 is over $75.00 and shipping is free</code></pre>
  </li>
  <li><h3>Read the result</h3>
    <dl class="kv">
      <dt>PASS / FAIL</dt><dd>The check was decided by plain code. A FAIL names the numbers or Kane's evidence.</dd>
      <dt>n/a</dt><dd>The check was not triggered (for example, a cart under the free-shipping threshold).</dd>
      <dt>???</dt><dd>Unknown: Kane did not report the value, so nothing is claimed.</dd>
      <dt>exit code</dt><dd>0 pass · 1 a check failed · 2 inconclusive or could not run. Use it in a script or pipeline.</dd>
      <dt>cartwalk-log.jsonl</dt><dd>Written in the folder you ran it from (change it with <code>--log file</code>). It holds the instruction, Kane's summary and values, and the verdicts.</dd>
    </dl>
  </li>
  <li><h3>Make a report and check the log</h3>${cmd("cartwalk report cartwalk-log.jsonl --out report.html\ncartwalk verify --log cartwalk-log.jsonl\ncartwalk tamper cartwalk-log.jsonl")}
    <p><code>report</code> writes one HTML file with a button that re-checks the hash chain in the browser. <code>tamper</code> edits a copy of the log, never the original, and shows verification catching it.</p>
  </li>
  <li><h3>Let the coding agent fix it (optional)</h3>
    <p>For a Node store that reads its port from the <code>PORT</code> environment variable. Commit your work first: the agent edits files in <code>--fix-dir</code> and its diff goes in the log.</p>${cmd("cartwalk loop http://localhost:3000 --fix-dir ./my-store --serve ./my-store/server.js")}
    <p>Cartwalk starts your store, walks it, and on a failure hands the failed checks and Kane's evidence to <code>claude</code> (read and edit tools only, no shell) inside <code>--fix-dir</code>. It restarts the store and walks again, up to 3 rounds (<code>--rounds</code>). For other stacks, use <code>check</code> and apply fixes yourself.</p>
    <div class="callout"><strong>Try the loop on the bundled shop first.</strong> <code>node bin/cartwalk.js loop http://localhost:4180 --fix-dir store --serve store/server.js</code> from the clone reproduces the recorded run in about 10 minutes.</div>
  </li>
  <li><h3>Use it in a pipeline</h3>
    <p>The exit codes are the interface: 0, 1 or 2. The runner needs Node, Kane CLI (logged in) and Chrome. I have not run Cartwalk in CI yet, so treat this as untested.</p>
  </li>
</ol>

<div class="callout"><strong>Safety and cost.</strong> Cartwalk never pays and types nothing into checkout pages, but it does add one item to a cart on the store you point it at, so use a staging or test store when you can. Each walk spends about 25 to 50 Kane credits. The log stays on your machine and contains Kane's description of your store.</div>

<span class="label" style="display:block;margin-top:40px">/options</span>
<h2 style="display:block;font-size:1.5rem;margin:6px 0 14px;letter-spacing:-.02em">Options</h2>
<div class="card"><dl class="kv">
  <dt>--log &lt;file&gt;</dt><dd>Where to write the log.</dd>
  <dt>--timeout &lt;sec&gt;</dt><dd>How long Kane gets for one walk. Default 420.</dd>
  <dt>--steps &lt;n&gt;</dt><dd>Most steps Kane may take. Default 30.</dd>
  <dt>--budget &lt;n&gt;</dt><dd>Step budget for the step_budget check. Default 20.</dd>
  <dt>--rounds &lt;n&gt;</dt><dd>Most walk and fix rounds in a loop. Default 3.</dd>
  <dt>--fix-dir, --serve</dt><dd>Loop only: the folder the agent may edit, and the Node file that starts your store.</dd>
</dl></div>

<span class="label" style="display:block;margin-top:40px">/troubleshooting</span>
<h2 style="display:block;font-size:1.5rem;margin:6px 0 14px;letter-spacing:-.02em">When something goes wrong</h2>
<div class="card"><dl class="kv">
  <dt>Result is inconclusive</dt><dd>Kane did not finish. Its service can be slow: a healthy walk took between 2.5 and 4.5 minutes for me, and once it did not finish in 7. Run it again, or raise <code>--timeout</code>. A run that ran out of time is not retried and never counted as a store failure.</dd>
  <dt>Kane CLI was not found</dt><dd>Run <code>npm install -g @testmuai/kane-cli</code>, then <code>kane-cli login</code>.</dd>
  <dt>Chrome not found</dt><dd>Install Google Chrome, or set <code>KANE_CLI_CHROME_PATH</code> to its full path.</dd>
  <dt>"something is already serving"</dt><dd>Another program is on that port. Stop it, or use another port.</dd>
  <dt>FAIL on a store that works</dt><dd>Open the log and read Kane's summary. If it describes a real problem, it is real. Cartwalk does not fill in contact details, so it counts a contact-details checkout as reached, not as a failure.</dd>
  <dt>"not a web address"</dt><dd>Use a full address starting with http:// or https://, with no spaces or shell symbols.</dd>
</dl></div>

<div class="callout" style="border-left-color:var(--accent)"><strong>Tested on:</strong> Windows 11, Node 24, Kane CLI 0.10.6, Chrome 158. Not tested on macOS or Linux.</div>
</section>`;

/* ---------- write ---------- */
fs.mkdirSync(path.join(docs, "assets"), { recursive: true });
fs.writeFileSync(path.join(docs, "assets", "site.css"), BASE + "\n" + fs.readFileSync(path.join(__dirname, "site", "site.css"), "utf8"));
fs.copyFileSync(path.join(__dirname, "site", "site.js"), path.join(docs, "assets", "site.js"));
fs.writeFileSync(path.join(docs, "assets", "favicon.svg"), FAVICON);
fs.writeFileSync(path.join(docs, "index.html"), page({
  title: "Cartwalk: can an AI agent buy from your store?",
  desc: "A Kane CLI shopper walks your store to checkout, plain code judges it, a coding agent fixes what failed, and a hash-chained log keeps the receipts.",
  current: "", body: indexBody, intro: true, extraBody: parts.scripts,
}));
fs.writeFileSync(path.join(docs, "setup.html"), page({
  title: "Set up Cartwalk: any machine, any store",
  desc: "Install Kane CLI and Cartwalk, walk a store with one command, read the result, and optionally let a coding agent fix what fails.",
  current: "setup", body: setupBody, intro: false,
}));
console.log("wrote docs/index.html, docs/setup.html, docs/assets/{site.css,site.js,favicon.svg}");
