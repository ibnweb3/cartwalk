# Launch post drafts (not posted)

## X: post 1 (the problem)

More people are asking AI agents to shop for them.

A store that works for you can quietly fail for an agent: an Add to cart that does nothing, a free-shipping banner the cart ignores.

No error. Just a sale you never knew you lost.

## X: reply to post 1 (the build)

That is why I built Cartwalk for the KaneCLI hackathon.

A Kane CLI shopper walks your store in a real Chrome and never pays. Plain code (not a model) judges four checks. A coding agent fixes what fails. Kane walks again to prove the fix.

On Medusa's public demo, Kane confirmed a 500 on add to cart.

Demo (2:21): https://youtu.be/B42H6Kr8POM
Code: https://github.com/ibnweb3/cartwalk

## LinkedIn

Can an AI agent buy from your store?

More shoppers are starting to ask an AI agent to buy for them. A store that works fine for a person can quietly fail for an agent: an Add to cart button that does nothing, a free-shipping banner the cart contradicts. No error is shown, so you never learn you lost the sale.

I built Cartwalk for the KaneCLI Online Hackathon (TestMu AI). A Kane CLI shopper walks a store in a real Chrome, reads the shipping promise, adds the most expensive item, opens the cart and presses Checkout, and never pays. Plain code decides four checks: did it reach checkout, step budget, price equals subtotal, shipping promise kept. A coding agent (Claude Code) fixes what fails, Kane walks again to prove the fix, and every step goes into a hash-chained log you can verify in the browser.

On a demo shop with two planted mistakes it went fail, fail, pass. Walked once each, Saleor's public demo passed, and on Medusa's public demo Kane confirmed a 500 on add to cart (that may be the demo's backend, not Medusa's code). Two stores is not a benchmark.

Demo (2:21): https://youtu.be/B42H6Kr8POM
Code: https://github.com/ibnweb3/cartwalk
Site and setup guide: https://ibnweb3.github.io/cartwalk/

## Hacker News

Title: Show HN: Cartwalk, an AI shopper that tests your store and gets the bug fixed
URL: https://github.com/ibnweb3/cartwalk
First comment: Built for the KaneCLI hackathon. Kane CLI is the shopper (one plain-English instruction, no selectors), plain code judges the result, a coding agent fixes the store's code, Kane re-walks. Limits: two outside stores walked once each, Windows only so far, payment not probed on stores that ask for contact details first. Demo: https://youtu.be/B42H6Kr8POM
