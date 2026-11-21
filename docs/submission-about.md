# Submission About text (paste into the form)

**Cartwalk: can an AI agent buy from your store?**

Cartwalk tests a store the way an AI shopping agent would use it. A Kane CLI shopper opens the store in a real Chrome, reads the free-shipping promise, adds the most expensive item to the cart, and presses Checkout. It never pays and never types into a checkout field. Plain code (lib/rules.js, no model) then decides four checks: did it reach checkout, did the shopper stay within a step budget, does the price equal the subtotal, and does the store keep its free-shipping promise. A value Kane did not report counts as unknown, never as a pass.

**Which agent.** Claude Code (`claude -p`, allowed only Read, Edit, Glob and Grep, run in the store's folder). When a check fails it reads Kane's evidence and fixes the store's code. It has no shell and cannot run the store.

**What Kane CLI does.** Kane is the shopper and the verifier. One plain-English instruction drives `kane-cli run --agent --headless` on any store, with no selectors. Kane reports the exact failed request (for example `POST /api/cart -> 500`), the values it read from the page, and a verdict with a reason code. Only a bug Kane confirms (`confirmed_product_bug`) counts as a store failure. After the agent edits the code, Kane walks the store again, and that second walk is the only proof the fix worked.

**The loop.** Kane walks, plain code judges, the agent fixes, Kane walks again. On the included demo shop (two planted mistakes), the recorded run went FAIL, FAIL, PASS. Every walk, verdict and fix goes into a SHA-256 hash-chained log; editing or deleting an entry in the middle breaks verification, and the report page lets you try it in the browser.

**Outside stores.** The same instruction, unchanged, walked two public demos I did not build, once each. Saleor passed (it asks for contact details before payment, so payment itself was not probed). On Medusa's public demo, Kane confirmed a 500 on add to cart (this may be that demo's backend, not Medusa's code). Two walks are not a benchmark.

**Demo video.** https://youtu.be/B42H6Kr8POM

**Try it.** `npx github:ibnweb3/cartwalk help`, or `npm run taste` to run one real Kane walk on the included demo shop. Setup guide and recorded run: https://ibnweb3.github.io/cartwalk/

**Fallback if Kane is slow or unavailable.** The recorded runs are in the repo and on the site: docs/demo-run/loop.jsonl (the full red-to-green loop), docs/third-party/ (Saleor and Medusa logs and reports), and the 2:21 demo video. Kane walks take 2.5 to 4.6 minutes and vary with the store.

**Honest limits.** Windows 11 only so far (macOS and Linux untested). CI use is untested. Payment is not probed on stores that ask for contact details first. The agent cannot run the store itself.
