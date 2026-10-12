process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.RESEND_API_KEY = "re_dummy";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  inspectEmail,
  isDisposableEmail,
  assertNotDisposable,
  DISPOSABLE_MESSAGE,
} = require("../src/services/disposableEmailService");
const { normalizeEmail, extractDomain, isWellFormedEmail } = require("../src/utils/email");

test("normalizes whitespace and domain case", () => {
  assert.equal(normalizeEmail("  Student@Example.COM  "), "student@example.com");
  assert.equal(extractDomain("Student@Example.COM"), "example.com");
});

test("rejects malformed emails", () => {
  assert.equal(isWellFormedEmail(""), false);
  assert.equal(isWellFormedEmail("not-an-email"), false);
  assert.equal(inspectEmail("not-an-email").reason, "malformed");
  assert.equal(inspectEmail("").reason, "malformed");
  assert.equal(inspectEmail(null).reason, "malformed");
});

test("flags known disposable domains and subdomains", () => {
  assert.equal(isDisposableEmail("user@mailinator.com"), true);
  assert.equal(isDisposableEmail("User@Yopmail.COM"), true);
  assert.equal(isDisposableEmail("a@guerrillamail.com"), true);
  assert.equal(isDisposableEmail("a@temp-mail.org"), true);
  assert.equal(inspectEmail("a@trashmail.com").reason, "disposable");
  assert.equal(isDisposableEmail("alias@sub.mailinator.com"), true);
});

test("allows permanent providers", () => {
  assert.equal(isDisposableEmail("student@gmail.com"), false);
  assert.equal(isDisposableEmail("dean@university.edu"), false);
  assert.equal(inspectEmail("ok@outlook.com").reason, "allowed");
});

test("assertNotDisposable throws the public message", () => {
  assert.throws(
    () => assertNotDisposable("x@mailinator.com"),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.message, DISPOSABLE_MESSAGE);
      return true;
    }
  );
  assert.doesNotThrow(() => assertNotDisposable("ok@gmail.com"));
});

test("login blocks disposable emails before password checks", async () => {
  const path = require("path");
  const full = require.resolve(
    path.join(__dirname, "..", "src", "models", "userModel.js")
  );
  require.cache[full] = {
    id: full,
    filename: full,
    loaded: true,
    exports: {
      async findByEmail() {
        throw new Error("findByEmail should not run for disposable emails");
      },
    },
  };
  delete require.cache[require.resolve("../src/services/authService")];
  const authService = require("../src/services/authService");

  await assert.rejects(
    () => authService.login("nobody@mailinator.com", "Password1"),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.message, DISPOSABLE_MESSAGE);
      return true;
    }
  );
  await assert.rejects(
    () => authService.login("legacy@mailinator.com", "Password1"),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.message, DISPOSABLE_MESSAGE);
      return true;
    }
  );
});
