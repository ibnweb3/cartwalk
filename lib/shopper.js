// The one instruction every store gets. Plain English, no selectors, so the
// same objective works on a store we have never seen. It stops at the payment
// page and never pays.
const SHOPPER_OBJECTIVE = [
  "You are a shopper who wants to buy one item.",
  "If the page shows a free-shipping promise, read it and remember it as shipping_promise, and if it shows none, remember shipping_promise as none and carry on.",
  "Choose the most expensive product, select an option if one is required, remember the price the product page shows for that choice as page_price, and add exactly one to the cart.",
  "Open the cart.",
  "Remember the item price shown in the cart as item_price, the quantity as item_quantity, any discount, coupon or promotion line as discount_line (or none), the subtotal as cart_subtotal and the shipping line as shipping_line.",
  "Click Checkout. Look at the page it leads to and remember checkout_stage as payment if it asks for card or payment details, contact if it asks for contact, address or shipping details first, or other if it is neither.",
  "Do not type into any field on the checkout pages and never pay.",
].join(" ");

module.exports = { SHOPPER_OBJECTIVE };
