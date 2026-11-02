import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEmail,
  validateLogin,
  validateSignup,
  validatePasswordChange,
  validatePaymentProof,
  firstInvalidField,
  mergeServerFieldErrors,
} from "../../client/src/utils/formValidation.js";

test("validateEmail requires a value and a valid address", () => {
  assert.equal(validateEmail(""), "Enter your email address");
  assert.equal(validateEmail("not-an-email"), "Enter a valid email address");
  assert.equal(validateEmail("you@example.com"), null);
});

test("validateLogin reports field-specific errors and keeps other fields", () => {
  const result = validateLogin({ email: "", password: "" });
  assert.equal(result.email, "Enter your email address");
  assert.equal(result.password, "Enter your password");
  assert.equal(firstInvalidField(result), "email");

  const mixed = validateLogin({ email: "you@example.com", password: "" });
  assert.equal(mixed.email, undefined);
  assert.equal(mixed.password, "Enter your password");
});

test("validateSignup matches backend name, email, and password rules", () => {
  const short = validateSignup({ name: "A", email: "bad", password: "secret" });
  assert.equal(short.name, "Name must be at least 2 characters");
  assert.equal(short.email, "Enter a valid email address");
  assert.equal(short.password, "Password must be at least 8 characters");

  const noDigit = validateSignup({
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "longpassword",
  });
  assert.equal(noDigit.password, "Password must contain at least one number");

  const ok = validateSignup({
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "longpass1",
  });
  assert.equal(Object.keys(ok).length, 0);
});

test("validatePasswordChange requires the current password and backend new-password rules", () => {
  const empty = validatePasswordChange({ currentPassword: "", newPassword: "" });
  assert.equal(empty.currentPassword, "Enter your current password");
  assert.equal(empty.newPassword, "New password must be at least 8 characters");

  const ok = validatePasswordChange({
    currentPassword: "oldpass1",
    newPassword: "newpass2",
  });
  assert.equal(Object.keys(ok).length, 0);
});

test("mergeServerFieldErrors attaches API messages to fields without wiping valid values", () => {
  const next = mergeServerFieldErrors(
    { email: undefined, password: undefined },
    { details: { email: "This email is already registered" } }
  );
  assert.equal(next.email, "This email is already registered");
  assert.equal(next.password, undefined);
});

test("validatePaymentProof requires a JPEG, PNG, or WEBP screenshot under 5MB", () => {
  const missing = validatePaymentProof({ file: null });
  assert.equal(missing.screenshot, "Upload a payment screenshot first.");

  const pdf = validatePaymentProof({ file: { type: "application/pdf", size: 1200 } });
  assert.equal(pdf.screenshot, "Use a JPEG, PNG, or WEBP image.");

  const tooBig = validatePaymentProof({
    file: { type: "image/jpeg", size: 5 * 1024 * 1024 + 1 },
  });
  assert.equal(tooBig.screenshot, "Screenshot must be 5MB or smaller.");

  const ok = validatePaymentProof({ file: { type: "image/png", size: 2048 } });
  assert.equal(Object.keys(ok).length, 0);
});
