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

// "2", "2 units", "Qty: 3" -> 2, 2, 3. Anything else (or 0) -> null.
function parseQuantity(text) {
  if (text == null) return null;
  const m = /(\d+)/.exec(String(text));
  const n = m ? parseInt(m[1], 10) : 0;
  return n > 0 ? n : null;
}

const NONE = /^\s*(none|no\b|n\/a|not shown|0)/i;

// The cart arithmetic. expected subtotal = price x quantity - discount.
//   pass     the subtotal equals that
//   fail     the subtotal is HIGHER than the items alone can explain (the store charges more than it shows)
//   unknown  anything a legitimate store could also do: a discount that does not reconcile, a subtotal lower
//            than expected with no discount reported, a quantity that was not reported, or a product-page price
//            that differs from the cart line (variant pricing, "from $X" ranges, folded-in discounts).
//            Unknown is never sent to the coding agent.
function priceMath(v) {
  const price = parseMoney(v.item_price);
  const subtotal = parseMoney(v.cart_subtotal);
  if (price == null || subtotal == null) return { id: "price_math", status: "unknown", detail: "price or subtotal was not reported" };

  const qty = parseQuantity(v.item_quantity);
  const q = qty || 1;
  const discText = v.discount_line == null ? "" : String(v.discount_line);
  const noDiscount = discText.trim() === "" || NONE.test(discText);
  const discount = noDiscount ? 0 : parseMoney(discText);
  const pagePrice = parseMoney(v.page_price);

  if (discount == null) return { id: "price_math", status: "unknown", detail: "the cart shows a discount line (" + JSON.stringify(discText) + ") whose amount could not be read, so the subtotal cannot be checked" };

  // The cart line differs from the product-page price: a variant, a range or a discount could all explain it.
  if (pagePrice != null && pagePrice !== price) {
    return { id: "price_math", status: "unknown", detail: "the product page showed " + usd(pagePrice) + " but the cart line is " + usd(price) + "; a variant price or a discount may explain it, so this needs a human" };
  }

  const expected = price * q - discount;
  const sum = q + " x " + usd(price) + (discount ? " - " + usd(discount) + " discount" : "") + " = " + usd(expected);
  if (subtotal === expected) return { id: "price_math", status: "pass", detail: sum + (qty ? "" : " (quantity not reported, one unit assumed)") };

  if (subtotal > expected) {
    if (!qty && price > 0 && subtotal % price === 0) {
      return { id: "price_math", status: "unknown", detail: "the subtotal " + usd(subtotal) + " is " + (subtotal / price) + " x " + usd(price) + " but the quantity was not reported (a minimum order quantity would explain it)" };
    }
    return { id: "price_math", status: "fail", detail: q + " item" + (q === 1 ? "" : "s") + " at " + usd(price) + (discount ? " less a " + usd(discount) + " discount" : "") + " should be " + usd(expected) + " but the subtotal shows " + usd(subtotal) };
  }
  return { id: "price_math", status: "unknown", detail: "the subtotal " + usd(subtotal) + " is lower than " + sum + (noDiscount ? " and no discount was reported" : " and the discount shown does not explain the gap") + "; a coupon or automatic discount may apply, so this needs a human" };
}

// run: { status, reasonCode, summary, values: {shipping_promise, item_price, cart_subtotal, shipping_line}, stepCount }
function evaluate(run, opts = {}) {
  const budget = opts.stepBudget || 20;
  const checks = [];

  // 1. Did the shopper get from the product page to checkout? Many real stores
  // ask for contact details before the payment step. Cartwalk never fills in
  // personal details, so reaching that form counts as reaching checkout, and
  // the detail says payment itself was not probed.
  const stage = String((run.values || {}).checkout_stage || "").toLowerCase();
  // Only a bug Kane CONFIRMED in the store counts as a store failure. Kane also
  // ends "failed" when it cannot follow the instruction (no banner to read, a
  // layout it did not expect, a final check it could not satisfy). That is the
  // shopper's problem, not the store's, so it is unknown and never sent to the
  // coding agent. Seen in real runs: a confirmed bug ends assertion_error.confirmed_product_bug;
  // false alarms ended step_not_achievable (Medusa, no banner) and final_verification (Saleor).
  if (run.status === "failed" && /confirmed_product_bug/.test(run.reasonCode || "")) {
    checks.push({ id: "reached_checkout", status: "fail", detail: run.summary || "the shopper did not reach checkout" });
  } else if (run.status === "failed") {
    const why = String(run.summary || "").split("\n")[0].slice(0, 200);
    checks.push({ id: "reached_checkout", status: "unknown", detail: "Kane could not follow the instruction here (" + (run.reasonCode || "no reason given") + "), which is not evidence of a store bug: " + why });
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

  // 3. Does the cart add up? See priceMath: quantity, a discount line and the product-page price are
  // taken into account, and anything ambiguous is "unknown", never a fail the coding agent would act on.
  checks.push(priceMath(v));

  // 4. Does the store keep its shipping promise?
  if (run.status === "passed" && /^\s*(none|no\b|n\/a|not shown)/i.test(String(v.shipping_promise || ""))) {
    checks.push({ id: "shipping_promise", status: "na", detail: "the store shows no free-shipping promise, so there was nothing to check" });
  } else if (threshold == null) {
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

module.exports = { evaluate, parseMoney, parsePromiseThreshold, parseQuantity };
