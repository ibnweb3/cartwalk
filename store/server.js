// Paper & Pine: a tiny demo store used to show an AI shopper getting stuck.
// Zero dependencies. Run: node store/server.js   (PORT env, default 4180)
//
// This is the store the coding agent is allowed to edit. It starts with two
// ordinary mistakes that a human owner would never notice:
//   1. The Desk Lamp cannot be added to the cart (the server returns 500).
//   2. The banner promises free shipping over $50, but the code charges
//      shipping until the subtotal passes $75.
const http = require("http");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4180);

const PRODUCTS = {
  notebook: { name: "Notebook (A5)", price: 1200 },
  // The lamp is missing here on purpose, so adding it to the cart fails.
};
const LAMP = { name: "Desk Lamp", price: 5500 };

const FREE_SHIPPING_BANNER_DOLLARS = 50;
const FREE_SHIPPING_OVER_CENTS = 7500;
const SHIPPING_CENTS = 499;

const carts = new Map(); // session id -> [{ slug, qty }]

const money = (c) => "$" + (c / 100).toFixed(2);
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

function lookup(slug) {
  if (slug === "lamp") return LAMP;
  return PRODUCTS[slug];
}

function layout(title, body, cartCount) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Paper &amp; Pine</title>
<link rel="icon" href="data:,">
<style>
  body{font:16px/1.5 system-ui,sans-serif;margin:0;color:#1d2433}
  .banner{background:#1d2433;color:#fff;text-align:center;padding:8px}
  header,main{max-width:560px;margin:0 auto;padding:12px 16px}
  header{display:flex;justify-content:space-between;align-items:center}
  a{color:#1d2433}
  .card{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #e3e7ee}
  button,.btn{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid #1d2433;background:#1d2433;color:#fff;cursor:pointer;text-decoration:none;display:inline-block}
  button.plain{background:#fff;color:#1d2433}
  input{font:inherit;padding:8px 10px;border:1px solid #b9c1ce;border-radius:6px}
  .row{display:flex;justify-content:space-between;padding:6px 0}
  #newsletter{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center}
  #newsletter .box{background:#fff;padding:24px;border-radius:10px;max-width:340px}
</style></head>
<body>
<div class="banner">Free shipping on orders over $${FREE_SHIPPING_BANNER_DOLLARS}</div>
<header><a href="/"><strong>Paper &amp; Pine</strong></a><a href="/cart">Cart (${cartCount})</a></header>
<main>${body}</main>
<div id="newsletter" role="dialog" aria-modal="true" aria-label="Join our newsletter">
  <div class="box"><h2>Get 10% off</h2><p>Join our newsletter for deals.</p>
  <input type="email" placeholder="you@example.com" aria-label="Email address">
  <p><button type="button" id="join">Sign up</button> <button type="button" class="plain" id="nothanks">No thanks</button></p></div>
</div>
<script>
  setTimeout(function(){ if(!sessionStorage.getItem("nl")){ document.getElementById("newsletter").style.display="flex"; } }, 600);
  document.getElementById("nothanks").onclick = function(){ sessionStorage.setItem("nl","1"); document.getElementById("newsletter").style.display="none"; };
  document.getElementById("join").onclick = document.getElementById("nothanks").onclick;
</script>
</body></html>`;
}

function homePage(count) {
  return layout("Shop", `<h1>Shop</h1>
  <div class="card"><a href="/p/notebook">Notebook (A5)</a><span>${money(1200)}</span></div>
  <div class="card"><a href="/p/lamp">Desk Lamp</a><span>${money(5500)}</span></div>`, count);
}

function productPage(slug, count) {
  const p = lookup(slug);
  if (!p) return null;
  return layout(p.name, `<h1>${esc(p.name)}</h1><p>${money(p.price)}</p>
  <fieldset><legend>Color</legend>
    <label><input type="radio" name="color" value="white" checked> White</label>
    <label><input type="radio" name="color" value="black"> Black</label>
  </fieldset>
  <p><button type="button" id="add">Add to cart</button> <span id="status" role="status"></span></p>
<script>
  document.getElementById("add").onclick = async function(){
    var b = this; b.disabled = true; b.textContent = "Adding...";
    var color = document.querySelector("input[name=color]:checked").value;
    try {
      var r = await fetch("/api/cart", {method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({slug:${JSON.stringify(slug)}, color:color})});
      if (!r.ok) throw new Error("add failed");
      location.href = "/cart";
    } catch (e) { /* swallowed: the button stays in "Adding..." forever */ }
  };
</script>`, count);
}

function cartPage(items, count) {
  if (!items.length) return layout("Cart", `<h1>Your cart</h1><p>Your cart is empty.</p><p><a href="/">Keep shopping</a></p>`, count);
  let subtotal = 0;
  const rows = items.map((it) => {
    const p = lookup(it.slug);
    subtotal += p.price * it.qty;
    return `<div class="card"><span>${esc(p.name)} &times; ${it.qty}</span><span>${money(p.price * it.qty)}</span></div>`;
  }).join("");
  const shipping = subtotal > FREE_SHIPPING_OVER_CENTS ? 0 : SHIPPING_CENTS;
  return layout("Cart", `<h1>Your cart</h1>${rows}
  <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
  <div class="row"><span>Shipping</span><span>${shipping === 0 ? "Free" : money(shipping)}</span></div>
  <div class="row"><strong>Total</strong><strong>${money(subtotal + shipping)}</strong></div>
  <p><a class="btn" href="/checkout">Checkout</a></p>`, count);
}

function checkoutPage(count) {
  return layout("Payment", `<h1>Payment</h1><p>Enter your card details to pay.</p>
  <p><label>Card number<br><input inputmode="numeric" autocomplete="cc-number"></label></p>
  <p><label>Expiry<br><input autocomplete="cc-exp"></label></p>
  <p><button type="button">Pay now</button></p>`, count);
}

function session(req, res) {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || "");
  let sid = m && m[1];
  if (!sid || !carts.has(sid)) {
    sid = crypto.randomBytes(8).toString("hex");
    carts.set(sid, []);
    res.setHeader("set-cookie", `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`);
  }
  return carts.get(sid);
}

const server = http.createServer((req, res) => {
  const cart = session(req, res);
  const count = cart.reduce((n, it) => n + it.qty, 0);
  const html = (body) => {
    if (body == null) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  };
  const url = req.url.split("?")[0];
  if (req.method === "GET" && url === "/") return html(homePage(count));
  if (req.method === "GET" && url.startsWith("/p/")) return html(productPage(url.slice(3), count));
  if (req.method === "GET" && url === "/cart") return html(cartPage(cart, count));
  if (req.method === "GET" && url === "/checkout") return html(checkoutPage(count));
  if (req.method === "POST" && url === "/api/cart") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let data = {};
      try { data = JSON.parse(body); } catch {}
      if (!PRODUCTS[data.slug]) {
        res.writeHead(500, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "unknown sku " + data.slug }));
      }
      const line = cart.find((it) => it.slug === data.slug);
      if (line) line.qty += 1; else cart.push({ slug: data.slug, qty: 1 });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  html(null);
});

server.listen(PORT, () => console.log(`store on http://localhost:${PORT}`));
