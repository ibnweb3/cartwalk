const test = require("node:test");
const assert = require("node:assert");
const { evaluate, parseMoney, parsePromiseThreshold } = require("../lib/rules");

const ok = { status: "passed", stepCount: 12, values: { checkout_stage: "payment" } };

test("parseMoney reads dollars, thousands and Free", () => {
  assert.equal(parseMoney("$55.00"), 5500);
  assert.equal(parseMoney("$1,234.50"), 123450);
  assert.equal(parseMoney("Free"), 0);
  assert.equal(parseMoney("Shipping: $4.99"), 499);
  assert.equal(parseMoney("n/a"), null);
  assert.equal(parseMoney(undefined), null);
});

test("parsePromiseThreshold reads common wordings and refuses others", () => {
  assert.equal(parsePromiseThreshold("Free shipping on orders over $50"), 5000);
  assert.equal(parsePromiseThreshold("FREE SHIPPING above $75.00"), 7500);
  assert.equal(parsePromiseThreshold("Free delivery on $60+"), 6000);
  assert.equal(parsePromiseThreshold("Big summer sale"), null);
});

test("a store that keeps its promise passes", () => {
  const r = evaluate({ ...ok, values: { checkout_stage: "payment", shipping_promise: "Free shipping on orders over $50", item_price: "$55.00", cart_subtotal: "$55.00", shipping_line: "Free" } });
  assert.equal(r.verdict, "pass");
});

test("the planted shipping bug fails with the numbers in the message", () => {
  const r = evaluate({ ...ok, values: { checkout_stage: "payment", shipping_promise: "Free shipping on orders over $50", item_price: "$55.00", cart_subtotal: "$55.00", shipping_line: "$4.99" } });
  assert.equal(r.verdict, "fail");
  const c = r.checks.find((x) => x.id === "shipping_promise");
  assert.equal(c.status, "fail");
  assert.match(c.detail, /\$50\.00.*\$55\.00.*\$4\.99/);
});

test("a cart below the threshold does not trigger the promise", () => {
  const r = evaluate({ ...ok, values: { checkout_stage: "payment", shipping_promise: "Free shipping on orders over $50", item_price: "$12.00", cart_subtotal: "$12.00", shipping_line: "$4.99" } });
  assert.equal(r.checks.find((x) => x.id === "shipping_promise").status, "na");
  assert.equal(r.verdict, "pass");
});

test("a subtotal that disagrees with the price fails", () => {
  const r = evaluate({ ...ok, values: { checkout_stage: "payment", shipping_promise: "x", item_price: "$20.00", cart_subtotal: "$22.00", shipping_line: "Free" } });
  assert.equal(r.checks.find((x) => x.id === "price_math").status, "fail");
});

test("missing values are unknown, never a quiet pass", () => {
  const r = evaluate({ ...ok, values: {} });
  assert.equal(r.verdict, "inconclusive");
});

test("a Kane failure is a failed reached_checkout check", () => {
  const r = evaluate({ status: "failed", reasonCode: "assertion_error.confirmed_product_bug", summary: "POST /api/cart -> 500", stepCount: 14, values: {} });
  assert.equal(r.verdict, "fail");
  assert.equal(r.checks[0].status, "fail");
});

test("too many steps fails the budget", () => {
  const r = evaluate({ ...ok, stepCount: 31, values: {} }, { stepBudget: 20 });
  assert.equal(r.checks.find((x) => x.id === "step_budget").status, "fail");
});

test("a checkout that asks for contact details first still counts as reached, and says payment was not probed", () => {
  const r = evaluate({ status: "passed", stepCount: 8, values: { checkout_stage: "contact", item_price: "$300.00", cart_subtotal: "$300.00", shipping_promise: "Free shipping on orders over $75.00", shipping_line: "Free" } });
  const c = r.checks.find((x) => x.id === "reached_checkout");
  assert.equal(c.status, "pass");
  assert.match(c.detail, /payment itself was not probed/);
  assert.equal(r.verdict, "pass");
});

test("pressing Checkout and landing somewhere else fails", () => {
  const r = evaluate({ status: "passed", stepCount: 8, values: { checkout_stage: "other" } });
  assert.equal(r.checks.find((x) => x.id === "reached_checkout").status, "fail");
});

test("a run that never says what Checkout led to is unknown, not a pass", () => {
  const r = evaluate({ status: "passed", stepCount: 8, values: {} });
  assert.equal(r.checks.find((x) => x.id === "reached_checkout").status, "unknown");
});

test("Kane failing because it could not follow the instruction is unknown, never a store failure", () => {
  for (const reasonCode of ["assertion_error.step_not_achievable", "assertion_error.final_verification", "stuck.ap_stuck"]) {
    const r = evaluate({ status: "failed", reasonCode, summary: "The test assumed a banner that is not there.", stepCount: 1, values: {} });
    const c = r.checks.find((x) => x.id === "reached_checkout");
    assert.equal(c.status, "unknown", reasonCode);
    assert.match(c.detail, /not evidence of a store bug/);
    assert.notEqual(r.verdict, "fail", reasonCode);
  }
});

test("a store with no free-shipping promise has nothing to check", () => {
  const r = evaluate({ status: "passed", stepCount: 7, values: { checkout_stage: "contact", shipping_promise: "none", item_price: "$30.00", cart_subtotal: "$30.00", shipping_line: "$5.00" } });
  const c = r.checks.find((x) => x.id === "shipping_promise");
  assert.equal(c.status, "na");
  assert.equal(r.verdict, "pass");
});
