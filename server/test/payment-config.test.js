// Unit tests for semester payment configuration.
// Amount is always ₹9 server-side. Missing/invalid UPI or end date fails closed.

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

function loadConfig() {
  const full = require.resolve(path.join(__dirname, "..", "src", "config", "paymentConfig.js"));
  delete require.cache[full];
  const envFull = require.resolve(path.join(__dirname, "..", "src", "config", "env.js"));
  delete require.cache[envFull];
  return require("../src/config/paymentConfig");
}

test("uses a fixed ₹9 amount regardless of environment amount overrides", function () {
  process.env.PAYMENT_UPI_ID = "owner@upi";
  process.env.PAYMENT_PAYEE_NAME = "StudyKarle";
  process.env.PAYMENT_ACCESS_ENDS_AT = "2099-12-31T23:59:59.000Z";
  process.env.PAYMENT_AMOUNT = "499";
  const cfg = loadConfig().getPaymentConfig();
  assert.equal(cfg.amountRupees, 9);
  assert.equal(cfg.amountFormatted, "9.00");
  assert.equal(cfg.currency, "INR");
  assert.equal(cfg.available, true);
});

test("fails closed when UPI ID is missing", function () {
  process.env.PAYMENT_UPI_ID = "";
  process.env.PAYMENT_PAYEE_NAME = "StudyKarle";
  process.env.PAYMENT_ACCESS_ENDS_AT = "2099-12-31T23:59:59.000Z";
  const cfg = loadConfig().getPaymentConfig();
  assert.equal(cfg.available, false);
  assert.match(String(cfg.unavailableReason), /upi/i);
});

test("fails closed when UPI ID is invalid", function () {
  process.env.PAYMENT_UPI_ID = "not-an-upi";
  process.env.PAYMENT_PAYEE_NAME = "StudyKarle";
  process.env.PAYMENT_ACCESS_ENDS_AT = "2099-12-31T23:59:59.000Z";
  const cfg = loadConfig().getPaymentConfig();
  assert.equal(cfg.available, false);
});

test("fails closed when semester end date is missing", function () {
  process.env.PAYMENT_UPI_ID = "owner@upi";
  process.env.PAYMENT_PAYEE_NAME = "StudyKarle";
  process.env.PAYMENT_ACCESS_ENDS_AT = "";
  const cfg = loadConfig().getPaymentConfig();
  assert.equal(cfg.available, false);
  assert.match(String(cfg.unavailableReason), /end/i);
});

test("fails closed when semester end date is invalid", function () {
  process.env.PAYMENT_UPI_ID = "owner@upi";
  process.env.PAYMENT_PAYEE_NAME = "StudyKarle";
  process.env.PAYMENT_ACCESS_ENDS_AT = "not-a-date";
  const cfg = loadConfig().getPaymentConfig();
  assert.equal(cfg.available, false);
});

test("fails closed when semester end date is in the past", function () {
  process.env.PAYMENT_UPI_ID = "owner@upi";
  process.env.PAYMENT_PAYEE_NAME = "StudyKarle";
  process.env.PAYMENT_ACCESS_ENDS_AT = "2020-01-01T00:00:00.000Z";
  const cfg = loadConfig().getPaymentConfig();
  assert.equal(cfg.available, false);
});

test("accepts a valid UPI ID and future end date", function () {
  process.env.PAYMENT_UPI_ID = "studykarle@oksbi";
  process.env.PAYMENT_PAYEE_NAME = "StudyKarle";
  process.env.PAYMENT_ACCESS_ENDS_AT = "2099-06-30T18:30:00.000Z";
  const cfg = loadConfig().getPaymentConfig();
  assert.equal(cfg.available, true);
  assert.equal(cfg.upiId, "studykarle@oksbi");
  assert.equal(cfg.payeeName, "StudyKarle");
  assert.ok(cfg.accessEndsAt instanceof Date);
});
