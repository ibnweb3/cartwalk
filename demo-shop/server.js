// Tiny demo shop used in the early Kane measurements (see docs/kane-findings.md) to show a a hidden failure.
// Zero dependencies. Run: node demo-shop/server.js   (BUG=0 turns the bug off)
//
// The bug (BUG=1, the default): placing an order with a coupon makes the API
// return HTTP 500, but the page swallows the error and still shows
// "Order placed". A screenshot looks fine; the network log does not.
const http = require("http");

const PORT = Number(process.env.PORT || 4173);
const BUG = process.env.BUG !== "0";

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paper &amp; Pine: checkout</title>
<style>
  body{font:16px/1.5 system-ui,sans-serif;max-width:420px;margin:40px auto;padding:0 16px;color:#1d2433}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e3e7ee}
  input,button{font:inherit;padding:8px 10px;border-radius:6px;border:1px solid #b9c1ce}
  button{background:#1d2433;color:#fff;border-color:#1d2433;cursor:pointer}
  #msg{margin-top:16px;padding:10px;border-radius:6px;background:#e8f5ec;color:#14532d;display:none}
</style></head>
<body>
  <h1>Checkout</h1>
  <div class="row"><span>Notebook (A5)</span><span>$12.00</span></div>
  <div class="row"><span>Total</span><strong id="total">$12.00</strong></div>
  <p><label for="coupon">Coupon code</label><br>
  <input id="coupon" name="coupon" placeholder="e.g. SAVE10">
  <button id="apply" type="button">Apply</button></p>
  <p id="applied"></p>
  <button id="place" type="button">Place order</button>
  <div id="msg" role="status">Order placed. Thank you!</div>
<script>
  let coupon = "";
  document.getElementById("apply").onclick = () => {
    coupon = document.getElementById("coupon").value.trim();
    if (coupon === "SAVE10") {
      document.getElementById("total").textContent = "$10.80";
      document.getElementById("applied").textContent = "Coupon SAVE10 applied (10% off)";
    } else {
      document.getElementById("applied").textContent = "Coupon not recognised";
    }
  };
  document.getElementById("place").onclick = async () => {
    // Bug: the response status is never checked, so a failed order still "succeeds" on screen.
    await fetch("/api/order", { method: "POST", headers: {"content-type":"application/json"},
      body: JSON.stringify({ item: "notebook", coupon }) }).catch(() => {});
    document.getElementById("msg").style.display = "block";
  };
</script>
</body></html>`;

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(PAGE);
  }
  if (req.method === "GET" && req.url === "/favicon.ico") {
    // Without this the browser logs a 404 console error on every page load.
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "POST" && req.url === "/api/order") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let data = {};
      try { data = JSON.parse(body); } catch {}
      if (BUG && data.coupon) {
        res.writeHead(500, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "coupon lookup failed" }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  res.writeHead(404).end();
});

server.listen(PORT, () => console.log(`demo shop on http://localhost:${PORT} (BUG=${BUG ? 1 : 0})`));
