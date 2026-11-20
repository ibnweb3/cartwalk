const test = require("node:test");
const assert = require("node:assert");
const { checkStoreUrl } = require("../lib/kane");

test("a plain http(s) store address is accepted", () => {
  assert.strictEqual(checkStoreUrl("http://localhost:4180"), "http://localhost:4180");
  assert.strictEqual(checkStoreUrl("https://demo.saleor.io/channel?x=1"), "https://demo.saleor.io/channel?x=1");
});

test("something that is not a web address is refused with a plain message", () => {
  assert.throws(() => checkStoreUrl("your-store.example"), /not a web address/);
  assert.throws(() => checkStoreUrl("file:///etc/passwd"), /http:\/\/ or https:\/\//);
});

test("shell syntax inside the address is refused", () => {
  assert.throws(() => checkStoreUrl("https://a.example/ & calc"), /unsafe/);
  assert.throws(() => checkStoreUrl("https://a.example/;rm"), /unsafe/);
  assert.throws(() => checkStoreUrl("https://a.example/$(x)"), /unsafe/);
});
