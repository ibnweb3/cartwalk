// One look for everything Cartwalk draws: the standalone report and the hosted
// site share these tokens and components. Dark on purpose: a near-black canvas,
// a violet glow, indigo buttons, tight semibold headings and small mono labels.
// Colour is never the only signal; every status also carries a word.
const BASE = `
:root{color-scheme:dark;--bg:#0b0d10;--panel:#11151b;--panel2:#161b23;--line:#232a35;--fg:#eceef2;--muted:#9aa3b2;--faint:#6b7585;
--accent:#6d6af7;--accent2:#8b5cf6;--sel:#2f6bff;
--pass:#5fd39a;--passbg:#10281c;--fail:#ff8f86;--failbg:#341716;--warn:#f0c264;--warnbg:#32270d;--na:#aab2c0;--nabg:#1d232d;--add:#10281c;--del:#341716;
--sans:"Inter","Inter Display",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:ui-monospace,"JetBrains Mono",SFMono-Regular,Consolas,monospace}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;-webkit-tap-highlight-color:transparent}
::selection{background:var(--accent);color:#fff}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:clamp(1.6rem,4vw,2rem);font-weight:600;letter-spacing:-.02em;margin:0 0 6px;text-wrap:balance}
h2{font-size:1.15rem;font-weight:600;letter-spacing:-.01em;margin:0 0 4px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;text-wrap:balance}
h3{font-size:1rem;font-weight:600;margin:16px 0 4px}
.lede{color:var(--muted);margin:0 0 24px}
.meta{color:var(--muted);margin:0 0 10px;font-variant-numeric:tabular-nums}
.mono{font-family:var(--mono)}
.label{font:12px/1.4 var(--mono);color:var(--faint);letter-spacing:.02em}
code{font:13px var(--mono);background:var(--panel2);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
pre code{background:none;border:0;padding:0;font:inherit;border-radius:0}
a{color:inherit;text-underline-offset:3px;text-decoration-color:var(--faint)}
@media (hover:hover){a:hover{text-decoration-color:var(--fg)}}
.intro ol{padding-left:20px;margin:6px 0 12px}
.intro li{margin:4px 0}
.round,.chain{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:.95rem}
th,td{text-align:left;vertical-align:top;padding:7px 8px;border-top:1px solid var(--line)}
thead th{color:var(--muted);font-weight:500;border-top:0;font-size:.85rem}
tbody th{font-weight:600;white-space:nowrap;font-family:var(--mono);font-size:.85rem}
.tag{display:inline-block;padding:1px 9px;border-radius:99px;font-size:.78rem;font-weight:600;white-space:nowrap}
.tag.pass{color:var(--pass);background:var(--passbg)}
.tag.fail{color:var(--fail);background:var(--failbg)}
.tag.unknown,.tag.inconclusive{color:var(--warn);background:var(--warnbg)}
.tag.na{color:var(--na);background:var(--nabg)}
pre{margin:6px 0 0;padding:10px;border:1px solid var(--line);border-radius:8px;overflow:auto;font:13px/1.55 var(--mono);background:var(--bg)}
pre .add{background:var(--add);display:inline-block;min-width:100%}
pre .del{background:var(--del);display:inline-block;min-width:100%}
pre .hunk,pre .file{color:var(--muted)}
details{margin:8px 0}
summary{cursor:pointer;color:var(--muted)}
.kane{margin:6px 0 0;color:var(--fg)}
.hash{font:13px var(--mono);word-break:break-all;color:var(--muted)}
.btn,button{display:inline-flex;align-items:center;gap:8px;font:inherit;font-weight:500;padding:9px 16px;border-radius:9px;border:1px solid transparent;color:#fff;cursor:pointer;text-decoration:none;touch-action:manipulation;user-select:none;background:linear-gradient(180deg,var(--accent),#5754e8);box-shadow:0 1px 0 rgba(255,255,255,.18) inset}
.btn.plain,button.plain{background:transparent;color:var(--fg);border-color:var(--line);box-shadow:none}
@media (hover:hover){.btn:hover,button:hover{filter:brightness(1.1)}.btn.plain:hover,button.plain:hover{border-color:var(--faint);filter:none}}
.btn:focus-visible,button:focus-visible,summary:focus-visible,pre:focus-visible,a:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--accent2);border-radius:8px}
.row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 8px}
#result{margin:8px 0 0;min-height:1.5em}
#result.good{color:var(--pass);font-weight:600}
#result.bad{color:var(--fail);font-weight:600}
footer{color:var(--muted);font-size:.9rem;margin-top:24px}
`;

module.exports = { BASE };
