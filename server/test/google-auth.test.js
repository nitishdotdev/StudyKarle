process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.RESEND_API_KEY = "re_dummy";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI =
  "http://localhost:5000/api/auth/google/callback";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

function stub(id, exports) {
  const full = require.resolve(id);
  require.cache[full] = {
    id: full,
    filename: full,
    loaded: true,
    exports: exports,
  };
}

const users = new Map();
let nextId = 1;
const userModel = {
  async create(data) {
    const row = {
      id: nextId++,
      name: data.name,
      email: String(data.email).toLowerCase(),
      password_hash: data.passwordHash || null,
      role: data.role || "student",
      google_sub: data.googleSub || null,
      avatar_url: data.avatarUrl || null,
      token_version: 0,
      created_at: new Date(),
    };
    users.set(row.email, row);
    if (row.google_sub) users.set("sub:" + row.google_sub, row);
    users.set("id:" + row.id, row);
    return row;
  },
  async findByEmail(email) {
    return users.get(String(email).toLowerCase()) || null;
  },
  async findByGoogleSub(sub) {
    return users.get("sub:" + sub) || null;
  },
  async findById(id) {
    return users.get("id:" + id) || null;
  },
  publicUser: function (row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      has_password: !!row.password_hash,
      google_linked: !!row.google_sub,
    };
  },
};
stub(path.join(__dirname, "..", "src", "models", "userModel.js"), userModel);

const googleAuthService = require("../src/services/googleAuthService");

test.beforeEach(() => {
  users.clear();
  nextId = 1;
});

test("state is signed and rejects tampering / expiry", () => {
  const state = googleAuthService.signState({
    n: "nonce1",
    cv: "verifier",
    ts: Date.now(),
    r: "/dashboard",
  });
  const parsed = googleAuthService.verifyState(state);
  assert.equal(parsed.n, "nonce1");

  assert.throws(
    () => googleAuthService.verifyState(state + "x"),
    /invalid google sign-in/i
  );
  assert.throws(
    () => googleAuthService.verifyState("not-valid"),
    /invalid google sign-in/i
  );

  const expired = googleAuthService.signState({
    n: "n",
    cv: "v",
    ts: Date.now() - 11 * 60 * 1000,
    r: "/dashboard",
  });
  assert.throws(() => googleAuthService.verifyState(expired), /expired/i);
});

test("safeRedirectPath blocks open redirects", () => {
  assert.equal(googleAuthService.safeRedirectPath("/dashboard"), "/dashboard");
  assert.equal(
    googleAuthService.safeRedirectPath("https://evil.example"),
    "/dashboard"
  );
  assert.equal(googleAuthService.safeRedirectPath("//evil.example"), "/dashboard");
  assert.equal(googleAuthService.safeRedirectPath(""), "/dashboard");
});

test("Google signup creates a student, never an admin", async () => {
  const user = await googleAuthService.findOrCreateFromGoogle({
    sub: "google-sub-1",
    email: "new@gmail.com",
    name: "New User",
    picture: null,
  });
  assert.equal(user.role, "student");
  assert.equal(user.google_linked, true);
  assert.equal(user.has_password, false);
  assert.equal(user.email, "new@gmail.com");
});

test("Google identity is reused by stable sub, not auto-linked by email", async () => {
  await userModel.create({
    name: "Local",
    email: "same@gmail.com",
    passwordHash: "hash",
    role: "admin",
  });
  await assert.rejects(
    () =>
      googleAuthService.findOrCreateFromGoogle({
        sub: "google-sub-2",
        email: "same@gmail.com",
        name: "Local",
      }),
    /already exists/i
  );

  const googleUser = await userModel.create({
    name: "G",
    email: "g@gmail.com",
    passwordHash: null,
    googleSub: "stable-sub",
    role: "student",
  });
  const reused = await googleAuthService.findOrCreateFromGoogle({
    sub: "stable-sub",
    email: "g@gmail.com",
    name: "G",
  });
  assert.equal(reused.id, googleUser.id);
  assert.equal(reused.role, "student");
});

test("disposable Google emails are blocked before account creation", async () => {
  await assert.rejects(
    () =>
      googleAuthService.findOrCreateFromGoogle({
        sub: "sub-disp",
        email: "tmp@mailinator.com",
        name: "Temp",
      }),
    /temporary email addresses are not supported/i
  );
});

test("existing Google accounts with disposable emails cannot sign in", async () => {
  await userModel.create({
    name: "Temp",
    email: "legacy@mailinator.com",
    passwordHash: null,
    googleSub: "legacy-disp-sub",
    role: "student",
  });
  await assert.rejects(
    () =>
      googleAuthService.findOrCreateFromGoogle({
        sub: "legacy-disp-sub",
        email: "legacy@mailinator.com",
        name: "Temp",
      }),
    /temporary email addresses are not supported/i
  );
});
