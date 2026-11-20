/* Cartwalk site: copy buttons, the intro, and the replay of the recorded run.
   Everything the replay shows comes from window.CARTWALK_RUN, which the build
   copies out of docs/demo-run/loop.jsonl, so the animation cannot drift from the log. */
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CURSOR = '<svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true"><path d="M1.5 1.5v16l4.6-4.3 3 6.9 3.1-1.4-3-6.8 6.3-.4z" fill="currentColor" stroke="#0b0d10" stroke-width="1.4" stroke-linejoin="round"/></svg>';

  /* design-tool selection badge: shows the real rendered size of the highlighted text */
  Array.prototype.forEach.call(document.querySelectorAll(".sel"), function (el) {
    var badge = document.createElement("span");
    badge.className = "selsize";
    badge.setAttribute("aria-hidden", "true");
    el.appendChild(badge);
    var size = function () { var r = el.getBoundingClientRect(); badge.textContent = Math.round(r.width) + " × " + Math.round(r.height); };
    size();
    window.addEventListener("resize", size);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
  });

  /* copy buttons: feedback shows on the button itself */
  Array.prototype.forEach.call(document.querySelectorAll(".cmd .copy"), function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.parentNode.querySelector("pre").innerText.replace(/\n$/, "");
      var done = function () { var old = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.textContent = old; }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
      else done();
    });
  });

  /* intro: two named cursors draw selection boxes, once per visit, never with reduced motion */
  var seen = false;
  try { seen = sessionStorage.getItem("cw-intro") === "1"; } catch (e) { /* storage blocked */ }
  if (!reduce && !seen && document.body.hasAttribute("data-intro")) {
    var intro = document.createElement("div");
    intro.id = "intro";
    intro.setAttribute("aria-hidden", "true");
    intro.innerHTML =
      '<div class="box" id="ib1" style="left:12%;top:26%;width:0;height:0"><i>0 × 0</i></div>' +
      '<div class="box" id="ib2" style="left:58%;top:52%;width:0;height:0"><i>0 × 0</i></div>' +
      '<div class="cursor kane" id="ic1" style="transform:translate(12vw,26vh)">' + CURSOR + '<span class="tagname">Kane</span></div>' +
      '<div class="cursor agent" id="ic2" style="transform:translate(58vw,52vh)">' + CURSOR + '<span class="tagname">Agent</span></div>' +
      '<div class="pill">2 agents · walking the store</div><div class="label skiphint">Esc or click to skip</div>';
    document.body.appendChild(intro);
    var end = function () {
      if (!intro.parentNode) return;
      intro.classList.add("out");
      try { sessionStorage.setItem("cw-intro", "1"); } catch (e) { /* ignore */ }
      setTimeout(function () { if (intro.parentNode) intro.parentNode.removeChild(intro); }, 500);
      document.removeEventListener("keydown", onKey);
    };
    var onKey = function (e) { if (e.key === "Escape") end(); };
    document.addEventListener("keydown", onKey);
    intro.addEventListener("click", end);
    var grow = function (id, w, h, x, y, label) {
      var b = document.getElementById(id);
      b.style.width = w + "px"; b.style.height = h + "px";
      b.querySelector("i").textContent = label;
    };
    setTimeout(function () {
      var vw = window.innerWidth, vh = window.innerHeight;
      var w1 = Math.round(vw * 0.36), h1 = Math.round(vh * 0.18), w2 = Math.round(vw * 0.28), h2 = Math.round(vh * 0.16);
      grow("ib1", w1, h1, 0, 0, w1 + " × " + h1);
      grow("ib2", w2, h2, 0, 0, w2 + " × " + h2);
      document.getElementById("ic1").style.transform = "translate(" + (vw * 0.12 + w1) + "px," + (vh * 0.26 + h1) + "px)";
      document.getElementById("ic2").style.transform = "translate(" + (vw * 0.58 + w2) + "px," + (vh * 0.52 + h2) + "px)";
    }, 120);
    setTimeout(end, 2300);
  }

  /* replay of the recorded run */
  var stage = document.getElementById("stage");
  var run = window.CARTWALK_RUN;
  if (!stage || !run) return;
  var canvas = stage.querySelector(".canvas");
  var shop = stage.querySelector(".shop");
  var feed = stage.querySelector(".feed");
  var diffEl = stage.querySelector(".stage-diff");
  var chip = stage.querySelector(".round-chip");
  var err = stage.querySelector(".shop-err");
  var btn = stage.querySelector(".shop-btn");
  var ship = stage.querySelector(".shop-ship");
  var shipVal = ship.querySelector("b");
  var layers = {};
  Array.prototype.forEach.call(stage.querySelectorAll(".layer"), function (l) { layers[l.getAttribute("data-check")] = l; });
  var LABEL = { pass: "Pass", fail: "Fail", unknown: "Unknown", na: "n/a" };
  var token = 0;

  function mk(cls) {
    var c = document.createElement("div");
    c.className = "cursor " + cls + " hidden";
    c.innerHTML = CURSOR + '<span class="tagname">' + (cls === "kane" ? "Kane" : "Agent") + "</span>";
    canvas.appendChild(c);
    return c;
  }
  var kane = mk("kane"), agent = mk("agent");

  function sleep(ms, my) { return new Promise(function (r) { setTimeout(function () { r(my === token); }, ms); }); }
  function moveTo(c, el, dx, dy) {
    var a = canvas.getBoundingClientRect(), b = el.getBoundingClientRect();
    c.classList.remove("hidden");
    c.style.transform = "translate(" + Math.round(b.left - a.left + (dx || 10)) + "px," + Math.round(b.top - a.top + (dy || 10)) + "px)";
  }
  function line(who, text) {
    var p = document.createElement("p");
    p.innerHTML = "<b class=\"" + who + "\">" + who + "</b><span></span>";
    p.lastChild.textContent = text;
    feed.appendChild(p);
    feed.scrollTop = feed.scrollHeight;
  }
  function setLayers(checks) {
    Object.keys(layers).forEach(function (id) {
      var l = layers[id], c = null;
      (checks || []).forEach(function (x) { if (x.id === id) c = x; });
      l.className = "layer" + (c && c.status === "pass" ? " is-pass" : c && c.status === "fail" ? " is-fail" : "");
      var t = l.querySelector(".tag");
      var s = c ? c.status : "unknown";
      t.className = "tag " + s;
      t.textContent = LABEL[s] || s;
    });
  }
  function setChip(r) {
    chip.className = "round-chip tag " + (r ? r.verdict : "unknown");
    chip.textContent = r ? "Round " + r.n + " · " + (r.verdict === "pass" ? "Pass" : r.verdict === "fail" ? "Fail" : r.verdict) : "Ready";
  }
  function showDiff(text) {
    if (!text) { diffEl.className = "stage-diff"; return; }
    diffEl.innerHTML = "";
    text.split("\n").slice(0, 9).forEach(function (l) {
      var s = document.createElement("span");
      s.className = l.indexOf("+") === 0 ? "add" : l.indexOf("-") === 0 ? "del" : l.indexOf("@@") === 0 || l.indexOf("file:") === 0 ? "hunk" : "";
      s.textContent = l + "\n";
      diffEl.appendChild(s);
    });
    diffEl.className = "stage-diff on";
  }
  function reset() {
    feed.innerHTML = "";
    shop.className = "shop";
    err.className = "shop-err"; err.textContent = "";
    btn.className = "shop-btn"; btn.textContent = "Add to cart";
    ship.className = "shop-row shop-ship"; shipVal.textContent = "$4.99";
    kane.classList.add("hidden"); agent.classList.add("hidden");
    showDiff("");
    setLayers([]);
    setChip(null);
  }

  /* everything at once, for reduced motion or a quick look */
  function showFinal() {
    token++;
    reset();
    shop.className = "shop cart";
    ship.className = "shop-row shop-ship good"; shipVal.textContent = "Free";
    run.rounds.forEach(function (r) {
      line("kane", "round " + r.n + ": " + r.verdict + (r.firstFail ? " · " + r.firstFail : ""));
      if (r.fixSummary) line("agent", r.fixSummary);
    });
    var last = run.rounds[run.rounds.length - 1];
    setLayers(last.checks); setChip(last);
  }

  async function play() {
    var my = ++token;
    reset();
    for (var i = 0; i < run.rounds.length; i++) {
      var r = run.rounds[i];
      var ok;
      if (i === 0) {
        shop.className = "shop";
        line("kane", "walking the store as a shopper");
        if (!(ok = await sleep(900, my))) return;
        moveTo(kane, btn, 30, 8);
        if (!(ok = await sleep(950, my))) return;
        btn.className = "shop-btn busy"; btn.textContent = "Adding...";
        err.textContent = "POST /api/cart → 500"; err.className = "shop-err on";
        line("kane", "Add to cart never finished: POST /api/cart returned 500");
      } else {
        shop.className = "shop cart";
        ship.className = "shop-row shop-ship" + (r.verdict === "pass" ? " good" : " bad");
        shipVal.textContent = r.verdict === "pass" ? "Free" : "$4.99";
        moveTo(kane, ship, 120, 6);
        if (!(ok = await sleep(900, my))) return;
        line("kane", r.verdict === "pass" ? "subtotal $55.00, shipping Free: promise kept" : "banner says free over $50, but a $55.00 cart pays $4.99 shipping");
      }
      if (!(ok = await sleep(700, my))) return;
      setLayers(r.checks); setChip(r);
      if (!r.fixSummary) break;
      if (!(ok = await sleep(900, my))) return;
      moveTo(agent, shop, Math.max(20, shop.offsetWidth - 70), 56);
      line("agent", r.fixSummary);
      showDiff(r.diff);
      if (!(ok = await sleep(2400, my))) return;
      showDiff("");
      kane.classList.add("hidden");
      line("kane", "walking again");
      if (!(ok = await sleep(500, my))) return;
      err.className = "shop-err";
      btn.className = "shop-btn"; btn.textContent = "Add to cart";
    }
    line("log", run.rounds.length + " rounds, " + run.entries + " log entries, chain intact");
    agent.classList.add("hidden"); kane.classList.add("hidden");
  }

  stage.querySelector("[data-replay]").addEventListener("click", function () { if (reduce) showFinal(); else play(); });
  if (reduce) { showFinal(); return; }
  setChip(null); setLayers([]);
  if ("IntersectionObserver" in window) {
    var started = false;
    new IntersectionObserver(function (es, o) {
      es.forEach(function (e) { if (e.isIntersecting && !started) { started = true; play(); o.disconnect(); } });
    }, { threshold: 0.35 }).observe(stage);
  } else play();
})();
