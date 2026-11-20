// The deciding part. Kane (a model) walks the store and reports what it saw;
// nothing in this file asks a model for an opinion. Plain arithmetic and
// comparisons give each check a pass, fail, na (not triggered) or unknown
// (the value was not reported, so we refuse to guess).

// "$1,234.50" -> 123450 cents. "Free" / "$0.00" -> 0. Anything else -> null.
function parseMoney(text) {
  if (text == null) return null;
  const s = String(text).trim();
  const m = /(\d[\d,]*(?:\.\d{1,2})?)/.exec(s);
  if (!m) return /\bfree\b/i.test(s) ? 0 : null;
  return Math.round(parseFloat(m[1].replace(/,/g, "")) * 100);
}

// "Free shipping on orders over $50" -> 5000 cents. null if we cannot read one.
function parsePromiseThreshold(text) {
  if (text == null) return null;
  const s = String(text);
  if (!/free/i.test(s)) return null;
  const m = /(?:over|above|from|at least|minimum of|min\.?|orders of)\s*\$?\s*(\d[\d,]*(?:\.\d{1,2})?)/i.exec(s)
    || /\$\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(?:\+|or more|and up|and over)/i.exec(s);
  if (!m) return null;
  return Math.round(parseFloat(m[1].replace(/,/g, "")) * 100);
}

const usd = (c) => "$" + (c / 100).toFixed(2);

// run: { status, reasonCode, summary, values: {shipping_promise, item_price, cart_subtotal, shipping_line}, stepCount }
function evaluate(run, opts = {}) {
  const budget = opts.stepBudget || 20;
  const checks = [];

  // 1. Did the shopper get from the product page to checkout? Many real stores
  // ask for contact details before the payment step. Cartwalk never fills in
  // personal details, so reaching that form counts as reaching checkout, and
  // the detail says payment itself was not probed.
  const stage = String((run.values || {}).checkout_stage || "").toLowerCase();
  if (run.status === "failed") {
    checks.push({ id: "reached_checkout", status: "fail", detail: run.summary || "the shopper did not reach checkout" });
  } else if (run.status !== "passed") {
    checks.push({ id: "reached_checkout", status: "unknown", detail: "the run did not finish (" + (run.reasonCode || run.status) + ")" });
  } else if (stage.includes("payment")) {
    checks.push({ id: "reached_checkout", status: "pass", detail: "the shopper reached the payment page" });
  } else if (stage.includes("contact") || stage.includes("shipping") || stage.includes("address")) {
    checks.push({ id: "reached_checkout", status: "pass", detail: "the shopper reached checkout, which asks for contact details before payment; Cartwalk does not fill those in, so payment itself was not probed" });
  } else if (stage) {
    checks.push({ id: "reached_checkout", status: "fail", detail: "pressing Checkout led to something other than a checkout page (saw: " + stage + ")" });
  } else {
    checks.push({ id: "reached_checkout", status: "unknown", detail: "the shopper did not report what Checkout led to" });
  }

  // 2. Did it take a sane number of steps?
  if (typeof run.stepCount === "number") {
    checks.push(run.stepCount <= budget
      ? { id: "step_budget", status: "pass", detail: run.stepCount + " steps (budget " + budget + ")" }
      : { id: "step_budget", status: "fail", detail: run.stepCount + " steps, over the budget of " + budget });
  } else {
    checks.push({ id: "step_budget", status: "unknown", detail: "step count not reported" });
  }

  const v = run.values || {};
  const price = parseMoney(v.item_price);
  const subtotal = parseMoney(v.cart_subtotal);
  const shipping = parseMoney(v.shipping_line);
  const threshold = parsePromiseThreshold(v.shipping_promise);

  // 3. Does the cart add up? One unit was added, so subtotal must equal the price.
  if (price == null || subtotal == null) {
    checks.push({ id: "price_math", status: "unknown", detail: "price or subtotal was not reported" });
  } else {
    checks.push(price === subtotal
      ? { id: "price_math", status: "pass", detail: "1 x " + usd(price) + " = " + usd(subtotal) }
      : { id: "price_math", status: "fail", detail: "one item at " + usd(price) + " but the subtotal shows " + usd(subtotal) });
  }

  // 4. Does the store keep its shipping promise?
  if (threshold == null) {
    checks.push({ id: "shipping_promise", status: "unknown", detail: "no free-shipping threshold could be read from: " + JSON.stringify(v.shipping_promise || null) });
  } else if (subtotal == null || shipping == null) {
    checks.push({ id: "shipping_promise", status: "unknown", detail: "subtotal or shipping line was not reported" });
  } else if (subtotal < threshold) {
    checks.push({ id: "shipping_promise", status: "na", detail: "subtotal " + usd(subtotal) + " is under the " + usd(threshold) + " threshold, so the promise was not triggered" });
  } else if (shipping === 0) {
    checks.push({ id: "shipping_promise", status: "pass", detail: "subtotal " + usd(subtotal) + " is over " + usd(threshold) + " and shipping is free" });
  } else {
    checks.push({ id: "shipping_promise", status: "fail", detail: "banner promises free shipping over " + usd(threshold) + ", but a " + usd(subtotal) + " cart is charged " + usd(shipping) + " shipping" });
  }

  const failed = checks.filter((c) => c.status === "fail");
  const unknown = checks.filter((c) => c.status === "unknown");
  const verdict = failed.length ? "fail" : unknown.length ? "inconclusive" : "pass";
  return { verdict, checks };
}

module.exports = { evaluate, parseMoney, parsePromiseThreshold };
