// The one instruction every store gets. Plain English, no selectors, so the
// same objective works on a store we have never seen. It stops at the payment
// page and never pays.
const SHOPPER_OBJECTIVE = [
  "You are a shopper who wants to buy one item.",
  "Read the free-shipping promise in the banner at the top of the page and remember it as shipping_promise.",
  "Choose the most expensive product, select an option if one is required, and add exactly one to the cart.",
  "Open the cart.",
  "Remember the item price shown in the cart as item_price, the subtotal as cart_subtotal and the shipping line as shipping_line.",
  "Click Checkout and check that a page asking for payment details appears.",
  "Do not type into any payment field and never pay.",
].join(" ");

module.exports = { SHOPPER_OBJECTIVE };
