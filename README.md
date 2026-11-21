# Cartwalk

**Can an AI agent buy from your store?**

More people now ask an AI to do their shopping. If a popup it can't close, a button it can't press, or a banner that disagrees with the cart stops it, you lose the sale and never see an error. Cartwalk sends a shopper to find out.

Built for the KaneCLI Online Hackathon (12-26 Nov 2026).

**Site and setup guide:** https://ibnweb3.github.io/cartwalk/ (a replay of the recorded run, the in-browser log verifier, and [setup for any machine and any store](https://ibnweb3.github.io/cartwalk/setup.html)).

**Demo video (2:21):** https://youtu.be/B42H6Kr8POM

## How it works

1. **Kane walks the store.** [Kane CLI](https://github.com/LambdaTest/kane-cli) acts as the shopper in a real Chrome. In plain English, with no selectors, it reads the shipping promise, picks the most expensive product, adds one to the cart, opens the cart, and clicks Checkout. It looks at what Checkout leads to. It is told to type nothing into the checkout pages and never to pay.
2. **Plain code judges.** Kane reports what it saw (banner text, item price, subtotal, shipping line). `lib/rules.js` decides with arithmetic and comparisons, never with a model's opinion: did it reach checkout, in how many steps, does price x quantity equal the subtotal, does the store keep its free-shipping promise.
3. **A coding agent fixes it.** Failed checks and Kane's evidence go to Claude Code, started inside the store's folder with read and edit tools only (no shell). Its diff is logged.
4. **Kane walks again.** The agent's fix only counts if the next walk passes.
5. **Every step is in a hash-chained log.** `cartwalk verify` tells you if anything in the middle was edited or removed.

## A recorded run

`docs/demo-run/loop.jsonl` is the real log of one run against `store/`, a small shop with two ordinary mistakes planted in it. The fixes the agent made are in `docs/demo-run/fixes-applied.diff`.

| Round | Result | What happened |
|---|---|---|
| 1 | FAIL | The Desk Lamp cannot be added to the cart (`POST /api/cart` returns 500, the button stays on "Adding..."). The agent makes the cart look the lamp up the same way the product page does. |
| 2 | FAIL | The cart works, but the banner promises free shipping over $50 and a $55 cart is charged $4.99. The agent ties the threshold to the banner's number. |
| 3 | PASS | Reached the payment page, the arithmetic matches, shipping is free. |

Each walk took 2.5 to 4 minutes and 25 to 45 Kane credits; the whole run was about 10 minutes. This is the run made with the current rules and shopper instruction. The agent's fixes differ a little between runs, so the log and the diff go together.

## On stores I did not build

Saleor's public demo, one walk, `docs/third-party/saleor-demo.jsonl`: PASS in 4 minutes and 53 credits. Kane read the banner ("Free shipping on orders over $75.00"), picked a $300.00 item, and the cart showed $300.00 with free shipping. Checkout asked for contact details first, so the result says payment was not probed. Cartwalk does not fill in contact details, so a rule that demanded the payment page would blame a working store for that limit. An earlier walk, `docs/third-party/saleor-demo-attempt-2.jsonl`, shows it: Kane read the same price, subtotal and free shipping correctly, but the old rule failed "reached payment" at the contact-details step. The rule now counts that step as reached (`lib/rules.js`, covered in `test/rules.test.js`), so the coding agent is not sent to "fix" a working store. A first attempt ran out of time and was reported inconclusive; its log was not kept.

### A catch on Medusa's public demo

`docs/third-party/medusa-demo.jsonl` ([report](docs/third-party/medusa-demo-report.html)): Kane tried to add a pair of headphones to the cart and ended with `confirmed_product_bug`. Its evidence is the request `POST https://next.medusajs.com/dk/products/wireless-over-ear-headphones?v_id=... -> 500` and a matching console error, and the page never added the item. I saw the same 500 in two earlier direct Kane runs on that demo. It may be a problem with that demo's backend and not with Medusa's code, and I have not reported it to them. The run is 10 steps, 268 seconds and 55 credits.

An earlier Cartwalk walk of the same demo taught me something: Medusa has no free-shipping banner, so Kane stopped at step 1 ("step not achievable") and Cartwalk reported a store failure. That was wrong. Kane also ends "failed" when it cannot follow the instruction, which is not evidence of a store bug. Cartwalk now treats only `confirmed_product_bug` as a store failure (every real bug in my logs carried it, both false alarms did not), everything else is "unknown" with Kane's own words, and a missing banner is "none" and "n/a". That earlier log was not kept.

## Try it

You need Node 20+, [Kane CLI](https://github.com/LambdaTest/kane-cli) logged in with Google Chrome installed, and, for the fix loop, the Claude Code CLI (`claude`) logged in.

```bash
git clone https://github.com/ibnweb3/cartwalk && cd cartwalk
npm test                                   # unit tests, no network

# walk and judge any store (spends Kane credits; never pays)
node bin/cartwalk.js check https://your-store.example

# walk, fix, walk again on the bundled broken store
# (spends Kane credits and several minutes; the recorded run took three walks)
node bin/cartwalk.js loop http://localhost:4180 --fix-dir store --serve store/server.js

# was the log edited?
node bin/cartwalk.js verify --log docs/demo-run/loop.jsonl

# edit a COPY of the log (a failed check becomes a pass) and watch verify catch it
node bin/cartwalk.js tamper docs/demo-run/loop.jsonl

# one-page HTML report, with a button that re-checks the hash chain in the browser
node bin/cartwalk.js report docs/demo-run/loop.jsonl --out report.html
```

`check` and `loop` exit 0 on pass, 1 on fail, 2 when the run was inconclusive or could not start. `verify` exits 0 when the chain is intact and 1 when it is broken. A Kane run that ends stuck is retried once and never recorded as a store failure.

## What it does not do

- It has been run on two stores I did not build, once each: Saleor's public demo (a pass) and Medusa's public demo (a confirmed 500 on add to cart). Two walks are not a benchmark.
- Many real stores ask for contact details before payment. Cartwalk types nothing into checkout, so there it reports that checkout was reached and says payment itself was not probed.
- The coding agent has no shell, so it cannot run the store itself. Kane's next walk is the only proof a fix worked.
- It tests one flow (most expensive product, one unit, to checkout). It does not test coupons, logins, guest versus account checkout, or real payment.
- The log catches edits and deletions in the middle. It cannot catch entries cut off the end; publish the `head` hash somewhere else to cover that.
- Kane's runs can be slow or end stuck, and `--timeout` is not always honoured while a page request hangs, so Cartwalk enforces its own hard limit.

## Layout

| Path | What it is |
|---|---|
| `bin/cartwalk.js` | the CLI: `check`, `loop`, `verify`, `report`, `tamper` |
| `lib/kane.js` | runs Kane and parses its NDJSON stream |
| `lib/shopper.js` | the one plain-English instruction every store gets |
| `lib/rules.js` | the deciding code |
| `lib/fix.js` | hands failures to the coding agent and records its diff |
| `lib/log.js` | the hash-chained log |
| `lib/report.js` | the one-page HTML report and its in-browser verifier |
| `lib/theme.js` | the dark theme shared by the report and the site |
| `scripts/build-site.js`, `scripts/site/` | build the hosted site in `docs/` from the recorded log (`npm run build:pages`; preview with `npm run preview`) |
| `scripts/taste.js` | `npm run taste`: start the broken shop and send one real Kane shopper |
| `lib/sha256-fallback.js` | SHA-256 for the report on pages where the browser's crypto is unavailable |
| `test/` | unit tests, run by `npm test` |
| `store/` | the broken demo store the agent repairs |
| `docs/demo-run/`, `docs/third-party/` | the two recorded logs above (do not edit; `verify` would fail) |
| `docs/kane-findings.md` | measured notes on Kane from an earlier experiment |
| `demo-shop/`, `checks/` | that earlier experiment's test bed, kept as the record; not part of Cartwalk |

## License

Apache-2.0
