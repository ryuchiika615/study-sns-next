const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("paid workbook is not placed in the public directory", () => {
  assert.equal(fs.existsSync("public/downloads/ryutter-deadline-rescue-semester.xlsx"), false);
  assert.equal(fs.existsSync("private/digital-products/ryutter-deadline-rescue-semester.xlsx"), true);
});

test("download route checks the signed-in user's entitlement", () => {
  const source = fs.readFileSync("src/app/api/digital-products/rescue-semester/download/route.ts", "utf8");
  assert.match(source, /auth\.getUser/);
  assert.match(source, /digital_product_orders/);
  assert.match(source, /user\.id/);
  assert.match(source, /status: 403/);
});

test("checkout and webhook share the same product key", () => {
  const checkout = fs.readFileSync("src/app/api/stripe/rescue-semester-checkout/route.ts", "utf8");
  const webhook = fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
  assert.match(checkout, /rescue_semester_v1/);
  assert.match(webhook, /rescue_semester_v1/);
  assert.match(webhook, /payment_status !== "paid"/);
});
