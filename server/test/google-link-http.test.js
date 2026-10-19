// HTTP-level integration tests for the Google account-linking flow.
//
// Exercises the REAL Express app surface: routing, CSRF middleware, validators,
// rate limiters, controllers, googleAuthService, googleLinkService and cookie
// issuance (JWT + Set-Cookie). Only the outer boundaries are doubled:
//   - the database (in-memory models that faithfully mirror the SQL semantics,
//     including the users.google_sub UNIQUE constraint and atomic single-use),
//   - the email provider, and
//   - google-auth-library (token exchange + ID-token verification).
//
// No network, no Postgres, and never production. This is the closest thing to
// an end-to-end test that is possible without a disposable database.
//
//   node --test test/google-link-http.test.js

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.RESEND_API_KEY = "re_dummy";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI =
  "http://localhost:5000/api/auth/google/callback";
// Keep credential limits small enough to hit deterministically in tests.
process.env.AUTH_RATE_LIMIT_MAX = "3";
process.env.AUTH_IP_RATE_LIMIT_MAX = "8";
process.env.SENSITIVE_RATE_LIMIT_MAX = "50";
process.env.OTP_REQUEST_RATE_LIMIT_MAX = "50";
process.env.OTP_IP_RATE_LIMIT_MAX = "50";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const http = require("http");
const bcrypt = require("bcryptjs");

function stubRel(rel, exports) {
  const full = require.resolve(path.join(__dirname, "..", "src", rel));
  require.cache[full] = { id: full, filename: full, loaded: true, exports };
}
function stubModule(name, exports) {
  const full = require.resolve(name);
  require.cache[full] = { id: full, filename: full, loaded: true, exports };
}

// ---------------------------------------------------------------------------
// Fake google-auth-library
// ---------------------------------------------------------------------------
const googleState = { payload: null };
class FakeOAuth2Client {
  setCredentials() {}
  generateAuthUrl() {
    return "https://accounts.google.com/o/oauth2/v2/auth";
  }
  async getToken() {
    return { tokens: { id_token: "fake-id-token" } };
  }
  async verifyIdToken() {
    return { getPayload: () => googleState.payload };
  }
}
stubModule("google-auth-library", { OAuth2Client: FakeOAuth2Client });

// ---------------------------------------------------------------------------
// In-memory database doubles
// ---------------------------------------------------------------------------
const users = new Map(); // email -> row ; "id:N" -> row ; "sub:X" -> row
let nextUserId = 1;
const challenges = new Map(); // id -> row
let nextChallengeId = 1;
const loginTickets = new Map(); // id -> row
let nextLoginTicketId = 1;
const sentEmails = [];

function resetDb() {
  users.clear();
  nextUserId = 1;
  challenges.clear();
  nextChallengeId = 1;
  loginTickets.clear();
  nextLoginTicketId = 1;
  sentEmails.length = 0;
  googleState.payload = null;
}

const userModel = {
  async create(data) {
    const email = String(data.email).toLowerCase();
    if (users.has(email)) {
      const err = new Error("duplicate key value violates unique constraint");
      err.code = "23505";
      throw err;
    }
    if (data.googleSub && users.has("sub:" + data.googleSub)) {
      const err = new Error("duplicate key value violates unique constraint");
      err.code = "23505";
      throw err;
    }
    const row = {
      id: nextUserId++,
      name: data.name,
      email,
      password_hash: data.passwordHash || null,
      role: data.role || "student",
      google_sub: data.googleSub || null,
      avatar_url: data.avatarUrl || null,
      course: data.course || null,
      current_year: data.current_year || null,
      token_version: 0,
      created_at: new Date(),
    };
    users.set(email, row);
    users.set("id:" + row.id, row);
    if (row.google_sub) users.set("sub:" + row.google_sub, row);
    return row;
  },
  async findByEmail(email) {
    return users.get(String(email).toLowerCase()) || null;
  },
  async findById(id) {
    return users.get("id:" + id) || null;
  },
  async findByGoogleSub(sub) {
    return users.get("sub:" + sub) || null;
  },
  async findPublicById(id) {
    return this.publicUser(users.get("id:" + id));
  },
  publicUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      avatar_url: row.avatar_url,
      course: row.course,
      current_year: row.current_year,
      created_at: row.created_at,
      has_password: !!row.password_hash,
      google_linked: !!row.google_sub,
    };
  },
  async updatePassword(id, hash) {
    const u = users.get("id:" + id);
    if (u) u.password_hash = hash;
  },
  async incrementTokenVersion(id) {
    const u = users.get("id:" + id);
    if (u) u.token_version = (u.token_version || 0) + 1;
  },
};

const googleLinkChallengeModel = {
  async create(data) {
    const row = {
      id: nextChallengeId++,
      user_id: data.userId,
      google_sub: data.googleSub,
      google_email: data.googleEmail,
      google_name: data.googleName || null,
      google_picture: data.googlePicture || null,
      redirect_path: data.redirectPath || null,
      ticket_hash: data.ticketHash,
      expires_at: data.expiresAt,
      consumed_at: null,
      attempts: 0,
      otp_hash: null,
      otp_expires_at: null,
      otp_attempts: 0,
      otp_resend_count: 0,
      created_at: new Date(),
    };
    challenges.set(row.id, row);
    return row;
  },
  async findValidByHash(hash) {
    for (const c of challenges.values()) {
      if (
        c.ticket_hash === hash &&
        !c.consumed_at &&
        new Date(c.expires_at).getTime() > Date.now()
      ) {
        return c;
      }
    }
    return null;
  },
  async findById(id) {
    return challenges.get(id) || null;
  },
  async consume(id) {
    const c = challenges.get(id);
    if (c && !c.consumed_at) c.consumed_at = new Date();
    return 1;
  },
  async consumeAllForUser(userId) {
    for (const c of challenges.values()) {
      if (c.user_id === userId && !c.consumed_at) c.consumed_at = new Date();
    }
  },
  async incrementAttempts(id) {
    const c = challenges.get(id);
    if (c) c.attempts += 1;
  },
  async setOtp(id, otpHash, expiresAt, resendCount) {
    const c = challenges.get(id);
    if (c) {
      c.otp_hash = otpHash;
      c.otp_expires_at = expiresAt;
      c.otp_attempts = 0;
      c.otp_resend_count = resendCount;
    }
  },
  async incrementOtpAttempts(id) {
    const c = challenges.get(id);
    if (c) c.otp_attempts += 1;
  },
  async clearOtp(id) {
    const c = challenges.get(id);
    if (c) {
      c.otp_hash = null;
      c.otp_expires_at = null;
      c.otp_attempts = 0;
    }
  },
  // Models a single DB transaction: the check-and-set below contains no await,
  // so it is atomic with respect to other concurrent calls (matching how the
  // real conditional UPDATE + UNIQUE constraint behave).
  async consumeAndLinkGoogleSub(challenge) {
    await Promise.resolve(); // model the round-trip before the transaction
    const rec = challenges.get(challenge.id);
    if (!rec || rec.consumed_at) return { ok: false, reason: "consumed" };
    const user = users.get("id:" + challenge.user_id);
    if (!user || user.google_sub) return { ok: false, reason: "already_linked" };
    for (const u of users.values()) {
      if (u.google_sub === challenge.google_sub) {
        return { ok: false, reason: "sub_taken" };
      }
    }
    rec.consumed_at = new Date();
    user.google_sub = challenge.google_sub;
    users.set("sub:" + challenge.google_sub, user);
    return { ok: true, user };
  },
};

const oauthLoginTicketModel = {
  async create(data) {
    const row = {
      id: nextLoginTicketId++,
      user_id: data.userId,
      ticket_hash: data.ticketHash,
      expires_at: data.expiresAt,
      consumed_at: null,
    };
    loginTickets.set(row.id, row);
    return row;
  },
  async findValidByHash(hash) {
    for (const t of loginTickets.values()) {
      if (
        t.ticket_hash === hash &&
        !t.consumed_at &&
        new Date(t.expires_at).getTime() > Date.now()
      ) {
        return t;
      }
    }
    return null;
  },
  async consume(id) {
    const t = loginTickets.get(id);
    if (t && !t.consumed_at) t.consumed_at = new Date();
    return 1;
  },
};

stubRel("config/db.js", function () {
  throw new Error("database must not be touched in google-link-http tests");
});
stubRel("models/userModel.js", userModel);
stubRel("models/googleLinkChallengeModel.js", googleLinkChallengeModel);
stubRel("models/oauthLoginTicketModel.js", oauthLoginTicketModel);
stubRel("models/passwordResetAuthorizationModel.js", {
  create: async () => ({}),
  findValidByHash: async () => null,
  consume: async () => 1,
  consumeAllForUser: async () => 1,
});
stubRel("models/otpVerificationModel.js", {});
stubRel("services/emailService.js", {
  sendEmail: async function (msg) {
    sentEmails.push(msg);
    return { id: "em_test" };
  },
});

// ---------------------------------------------------------------------------
// Real app surface
// ---------------------------------------------------------------------------
const express = require("express");
const cookieParser = require("cookie-parser");
const authRoutes = require("../src/routes/authRoutes");
const csrf = require("../src/middleware/csrfProtection");
const errorHandler = require("../src/middleware/errorHandler");
const googleAuthService = require("../src/services/googleAuthService");
const env = require("../src/config/env");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use("/api", csrf);
app.use("/api/auth", authRoutes);
app.use(errorHandler);

let server;
let port;
test.before(function () {
  return new Promise(function (resolve) {
    server = app.listen(0, function () {
      port = server.address().port;
      resolve();
    });
  });
});
test.after(function () {
  return new Promise(function (resolve) {
    server.close(resolve);
  });
});

let ipCounter = 0;
function newIp() {
  ipCounter += 1;
  return "203.0.113." + ipCounter;
}

function request(method, urlPath, opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    const headers = {
      "content-type": "application/json",
      "x-forwarded-for": opts.ip || newIp(),
    };
    if (opts.xrw !== false) headers["x-requested-with"] = "XMLHttpRequest";
    if (opts.cookie) headers.cookie = opts.cookie;
    const r = http.request(
      { port, method, path: urlPath, headers },
      function (res) {
        let data = "";
        res.on("data", function (c) {
          data += c;
        });
        res.on("end", function () {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (e) {
            json = null;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            setCookie: res.headers["set-cookie"] || [],
            location: res.headers.location || null,
            body: data,
            json,
          });
        });
      }
    );
    r.on("error", reject);
    if (opts.body) r.write(JSON.stringify(opts.body));
    r.end();
  });
}

function post(urlPath, body, opts) {
  return request("POST", "/api/auth" + urlPath, Object.assign({}, opts, { body }));
}

function stateFor(nonce, redirect) {
  return googleAuthService.signState({
    n: nonce,
    cv: "verifier",
    ts: Date.now(),
    r: redirect || "/dashboard",
  });
}

function newGooglePayload(overrides) {
  return Object.assign(
    {
      iss: "https://accounts.google.com",
      aud: env.google.oauthClientId,
      sub: "sub-default",
      email: "default@gmail.com",
      email_verified: true,
      name: "Default Name",
      picture: null,
      nonce: "nonce-default",
    },
    overrides || {}
  );
}

async function callback(nonce, payload) {
  // The ID token nonce must match the nonce bound into the signed state, exactly
  // as Google echoes it back in a real flow.
  googleState.payload = Object.assign({}, payload, { nonce: nonce });
  return request(
    "GET",
    "/api/auth/google/callback?code=abc&state=" + encodeURIComponent(stateFor(nonce)),
    {}
  );
}

function ticketFromLocation(location) {
  const url = new URL(location);
  assert.equal(url.searchParams.get("ticket"), null, "ticket must not be in the query string");
  return new URLSearchParams(url.hash.replace(/^#/, "")).get("ticket");
}

function cookieValue(setCookie) {
  if (!setCookie.length) return null;
  return setCookie[0].split(";")[0];
}

test.beforeEach(resetDb);

// ===========================================================================
// 1. New Google user: callback -> complete -> session cookie
// ===========================================================================

test("new Google user: callback issues a completion ticket and /google/complete starts a session", async () => {
  const cb = await callback(
    "n1",
    newGooglePayload({ sub: "new-sub", email: "new@gmail.com", name: "New User" })
  );
  assert.equal(cb.status, 302);
  assert.ok(cb.location.indexOf("http://localhost:5173/auth/google/complete#") === 0);
  assert.ok(cb.location.indexOf("?ticket=") === -1);
  const ticket = ticketFromLocation(cb.location);
  assert.ok(ticket);

  const done = await post("/google/complete", { ticket });
  assert.equal(done.status, 200);
  assert.equal(done.json.data.google_linked, true);
  assert.equal(done.json.data.email, "new@gmail.com");
  const cookie = cookieValue(done.setCookie);
  assert.ok(cookie && cookie.indexOf("studykarle_token=") === 0);
  assert.ok(/HttpOnly/i.test(done.setCookie[0]));

  // The session cookie authenticates a subsequent protected request.
  const me = await request("GET", "/api/auth/me", { cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.data.email, "new@gmail.com");
});

test("a completion ticket is single-use", async () => {
  const cb = await callback(
    "n2",
    newGooglePayload({ sub: "once-sub", email: "once@gmail.com" })
  );
  const ticket = ticketFromLocation(cb.location);
  const first = await post("/google/complete", { ticket });
  assert.equal(first.status, 200);
  const second = await post("/google/complete", { ticket });
  assert.equal(second.status, 401);
});

// ===========================================================================
// 2. Existing password account: link page + password verify
// ===========================================================================

async function seedPasswordUser(email, password, extra) {
  return userModel.create(
    Object.assign(
      {
        name: "Existing User",
        email,
        passwordHash: bcrypt.hashSync(password, 10),
        role: "student",
      },
      extra || {}
    )
  );
}

test("existing password account: callback redirects to the link screen with no raw claims in the URL", async () => {
  await seedPasswordUser("linked-req@gmail.com", "Correct123");
  const cb = await callback(
    "n3",
    newGooglePayload({ sub: "req-sub", email: "linked-req@gmail.com" })
  );
  assert.equal(cb.status, 302);
  assert.ok(cb.location.indexOf("http://localhost:5173/auth/google/link#ticket=") === 0);
  assert.ok(cb.location.indexOf("?ticket=") === -1);
  assert.ok(cb.location.indexOf("linked-req@gmail.com") === -1);
  assert.ok(cb.location.indexOf("req-sub") === -1);
});

test("link info returns the server-bound email and password requirement", async () => {
  const user = await seedPasswordUser("info@gmail.com", "Correct123");
  const cb = await callback(
    "n4",
    newGooglePayload({ sub: "info-sub", email: "info@gmail.com" })
  );
  const ticket = ticketFromLocation(cb.location);
  const info = await post("/google/link/info", { ticket });
  assert.equal(info.status, 200);
  assert.equal(info.json.data.email, "info@gmail.com");
  assert.equal(info.json.data.hasPassword, true);
  void user;
});

test("correct password links the account, preserves profile/role, and starts a session", async () => {
  const user = await seedPasswordUser("keep@gmail.com", "Correct123", {
    role: "admin",
    course: "BSc",
    current_year: "2",
    avatarUrl: "https://example.com/local.png",
  });
  const cb = await callback(
    "n5",
    newGooglePayload({
      sub: "keep-sub",
      email: "keep@gmail.com",
      picture: "https://example.com/google.png",
    })
  );
  const ticket = ticketFromLocation(cb.location);

  const res = await post("/google/link/verify", {
    ticket,
    password: "Correct123",
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.data.user.google_linked, true);
  assert.ok(cookieValue(res.setCookie));

  const stored = users.get("id:" + user.id);
  assert.equal(stored.google_sub, "keep-sub");
  assert.equal(stored.role, "admin");
  assert.equal(stored.course, "BSc");
  assert.equal(stored.current_year, "2");
  assert.equal(stored.avatar_url, "https://example.com/local.png");
  assert.equal(stored.name, "Existing User");
});

test("incorrect password does not link, does not set a cookie, and the ticket still works afterwards", async () => {
  const user = await seedPasswordUser("wrong@gmail.com", "Correct123");
  const cb = await callback(
    "n6",
    newGooglePayload({ sub: "wrong-sub", email: "wrong@gmail.com" })
  );
  const ticket = ticketFromLocation(cb.location);

  const bad = await post("/google/link/verify", { ticket, password: "Nope12345" });
  assert.equal(bad.status, 401);
  assert.equal(bad.setCookie.length, 0);
  assert.equal(users.get("id:" + user.id).google_sub, null);

  const good = await post("/google/link/verify", {
    ticket,
    password: "Correct123",
  });
  assert.equal(good.status, 200);
  assert.equal(users.get("id:" + user.id).google_sub, "wrong-sub");
});

test("a linking ticket cannot be consumed twice", async () => {
  await seedPasswordUser("twice@gmail.com", "Correct123");
  const cb = await callback(
    "n7",
    newGooglePayload({ sub: "twice-sub", email: "twice@gmail.com" })
  );
  const ticket = ticketFromLocation(cb.location);
  assert.equal(
    (await post("/google/link/verify", { ticket, password: "Correct123" })).status,
    200
  );
  assert.equal(
    (await post("/google/link/verify", { ticket, password: "Correct123" })).status,
    401
  );
});

test("an expired linking challenge fails safely", async () => {
  await seedPasswordUser("expired@gmail.com", "Correct123");
  const cb = await callback(
    "n8",
    newGooglePayload({ sub: "expired-sub", email: "expired@gmail.com" })
  );
  const ticket = ticketFromLocation(cb.location);
  for (const c of challenges.values()) c.expires_at = new Date(Date.now() - 1000);
  const res = await post("/google/link/verify", {
    ticket,
    password: "Correct123",
  });
  assert.equal(res.status, 401);
  assert.equal(res.setCookie.length, 0);
});

test("concurrent linking with the same ticket links exactly once", async () => {
  const user = await seedPasswordUser("race@gmail.com", "Correct123");
  const cb = await callback(
    "n9",
    newGooglePayload({ sub: "race-sub", email: "race@gmail.com" })
  );
  const ticket = ticketFromLocation(cb.location);
  const results = await Promise.all([
    post("/google/link/verify", { ticket, password: "Correct123" }),
    post("/google/link/verify", { ticket, password: "Correct123" }),
  ]);
  const ok = results.filter(function (r) {
    return r.status === 200;
  });
  const failed = results.filter(function (r) {
    return r.status >= 400;
  });
  assert.equal(ok.length, 1);
  assert.equal(failed.length, 1);
  assert.equal(users.get("id:" + user.id).google_sub, "race-sub");
});

// ===========================================================================
// 3. Password-less account: verified OTP recovery
// ===========================================================================

test("password-less account is routed to recovery and can link via email OTP", async () => {
  const user = await userModel.create({
    name: "No Pass",
    email: "nopass@gmail.com",
    passwordHash: null,
    role: "student",
  });
  const cb = await callback(
    "n10",
    newGooglePayload({ sub: "nopass-sub", email: "nopass@gmail.com" })
  );
  const ticket = ticketFromLocation(cb.location);
  const info = await post("/google/link/info", { ticket });
  assert.equal(info.json.data.hasPassword, false);

  const req1 = await post("/google/link/recovery/request", { ticket });
  assert.equal(req1.status, 200);
  assert.equal(sentEmails.length, 1);
  const otp = sentEmails[0].text.match(/(\d{6})/)[1];

  const verify = await post("/google/link/recovery/verify", { ticket, otp });
  assert.equal(verify.status, 200);
  assert.equal(verify.json.data.user.google_linked, true);
  assert.ok(cookieValue(verify.setCookie));
  assert.equal(users.get("id:" + user.id).google_sub, "nopass-sub");
});

test("wrong recovery OTP does not link", async () => {
  await userModel.create({
    name: "No Pass",
    email: "nopass2@gmail.com",
    passwordHash: null,
  });
  const cb = await callback(
    "n11",
    newGooglePayload({ sub: "nopass2-sub", email: "nopass2@gmail.com" })
  );
  const ticket = ticketFromLocation(cb.location);
  await post("/google/link/recovery/request", { ticket });
  const bad = await post("/google/link/recovery/verify", {
    ticket,
    otp: "000000",
  });
  assert.equal(bad.status, 401);
  assert.equal(bad.setCookie.length, 0);
});

// ===========================================================================
// 4. Safety: identity ownership + sub reassignment
// ===========================================================================

test("an account already linked to a different Google identity is refused with an error redirect", async () => {
  await seedPasswordUser("owned@gmail.com", "Correct123", {
    googleSub: "the-owned-sub",
  });
  const cb = await callback(
    "n12",
    newGooglePayload({ sub: "different-sub", email: "owned@gmail.com" })
  );
  assert.equal(cb.status, 302);
  assert.ok(
    cb.location.indexOf("/login?") !== -1,
    "unexpected redirect: " + cb.location
  );
  const decoded = decodeURIComponent(cb.location).replace(/\+/g, " ");
  assert.ok(decoded.indexOf("different Google account") !== -1);
});

test("callback with an unverified Google email is rejected", async () => {
  const cb = await callback(
    "n13",
    newGooglePayload({
      sub: "unverified-sub",
      email: "unverified@gmail.com",
      email_verified: false,
    })
  );
  assert.equal(cb.status, 302);
  assert.ok(cb.location.indexOf("/login?") !== -1);
  // No account is created from an unverified identity.
  assert.equal(users.get("unverified@gmail.com"), undefined);
});

// ===========================================================================
// 5. CSRF, validation and rate limits remain intact
// ===========================================================================

test("link endpoints reject requests without the CSRF X-Requested-With header", async () => {
  const res = await post(
    "/google/link/info",
    { ticket: "whatever" },
    { xrw: false }
  );
  assert.equal(res.status, 403);
});

test("completion and verify reject requests without the CSRF X-Requested-With header", async () => {
  const complete = await post("/google/complete", { ticket: "whatever" }, { xrw: false });
  assert.equal(complete.status, 403);
  const verify = await post(
    "/google/link/verify",
    { ticket: "whatever", password: "Correct123" },
    { xrw: false }
  );
  assert.equal(verify.status, 403);
});

test("Google OAuth callback GET does not require the CSRF header", async () => {
  const res = await request(
    "GET",
    "/api/auth/google/callback?error=access_denied",
    { xrw: false }
  );
  assert.equal(res.status, 302);
  assert.ok(res.location.indexOf("/login?") !== -1);
});

test("link info rejects a missing ticket with a validation error", async () => {
  const res = await post("/google/link/info", {});
  assert.equal(res.status, 400);
});

test("repeated wrong-password attempts on the link endpoint are rate limited", async () => {
  await seedPasswordUser("rl@gmail.com", "Correct123");
  const ip = newIp();
  const cb = await callback(
    "n14",
    newGooglePayload({ sub: "rl-sub", email: "rl@gmail.com" })
  );
  const ticket = ticketFromLocation(cb.location);
  let sawLimit = false;
  for (let i = 0; i < 6; i++) {
    const res = await post(
      "/google/link/verify",
      { ticket, password: "WrongPass1" },
      { ip }
    );
    if (res.status === 429) {
      sawLimit = true;
      break;
    }
  }
  assert.ok(sawLimit, "expected an HTTP 429 after repeated failures");
});

// ===========================================================================
// 6. Regression: existing account flows are untouched
// ===========================================================================

test("the linking routes are additive: existing /google/complete validation still applies", async () => {
  const missing = await post("/google/complete", {});
  assert.equal(missing.status, 401);
});

test("environment still uses the GOOGLE_OAUTH_* client id", async () => {
  assert.equal(
    env.google.oauthClientId,
    "test-client-id.apps.googleusercontent.com"
  );
});
