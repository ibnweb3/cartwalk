## One-liner (max 170)
Cartwalk sends a Kane CLI shopper through your store to checkout, judges it with plain code, has a coding agent fix failures, and Kane re-walks to prove the fix.

## Project details (max 1500)
Cartwalk tests a store the way an AI shopping agent would use it. More shoppers now ask an agent to buy for them, and a store that works for a person can quietly fail for an agent: an Add to cart that does nothing, a free-shipping banner the cart contradicts. No error, just a lost sale. It is for anyone who runs an online store.

What Kane CLI does: Kane is the shopper and the evidence. One plain-English instruction (no selectors) drives a real Chrome: read the shipping promise, add the most expensive item, open the cart, press Checkout, never pay. Kane reports the exact failed request, the values it read, and a verdict with a reason code. Only a bug Kane confirms counts as a store failure.

Plain code, not a model, then decides four checks: reached checkout, step budget, price equals subtotal, shipping promise kept. A value Kane did not report counts as unknown, never a pass.

Claude Code then fixes the store's code from Kane's evidence (it can only read and edit), and Kane walks again. That second walk is the only proof the fix worked. Every step goes into a SHA-256 hash-chained log you can verify in your browser.

## Anything else to add
How the agent and Kane talk: my CLI runs `kane-cli run --agent --headless` and reads its NDJSON (status, reason code, extracted values, failed request). Claude Code gets Kane's evidence as its prompt and edits the store's files. After the edit, the CLI starts Kane again and the next walk's result is judged by the same code. The agent never calls Kane itself and never decides pass or fail.

What Kane caught: on a demo shop with two planted bugs, a stuck Add to cart (POST /api/cart returned 500) and a free-shipping banner the cart ignored, the run went FAIL, FAIL, PASS. On Saleor's public demo, Kane walked to checkout and it passed. On Medusa's public demo, Kane confirmed a 500 on add to cart (it may be that demo's backend, not Medusa's code). Two outside stores, once each: not a benchmark.

Run it: npx github:ibnweb3/cartwalk help, or npm run taste for one real Kane walk. Setup guide, recorded runs and the log verifier: https://ibnweb3.github.io/cartwalk/
Demo video: https://youtu.be/B42H6Kr8POM

Limits: Windows 11 only so far, CI use untested, payment not probed on stores that ask for contact details first. Next: macOS and Linux, a CI mode.
