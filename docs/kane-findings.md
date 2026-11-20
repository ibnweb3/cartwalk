# What we measured about Kane CLI (2026-11-20)

All runs: Kane CLI 0.10.6, Windows 11, headless, against `demo-shop/` on localhost.
Browser: Playwright Chromium (Google Chrome is not installed here; Brave gave the same results).

## Works reliably
- `kane-cli run "<objective>" --agent` returns NDJSON ending in a `run_end` event and exit code 0 (pass) or 1 (fail).
- **Red case caught every time it completed:** with the hidden 500 on coupon orders, the run fails with
  `reason_code: assertion_error.confirmed_product_bug` and the summary quotes the evidence, for example
  `network_failure: POST http://localhost:4173/api/order -> 500 body: {"error":"coupon lookup failed"}`
  and the matching `console_error`. It also adds a one-line fix hint. 6 of 8 runs with explicit
  "no 5xx / no console errors" assertions on the buggy shop gave this result; the other 2 failed with a capture timeout.
- A visual-only check ("Order placed" is on screen) **passes on the buggy shop**. That is the gap Notyet fills.
- `kane-cli evidence verdict <pack> --policy checks/notyet.policy.yaml` works: it returned `fail` and named the failed gates.
- Cost: roughly 10-45 credits per run, 25-45 for runs with network/console assertions.

## Does not work yet
- **Green case is unreliable.** On the fixed shop, runs with network/console assertions ended `stuck.ap_stuck` or
  `assertion_error.step_not_achievable` in 11 of 11 attempts, even though the order, the visible text and the
  "no 5xx" check had passed. Kane's own summary said the checks had passed.
- Asserting a positive network fact ("the POST returned 200") timed out every time. Absence checks
  ("no 5xx", "no console errors") are the ones that evaluate.
- `--bug-detection stop` did NOT catch the 500 (the run passed).
- Splitting the checks into a separate `testmd` step fails: network/console capture only exists in the same run as the action.
  `testmd` also replays cached steps against the first URL, so `--url` is ignored on replay.
- Policy metrics are test counts, failed steps and flaky rate only. There is no network-status metric, so "no 5xx"
  must be an assertion in the objective, with the policy gating on failed steps.

## A real catch along the way
The first "fixed" shop still failed because it returned 404 for `/favicon.ico`, a genuine console error. Fixed in `demo-shop/server.js`.
