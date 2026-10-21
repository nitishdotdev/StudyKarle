// Tests for Google account linking: existing password accounts, password-less
// recovery, new-user signup, and the security guarantees around the linking
// challenge. No database, no network: the user + challenge models and the email
// service are stubbed; all service logic is real.
//
//   node --test test/google-account-linking.test.js

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
const bcrypt = require("bcryptjs");

function stub(rel, exports) {
  const full = require.resolve(path.join(__dirname, "..", "src", rel));
  require.cache[full] = {
    id: full,
    filename: full,
    loaded: true,
    exports: exports,
  };
}

// ---------------------------------------------------------------------------
// Shared in-memory state
// ---------------------------------------------------------------------------
const users = new Map();
let nextUserId = 1;

const challenges = [];
let nextChallengeId = 1;
let linkBehavior = null;

const sentEmails = [];

function reset() {
  users.clear();
  nextUserId = 1;
  challenges.length = 0;
  nextChallengeId = 1;
  linkBehavior = null;
  sentEmails.length = 0;
}

// ---------------------------------------------------------------------------
// userModel stub
// ---------------------------------------------------------------------------
const userModel = {
  async create(data) {
    const row = {
      id: nextUserId++,
      name: data.name,
      email: String(data.email).toLowerCase(),
      password_hash: data.passwordHash || null,
      role: data.role || "student",
      google_sub: data.googleSub || null,
      avatar_url: data.avatarUrl || null,
      course: data.course || null,
      current_year: data.current_year || null,
      token_version: 0,
      created_at: new Date(),
    };
    users.set(row.email, row);
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
  publicUser: function (row) {
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
};

// ---------------------------------------------------------------------------
// googleLinkChallengeModel stub
// ---------------------------------------------------------------------------
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
    challenges.push(row);
    return row;
  },
  async findValidByHash(hash) {
    return (
      challenges.find(function (c) {
        return (
          c.ticket_hash === hash &&
          !c.consumed_at &&
          new Date(c.expires_at).getTime() > Date.now()
        );
      }) || null
    );
  },
  async findById(id) {
    return challenges.find(function (c) {
      return c.id === id;
    }) || null;
  },
  async consume(id) {
    const c = challenges.find(function (x) {
      return x.id === id;
    });
    if (c && !c.consumed_at) c.consumed_at = new Date();
    return 1;
  },
  async consumeAllForUser(userId) {
    challenges.forEach(function (c) {
      if (c.user_id === userId && !c.consumed_at) c.consumed_at = new Date();
    });
  },
  async incrementAttempts(id) {
    const c = challenges.find(function (x) {
      return x.id === id;
    });
    if (c) c.attempts += 1;
  },
  async setOtp(id, otpHash, expiresAt, resendCount) {
    const c = challenges.find(function (x) {
      return x.id === id;
    });
    if (c) {
      c.otp_hash = otpHash;
      c.otp_expires_at = expiresAt;
      c.otp_attempts = 0;
      c.otp_resend_count = resendCount;
    }
  },
  async incrementOtpAttempts(id) {
    const c = challenges.find(function (x) {
      return x.id === id;
    });
    if (c) c.otp_attempts += 1;
  },
  async clearOtp(id) {
    const c = challenges.find(function (x) {
      return x.id === id;
    });
    if (c) {
      c.otp_hash = null;
      c.otp_expires_at = null;
      c.otp_attempts = 0;
    }
  },
  async consumeAndLinkGoogleSub(challenge) {
    if (linkBehavior) {
      return linkBehavior(challenge);
    }
    const rec = challenges.find(function (c) {
      return c.id === challenge.id;
    });
    if (!rec || rec.consumed_at) {
      return { ok: false, reason: "consumed" };
    }
    const user = users.get("id:" + challenge.user_id);
    if (!user || user.google_sub) {
      return { ok: false, reason: "already_linked" };
    }
    const taken = Array.from(users.values()).some(function (u) {
      return u.google_sub === challenge.google_sub;
    });
    if (taken) {
      return { ok: false, reason: "sub_taken" };
    }
    rec.consumed_at = new Date();
    user.google_sub = challenge.google_sub;
    users.set("sub:" + challenge.google_sub, user);
    return { ok: true, user: user };
  },
};

stub("models/userModel.js", userModel);
stub("models/googleLinkChallengeModel.js", googleLinkChallengeModel);
stub("services/emailService.js", {
  sendEmail: async function (msg) {
    sentEmails.push(msg);
    return { id: "em_test" };
  },
});

const googleAuthService = require("../src/services/googleAuthService");
const googleLinkService = require("../src/services/googleLinkService");

test.beforeEach(reset);

function makeUser(overrides) {
  const base = {
    name: "Existing User",
    email: "existing@gmail.com",
    passwordHash: bcrypt.hashSync("Correct123", 10),
    role: "student",
  };
  return userModel.create(Object.assign({}, base, overrides || {}));
}

function identity(overrides) {
  return Object.assign(
    {
      sub: "google-sub-1",
      email: "existing@gmail.com",
      name: "Google Name",
      picture: "https://example.com/a.png",
    },
    overrides || {}
  );
}

// ===========================================================================
// googleAuthService.findOrCreateFromGoogle
// ===========================================================================

test("already-linked Google identity signs in without a challenge", async () => {
  const user = await makeUser({
    email: "linked@gmail.com",
    googleSub: "sub-linked",
  });
  const result = await googleAuthService.findOrCreateFromGoogle(
    identity({ sub: "sub-linked", email: "linked@gmail.com" })
  );
  assert.equal(result.status, "authenticated");
  assert.equal(result.user.id, user.id);
});

test("existing email/password account is routed to password linking", async () => {
  const user = await makeUser();
  const result = await googleAuthService.findOrCreateFromGoogle(identity());
  assert.equal(result.status, "link_required");
  assert.equal(result.user.id, user.id);
  // Not auto-linked.
  assert.equal((await userModel.findById(user.id)).google_sub, null);
});

test("new Google user is created with verified email, name and subject", async () => {
  const result = await googleAuthService.findOrCreateFromGoogle(
    identity({
      sub: "brand-new-sub",
      email: "fresh@gmail.com",
      name: "Fresh Student",
      picture: "https://example.com/p.png",
    })
  );
  assert.equal(result.status, "authenticated");
  const user = result.user;
  assert.equal(user.email, "fresh@gmail.com");
  assert.equal(user.name, "Fresh Student");
  assert.equal(user.google_sub, "brand-new-sub");
  assert.equal(user.avatar_url, "https://example.com/p.png");
  assert.equal(user.role, "student");
  assert.equal(user.password_hash, null);
});

test("the new Google account is always a student, never an admin", async () => {
  const result = await googleAuthService.findOrCreateFromGoogle(
    identity({ sub: "s2", email: "s2@gmail.com", name: "Student Two" })
  );
  assert.equal(result.user.role, "student");
});

test("missing Google name falls back to the email local part", async () => {
  const result = await googleAuthService.findOrCreateFromGoogle(
    identity({ sub: "s3", email: "johndoe@gmail.com", name: "" })
  );
  assert.equal(result.status, "authenticated");
  assert.equal(result.user.name, "johndoe");
});

test("an unusably short name is rejected instead of creating a bad account", async () => {
  await assert.rejects(
    () =>
      googleAuthService.findOrCreateFromGoogle(
        identity({ sub: "s4", email: "a@x.com", name: "" })
      ),
    /valid name/i
  );
});

test("a different Google identity already on the account is not overwritten", async () => {
  await makeUser({ email: "same2@gmail.com", googleSub: "the-existing-sub" });
  await assert.rejects(
    () =>
      googleAuthService.findOrCreateFromGoogle(
        identity({ sub: "other-sub", email: "same2@gmail.com" })
      ),
    /already linked to a different google account/i
  );
});

test("duplicate-email race resolves to the existing account, not an error", async () => {
  const real = await makeUser({ email: "race@gmail.com" });
  // Simulate a concurrent insert winning: the DB raises 23505.
  const originalCreate = userModel.create;
  let first = true;
  userModel.create = async function () {
    if (first) {
      first = false;
      const err = new Error("duplicate key");
      err.code = "23505";
      throw err;
    }
    return originalCreate.apply(this, arguments);
  };
  try {
    const result = await googleAuthService.findOrCreateFromGoogle(
      identity({ sub: "race-sub", email: "race@gmail.com" })
    );
    assert.equal(result.status, "link_required");
    assert.equal(result.user.id, real.id);
  } finally {
    userModel.create = originalCreate;
  }
});

test("duplicate-google-sub race resolves to the linked account", async () => {
  const linked = await makeUser({
    email: "subrace@gmail.com",
    googleSub: "winning-sub",
  });
  const originalCreate = userModel.create;
  userModel.create = async function () {
    const err = new Error("duplicate key");
    err.code = "23505";
    throw err;
  };
  try {
    const result = await googleAuthService.findOrCreateFromGoogle(
      identity({ sub: "winning-sub", email: "subrace@gmail.com" })
    );
    assert.equal(result.status, "authenticated");
    assert.equal(result.user.id, linked.id);
  } finally {
    userModel.create = originalCreate;
  }
});

// ===========================================================================
// Challenge creation + info
// ===========================================================================

test("createChallenge issues an opaque ticket and getChallengeInfo returns the bound email", async () => {
  const user = await makeUser();
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity(),
    "/dashboard"
  );
  assert.equal(typeof ticket, "string");
  assert.ok(ticket.length >= 32);

  const info = await googleLinkService.getChallengeInfo(ticket);
  assert.equal(info.email, "existing@gmail.com");
  assert.equal(info.hasPassword, true);
  // Only the hash is stored, never the raw ticket.
  assert.ok(
    challenges.every(function (c) {
      return c.ticket_hash !== ticket;
    })
  );
});

test("createChallenge refuses a Google identity already linked elsewhere", async () => {
  await makeUser({ email: "owner@gmail.com", googleSub: "owned-sub" });
  const other = await makeUser({ email: "other2@gmail.com" });
  await assert.rejects(
    () =>
      googleLinkService.createChallenge(
        other,
        identity({ sub: "owned-sub", email: "other2@gmail.com" }),
        "/dashboard"
      ),
    /already linked to a different studykarle account/i
  );
});

test("createChallenge sanitizes the redirect destination", async () => {
  const user = await makeUser();
  await googleLinkService.createChallenge(
    user,
    identity(),
    "https://evil.example/steal"
  );
  assert.equal(challenges[0].redirect_path, "/dashboard");
});

test("getChallengeInfo rejects an invalid ticket", async () => {
  await assert.rejects(
    () => googleLinkService.getChallengeInfo("not-a-real-ticket"),
    /invalid or has expired/i
  );
});

// ===========================================================================
// Password linking
// ===========================================================================

test("correct password links Google to the existing account and signs in", async () => {
  const user = await makeUser({ role: "admin", course: "BSc", current_year: 2 });
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ sub: "attach-sub" }),
    "/drive"
  );

  const result = await googleLinkService.completePasswordLink(ticket, "Correct123");
  assert.equal(result.user.google_linked, true);
  assert.equal(result.redirect, "/drive");

  const stored = await userModel.findById(user.id);
  assert.equal(stored.google_sub, "attach-sub");
});

test("linking preserves role, course, year and avatar (no data overwrite)", async () => {
  const user = await makeUser({
    role: "admin",
    course: "BSc",
    current_year: 3,
    avatarUrl: "https://example.com/existing-avatar.png",
    name: "Existing User",
  });
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({
      sub: "attach-sub-2",
      picture: "https://example.com/google-avatar.png",
    }),
    "/dashboard"
  );
  await googleLinkService.completePasswordLink(ticket, "Correct123");

  const stored = await userModel.findById(user.id);
  assert.equal(stored.role, "admin");
  assert.equal(stored.course, "BSc");
  assert.equal(stored.current_year, 3);
  assert.equal(stored.avatar_url, "https://example.com/existing-avatar.png");
  assert.equal(stored.name, "Existing User");
});

test("incorrect password neither links nor consumes the challenge", async () => {
  const user = await makeUser();
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ sub: "attach-sub-3" }),
    "/dashboard"
  );

  await assert.rejects(
    () => googleLinkService.completePasswordLink(ticket, "WrongPassword9"),
    /incorrect password/i
  );

  const stored = await userModel.findById(user.id);
  assert.equal(stored.google_sub, null);
  assert.equal(challenges[0].consumed_at, null);
  assert.equal(challenges[0].attempts, 1);

  // The same ticket still works with the right password.
  const ok = await googleLinkService.completePasswordLink(ticket, "Correct123");
  assert.equal(ok.user.google_linked, true);
});

test("password linking is refused for a password-less account", async () => {
  const user = await makeUser({
    email: "nopasslink@gmail.com",
    passwordHash: null,
  });
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ email: "nopasslink@gmail.com", sub: "np-sub" }),
    "/dashboard"
  );
  await assert.rejects(
    () => googleLinkService.completePasswordLink(ticket, "whatever"),
    /does not use a password/i
  );
});

test("password attempts are capped", async () => {
  const user = await makeUser();
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ sub: "cap-sub" }),
    "/dashboard"
  );
  for (let i = 0; i < googleLinkService.MAX_PASSWORD_ATTEMPTS; i++) {
    await assert.rejects(
      () => googleLinkService.completePasswordLink(ticket, "WrongPassword9"),
      /incorrect password/i
    );
  }
  await assert.rejects(
    () => googleLinkService.completePasswordLink(ticket, "Correct123"),
    /too many incorrect password attempts/i
  );
});

// ===========================================================================
// Expiry / reuse / concurrency
// ===========================================================================

test("an expired challenge fails safely", async () => {
  const user = await makeUser();
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ sub: "exp-sub" }),
    "/dashboard"
  );
  challenges[0].expires_at = new Date(Date.now() - 1000);
  await assert.rejects(
    () => googleLinkService.completePasswordLink(ticket, "Correct123"),
    /invalid or has expired/i
  );
  assert.equal((await userModel.findById(user.id)).google_sub, null);
});

test("a reused challenge fails safely", async () => {
  const user = await makeUser();
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ sub: "reuse-sub" }),
    "/dashboard"
  );
  await googleLinkService.completePasswordLink(ticket, "Correct123");
  await assert.rejects(
    () => googleLinkService.completePasswordLink(ticket, "Correct123"),
    /invalid or has expired/i
  );
});

test("concurrently consumed challenge fails safely without relinking", async () => {
  const user = await makeUser();
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ sub: "conc-sub" }),
    "/dashboard"
  );
  linkBehavior = async function () {
    return { ok: false, reason: "consumed" };
  };
  await assert.rejects(
    () => googleLinkService.completePasswordLink(ticket, "Correct123"),
    /already used/i
  );
  assert.equal((await userModel.findById(user.id)).google_sub, null);
});

test("a Google subject stolen by a concurrent link is rejected as sub_taken", async () => {
  const user = await makeUser();
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ sub: "taken-sub" }),
    "/dashboard"
  );
  linkBehavior = async function () {
    return { ok: false, reason: "sub_taken" };
  };
  await assert.rejects(
    () => googleLinkService.completePasswordLink(ticket, "Correct123"),
    /already linked to a different studykarle account/i
  );
  assert.equal((await userModel.findById(user.id)).google_sub, null);
});

test("linking when the account is already linked fails safely", async () => {
  const user = await makeUser();
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ sub: "al-sub" }),
    "/dashboard"
  );
  linkBehavior = async function () {
    return { ok: false, reason: "already_linked" };
  };
  await assert.rejects(
    () => googleLinkService.completePasswordLink(ticket, "Correct123"),
    /already linked to a google account/i
  );
});

// ===========================================================================
// Password-less recovery (email OTP bound to the challenge)
// ===========================================================================

test("password-less account completes linking via the email OTP path", async () => {
  const user = await makeUser({
    email: "rec@gmail.com",
    passwordHash: null,
  });
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ email: "rec@gmail.com", sub: "rec-sub" }),
    "/dashboard"
  );

  const info = await googleLinkService.getChallengeInfo(ticket);
  assert.equal(info.hasPassword, false);

  await googleLinkService.requestRecoveryOtp(ticket);
  assert.equal(sentEmails.length, 1);
  const otp = sentEmails[0].text.match(/(\d{6})/)[1];

  const result = await googleLinkService.verifyRecoveryOtp(ticket, otp);
  assert.equal(result.user.google_linked, true);
  assert.equal((await userModel.findById(user.id)).google_sub, "rec-sub");
});

test("incorrect recovery OTP neither links nor consumes the challenge", async () => {
  const user = await makeUser({ email: "rec2@gmail.com", passwordHash: null });
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ email: "rec2@gmail.com", sub: "rec2-sub" }),
    "/dashboard"
  );
  await googleLinkService.requestRecoveryOtp(ticket);
  await assert.rejects(
    () => googleLinkService.verifyRecoveryOtp(ticket, "000000"),
    /invalid verification code/i
  );
  assert.equal((await userModel.findById(user.id)).google_sub, null);
  assert.equal(challenges[0].otp_attempts, 1);
});

test("expired recovery OTP fails safely", async () => {
  const user = await makeUser({ email: "rec3@gmail.com", passwordHash: null });
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ email: "rec3@gmail.com", sub: "rec3-sub" }),
    "/dashboard"
  );
  await googleLinkService.requestRecoveryOtp(ticket);
  challenges[0].otp_expires_at = new Date(Date.now() - 1000);
  const otp = sentEmails[0].text.match(/(\d{6})/)[1];
  await assert.rejects(
    () => googleLinkService.verifyRecoveryOtp(ticket, otp),
    /expired/i
  );
});

test("recovery OTP resends are capped", async () => {
  const user = await makeUser({ email: "rec4@gmail.com", passwordHash: null });
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ email: "rec4@gmail.com", sub: "rec4-sub" }),
    "/dashboard"
  );
  for (let i = 0; i < googleLinkService.MAX_OTP_RESENDS; i++) {
    await googleLinkService.requestRecoveryOtp(ticket);
  }
  await assert.rejects(
    () => googleLinkService.requestRecoveryOtp(ticket),
    /maximum verification attempts/i
  );
});

test("recovery path is refused for a password account", async () => {
  const user = await makeUser();
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ sub: "pw-recovery" }),
    "/dashboard"
  );
  await assert.rejects(
    () => googleLinkService.requestRecoveryOtp(ticket),
    /uses a password/i
  );
});

test("verifyRecoveryOtp before requesting a code fails safely", async () => {
  const user = await makeUser({ email: "rec5@gmail.com", passwordHash: null });
  const { ticket } = await googleLinkService.createChallenge(
    user,
    identity({ email: "rec5@gmail.com", sub: "rec5-sub" }),
    "/dashboard"
  );
  await assert.rejects(
    () => googleLinkService.verifyRecoveryOtp(ticket, "123456"),
    /request a verification code/i
  );
});
