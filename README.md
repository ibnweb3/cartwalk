# Cartwalk

**Can an AI agent buy from your store?**

More people now ask an AI to do their shopping. If a popup it can't close, a button it can't press, or a banner that disagrees with the cart stops it, you lose the sale and never see an error. Cartwalk sends a shopper to find out.

Built for the KaneCLI Online Hackathon (12-26 Nov 2026).

## How it works

1. **Kane walks the store.** [Kane CLI](https://github.com/LambdaTest/kane-cli) acts as the shopper in a real Chrome. In plain English, with no selectors, it reads the shipping promise, picks the most expensive product, adds one to the cart, opens the cart, and clicks Checkout. It stops at the payment page and never pays.
2. **Plain code judges.** Kane reports what it saw (banner text, item price, subtotal, shipping line). `lib/rules.js` decides with arithmetic and comparisons, never with a model's opinion: did it reach payment, in how many steps, does price x quantity equal the subtotal, does the store keep its free-shipping promise.
3. **A coding agent fixes it.** Failed checks and Kane's evidence go to Claude Code, which may edit only the store's folder. Its diff is logged.
4. **Kane walks again.** The agent's fix only counts if the next walk passes.
5. **Every step is in a hash-chained log.** `cartwalk verify` tells you if anything in the middle was edited or removed.

## A recorded run

`docs/demo-run/loop.jsonl` is the real log of one run against `store/`, a small shop with two ordinary mistakes planted in it. The fixes the agent made are in `docs/demo-run/fixes-applied.diff`.

| Round | Result | What happened |
|---|---|---|
| 1 | FAIL | The Desk Lamp cannot be added to the cart (`POST /api/cart` returns 500, the button stays on "Adding..."). The agent adds the lamp to the product table. |
| 2 | FAIL | The cart works, but the banner promises free shipping over $50 and a $55 cart is charged $4.99. The agent ties the threshold to the banner's number. |
| 3 | PASS | Reached the payment page, the arithmetic matches, shipping is free. |

Each walk took 2-3 minutes and 29-41 Kane credits.

## Try it

You need Node 20+, [Kane CLI](https://github.com/LambdaTest/kane-cli) logged in with Google Chrome installed, and, for the fix loop, the Claude Code CLI (`claude`) logged in.

```bash
git clone https://github.com/ibnweb3/cartwalk && cd cartwalk
npm test                                   # 16 unit tests, no network

# walk and judge any store (never pays)
node bin/cartwalk.js check https://your-store.example

# walk, fix, walk again on the bundled broken store (about 10 minutes)
node bin/cartwalk.js loop http://localhost:4180 --fix-dir store --serve store/server.js

# was the log edited?
node bin/cartwalk.js verify --log docs/demo-run/loop.jsonl
```

`check` exits 0 on pass, 1 on fail, 2 when the run was inconclusive. A Kane run that ends stuck is retried once and never recorded as a store failure.

## What it does not do

- It has not been run against a store I did not build. A public demo storefront I tried (Medusa's) failed before the cart: its add-to-cart returned 500 in two of two runs, which may be a problem with that demo backend.
- The coding agent could not run the store itself in either recorded run. Kane's next walk is the only proof a fix worked.
- It tests one flow (most expensive product, one unit, to the payment page). It does not test coupons, logins, guest versus account checkout, or real payment.
- The log catches edits and deletions in the middle. It cannot catch entries cut off the end; publish the `head` hash somewhere else to cover that.
- Kane's runs can be slow or end stuck, and `--timeout` is not always honoured while a page request hangs, so Cartwalk enforces its own hard limit.

## Layout

| Path | What it is |
|---|---|
| `bin/cartwalk.js` | the CLI: `check`, `loop`, `verify` |
| `lib/kane.js` | runs Kane and parses its NDJSON stream |
| `lib/shopper.js` | the one plain-English instruction every store gets |
| `lib/rules.js` | the deciding code |
| `lib/fix.js` | hands failures to the coding agent and records its diff |
| `lib/log.js` | the hash-chained log |
| `store/` | the broken demo store the agent repairs |
| `docs/kane-findings.md` | measured notes on what Kane does well and badly |

## License

Apache-2.0
