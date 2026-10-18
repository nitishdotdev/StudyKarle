// Endpoint wiring tests for the Google account-linking flow. The controller is
// real; its collaborator services and models are stubbed, so there is no
// database, network or Google call.
//
//   node --test test/google-link-endpoints.test.js

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.RESEND_API_KEY = "re_dummy";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI =
  "http://localhost:5000/api/auth/google/callback";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

function stub(rel, exports) {
  const full = require.resolve(path.join(__dirname, "..", "src", rel));
  require.cache[full] = {
    id: full,
    filename: full,
    loaded: true,
    exports: exports,
  };
}

const ApiError = require("../src/utils/ApiError");

// ---------------------------------------------------------------------------
// Mutable behaviour switches
// ---------------------------------------------------------------------------
let decision = { status: "authenticated", user: { id: 7 } };
let linkVerifyFails = false;
let cookieSet = null;
let createChallengeCalls = 0;
let challengeFails = false;
let oauthNotConfigured = false;

stub("services/authService.js", {});
stub("services/otpService.js", {});
stub("services/passwordResetService.js", {});
stub("services/disposableEmailService.js", { assertNotDisposable: function () {} });
stub("models/oauthLoginTicketModel.js", { create: async function () { return {}; } });

stub("services/tokenService.js", {
  signToken: function () {
    return "signed.jwt.token";
  },
  setAuthCookie: function (res, token) {
    cookieSet = token;
  },
  clearAuthCookie: function () {},
});

stub("models/userModel.js", {
  findById: async function (id) {
    return {
      id: id,
      token_version: 0,
      email: "existing@gmail.com",
      name: "Existing",
      role: "student",
      google_sub: null,
      password_hash: "hash",
    };
  },
  publicUser: function (u) {
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      google_linked: !!u.google_sub,
    };
  },
});

stub("services/googleAuthService.js", {
  safeRedirectPath: function (p) {
    if (typeof p === "string" && p.charAt(0) === "/" && p.indexOf("//") !== 0) {
      return p;
    }
    return "/dashboard";
  },
  findOrCreateFromGoogle: async function () {
    return decision;
  },
  verifyState: function () {
    return { n: "nonce-1", cv: "verifier-1", r: "/saved" };
  },
  exchangeCode: async function () {
    return { id_token: "google-id-token" };
  },
  verifyIdToken: async function () {
    return {
      sub: "google-sub",
      email: "existing@gmail.com",
      name: "Existing",
      picture: null,
    };
  },
  buildAuthorizationUrl: function () {
    if (oauthNotConfigured) {
      throw ApiError.badRequest("Google sign-in is not configured");
    }
    return "https://accounts.google.com/o/oauth2/v2/auth";
  },
});

stub("services/googleLinkService.js", {
  createChallenge: async function () {
    createChallengeCalls += 1;
    if (challengeFails) {
      throw ApiError.conflict(
        "This Google account is already linked to a different StudyKarle account. Please sign in with that Google account instead."
      );
    }
    return { ticket: "challenge-ticket-123" };
  },
  getChallengeInfo: async function () {
    return {
      email: "existing@gmail.com",
      name: "Existing",
      hasPassword: true,
      expiresAt: new Date(),
    };
  },
  completePasswordLink: async function () {
    if (linkVerifyFails) {
      throw ApiError.unauthorized("Incorrect password. Please try again.");
    }
    return {
      user: { id: 7, email: "existing@gmail.com", google_linked: true },
      redirect: "/saved",
    };
  },
  requestRecoveryOtp: async function () {
    return { email: "existing@gmail.com", expiresAt: new Date() };
  },
  verifyRecoveryOtp: async function () {
    return {
      user: { id: 7, email: "existing@gmail.com", google_linked: true },
      redirect: "/dashboard",
    };
  },
});

const controller = require("../src/controllers/authController");

function invoke(handler, req) {
  return new Promise(function (resolve, reject) {
    const res = {
      statusCode: 200,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (body) {
        resolve({ status: this.statusCode, body: body });
        return this;
      },
      redirect: function (url) {
        resolve({ redirect: url });
        return this;
      },
      append: function () {
        return this;
      },
      setHeader: function () {},
    };
    handler(req, res, function (err) {
      if (err) reject(err);
    });
  });
}

test.beforeEach(function () {
  decision = { status: "authenticated", user: { id: 7 } };
  linkVerifyFails = false;
  cookieSet = null;
  createChallengeCalls = 0;
  challengeFails = false;
  oauthNotConfigured = false;
});

test("callback with an existing linked account redirects to the completion page", async () => {
  const out = await invoke(controller.googleCallback, {
    query: { code: "code", state: "state" },
  });
  assert.ok(out.redirect.indexOf("http://localhost:5173/auth/google/complete?") === 0);
  assert.ok(out.redirect.indexOf("ticket=") !== -1);
  assert.equal(createChallengeCalls, 0);
});

test("callback with an existing password account redirects to the linking screen", async () => {
  decision = { status: "link_required", user: { id: 7 } };
  const out = await invoke(controller.googleCallback, {
    query: { code: "code", state: "state" },
  });
  assert.equal(
    out.redirect,
    "http://localhost:5173/auth/google/link?ticket=challenge-ticket-123"
  );
  assert.equal(createChallengeCalls, 1);
  // No raw claims (email) in the redirect.
  assert.ok(out.redirect.indexOf("existing@gmail.com") === -1);
});

test("callback with a password-less account redirects to the linking screen", async () => {
  decision = { status: "recovery_required", user: { id: 7 } };
  const out = await invoke(controller.googleCallback, {
    query: { code: "code", state: "state" },
  });
  assert.ok(out.redirect.indexOf("/auth/google/link?ticket=") !== -1);
});

test("googleLinkInfo returns the server-validated email and password requirement", async () => {
  const out = await invoke(controller.googleLinkInfo, { body: { ticket: "t" } });
  assert.equal(out.status, 200);
  assert.equal(out.body.data.email, "existing@gmail.com");
  assert.equal(out.body.data.hasPassword, true);
});

test("googleLinkVerify issues a session cookie on success", async () => {
  const out = await invoke(controller.googleLinkVerify, {
    body: { ticket: "t", password: "Correct123" },
  });
  assert.equal(out.status, 200);
  assert.equal(out.body.data.user.google_linked, true);
  assert.equal(out.body.data.redirect, "/saved");
  assert.equal(cookieSet, "signed.jwt.token");
});

test("googleLinkVerify rejects an incorrect password and sets no cookie", async () => {
  linkVerifyFails = true;
  await assert.rejects(
    () =>
      invoke(controller.googleLinkVerify, {
        body: { ticket: "t", password: "Wrong" },
      }),
    /incorrect password/i
  );
  assert.equal(cookieSet, null);
});

test("googleLinkRecoveryRequest returns the delivery acknowledgement", async () => {
  const out = await invoke(controller.googleLinkRecoveryRequest, {
    body: { ticket: "t" },
  });
  assert.equal(out.status, 200);
  assert.equal(out.body.data.message, "Verification code sent to your email");
});

test("googleLinkRecoveryVerify issues a session cookie on success", async () => {
  const out = await invoke(controller.googleLinkRecoveryVerify, {
    body: { ticket: "t", otp: "123456" },
  });
  assert.equal(out.status, 200);
  assert.equal(cookieSet, "signed.jwt.token");
});

test("googleStart redirects to Google", async () => {
  const out = await invoke(controller.googleStart, {
    query: { redirect: "/dashboard" },
  });
  assert.equal(out.redirect, "https://accounts.google.com/o/oauth2/v2/auth");
});

test("googleStart fails gracefully when Google OAuth is not configured", async () => {
  oauthNotConfigured = true;
  await assert.rejects(
    () =>
      invoke(controller.googleStart, {
        query: { redirect: "/dashboard" },
      }),
    /not configured/i
  );
});

test("callback handles a cancelled Google consent without creating a challenge", async () => {
  const out = await invoke(controller.googleCallback, {
    query: { error: "access_denied" },
  });
  assert.ok(out.redirect.indexOf("/login?") !== -1);
  assert.ok(decodeURIComponent(out.redirect).indexOf("cancelled") !== -1);
  assert.equal(createChallengeCalls, 0);
});

test("callback handles a missing code or state gracefully", async () => {
  const out = await invoke(controller.googleCallback, { query: {} });
  assert.ok(out.redirect.indexOf("/login?") !== -1);
  assert.equal(createChallengeCalls, 0);
});

test("callback surfaces a duplicate-link conflict as an error redirect, not a challenge", async () => {
  decision = { status: "link_required", user: { id: 7 } };
  challengeFails = true;
  const out = await invoke(controller.googleCallback, {
    query: { code: "code", state: "state" },
  });
  assert.ok(out.redirect.indexOf("/login?") !== -1);
  const decoded = decodeURIComponent(out.redirect).replace(/\+/g, " ");
  assert.ok(decoded.indexOf("already linked to a different") !== -1);
  assert.ok(out.redirect.indexOf("challenge-ticket") === -1);
});
