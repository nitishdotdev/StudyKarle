process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.RESEND_API_KEY = "re_test_dummy_key";
process.env.EMAIL_FROM = "StudyKarle <onboarding@resend.dev>";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const bcrypt = require("bcryptjs");

function stub(id, exports) {
  const full = require.resolve(id);
  require.cache[full] = {
    id: full,
    filename: full,
    loaded: true,
    exports: exports,
  };
}

let sendResult = { data: { id: "em_ok" }, error: null };
class FakeResend {
  constructor() {
    this.emails = {
      send: async function () {
        return sendResult;
      },
    };
  }
}
stub("resend", { Resend: FakeResend });

const users = new Map();
let nextUserId = 1;
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
      token_version: 0,
      created_at: new Date(),
    };
    users.set(row.email, row);
    users.set("id:" + row.id, row);
    return row;
  },
  async findByEmail(email) {
    return users.get(String(email).toLowerCase()) || null;
  },
  async findById(id) {
    return users.get("id:" + id) || null;
  },
  async updatePassword(id, passwordHash) {
    const user = users.get("id:" + id);
    if (user) user.password_hash = passwordHash;
  },
  async incrementTokenVersion(id) {
    const user = users.get("id:" + id);
    if (user) user.token_version = (user.token_version || 0) + 1;
  },
  publicUser: function () {
    return null;
  },
};
stub(path.join(__dirname, "..", "src", "models", "userModel.js"), userModel);

const otpRows = [];
const otpVerificationModel = {
  async create(data) {
    const row = {
      id: otpRows.length + 1,
      email: String(data.email).toLowerCase(),
      name: data.name || null,
      password_hash: data.passwordHash || null,
      otp: data.otp,
      expires_at: data.expiresAt,
      resend_count: data.resendCount || 0,
      purpose: data.purpose || "signup",
      attempts: data.attempts || 0,
      consumed_at: null,
      created_at: new Date(),
    };
    otpRows.push(row);
    return row;
  },
  async findLatestByEmailAndPurpose(email, purpose) {
    const matches = otpRows.filter(function (r) {
      return (
        r.email === String(email).toLowerCase() &&
        r.purpose === purpose &&
        !r.consumed_at
      );
    });
    return matches.length ? matches[matches.length - 1] : null;
  },
  async findByEmailAndOtp() {
    return null;
  },
  async findByEmail(email) {
    return (
      otpRows.find(function (r) {
        return r.email === String(email).toLowerCase() && !r.consumed_at;
      }) || null
    );
  },
  async incrementAttempts(id) {
    const row = otpRows.find(function (r) {
      return r.id === id;
    });
    if (row) row.attempts += 1;
  },
  async consume(id) {
    const row = otpRows.find(function (r) {
      return r.id === id;
    });
    if (row) row.consumed_at = new Date();
  },
  async removeByEmailAndPurpose(email, purpose) {
    for (let i = otpRows.length - 1; i >= 0; i--) {
      if (
        otpRows[i].email === String(email).toLowerCase() &&
        otpRows[i].purpose === purpose
      ) {
        otpRows.splice(i, 1);
      }
    }
  },
  async consumeByEmailAndPurpose(email, purpose) {
    otpRows.forEach(function (r) {
      if (
        r.email === String(email).toLowerCase() &&
        r.purpose === purpose &&
        !r.consumed_at
      ) {
        r.consumed_at = new Date();
      }
    });
  },
  async removeByEmail(email) {
    for (let i = otpRows.length - 1; i >= 0; i--) {
      if (otpRows[i].email === String(email).toLowerCase()) {
        otpRows.splice(i, 1);
      }
    }
  },
};
stub(
  path.join(__dirname, "..", "src", "models", "otpVerificationModel.js"),
  otpVerificationModel
);

const resetRows = [];
const passwordResetAuthorizationModel = {
  async create(data) {
    const row = {
      id: resetRows.length + 1,
      user_id: data.userId,
      token_hash: data.tokenHash,
      expires_at: data.expiresAt,
      consumed_at: null,
    };
    resetRows.push(row);
    return row;
  },
  async findValidByHash(tokenHash) {
    return (
      resetRows.find(function (r) {
        return (
          r.token_hash === tokenHash &&
          !r.consumed_at &&
          new Date(r.expires_at) > new Date()
        );
      }) || null
    );
  },
  async consume(id) {
    const row = resetRows.find(function (r) {
      return r.id === id;
    });
    if (row) row.consumed_at = new Date();
  },
  async consumeAllForUser(userId) {
    resetRows.forEach(function (r) {
      if (r.user_id === userId && !r.consumed_at) r.consumed_at = new Date();
    });
  },
};
stub(
  path.join(
    __dirname,
    "..",
    "src",
    "models",
    "passwordResetAuthorizationModel.js"
  ),
  passwordResetAuthorizationModel
);

const otpService = require("../src/services/otpService");
const passwordResetService = require("../src/services/passwordResetService");

test.beforeEach(() => {
  users.clear();
  nextUserId = 1;
  otpRows.length = 0;
  resetRows.length = 0;
  sendResult = { data: { id: "em_ok" }, error: null };
});

test("password reset does not reveal whether an account exists", async () => {
  const missing = await passwordResetService.requestReset("nobody@example.com");
  assert.match(missing.message, /if an eligible account exists/i);
  assert.equal(otpRows.length, 0);

  await userModel.create({
    name: "Local",
    email: "local@example.com",
    passwordHash: await bcrypt.hash("Password1", 10),
  });
  const existing = await passwordResetService.requestReset("local@example.com");
  assert.equal(existing.message, missing.message);
  assert.equal(otpRows.length, 1);
  assert.equal(otpRows[0].purpose, "password_reset");
});

test("disposable addresses do not receive password-reset OTPs even if an account exists", async () => {
  await userModel.create({
    name: "Temp",
    email: "legacy@mailinator.com",
    passwordHash: await bcrypt.hash("Password1", 10),
  });
  const result = await passwordResetService.requestReset(
    "legacy@mailinator.com"
  );
  assert.match(result.message, /if an eligible account exists/i);
  assert.equal(otpRows.length, 0);

  const resent = await passwordResetService.resendReset(
    "legacy@mailinator.com"
  );
  assert.equal(resent.message, result.message);
  assert.equal(otpRows.length, 0);

  await assert.rejects(
    () => passwordResetService.verifyResetOtp("legacy@mailinator.com", "123456"),
    (err) => {
      assert.equal(err.statusCode, 401);
      assert.match(err.message, /invalid verification code/i);
      return true;
    }
  );
});

test("Google-only accounts do not receive password-reset OTPs", async () => {
  await userModel.create({
    name: "G",
    email: "googleonly@example.com",
    passwordHash: null,
    googleSub: "sub-1",
  });
  const result = await passwordResetService.requestReset(
    "googleonly@example.com"
  );
  assert.match(result.message, /if an eligible account exists/i);
  assert.equal(otpRows.length, 0);
});

test("signup OTPs cannot authorize password resets", async () => {
  await userModel.create({
    name: "Local",
    email: "mix@example.com",
    passwordHash: await bcrypt.hash("Password1", 10),
  });
  await otpService.requestOtp(
    "mix@example.com",
    "Local",
    await bcrypt.hash("Password1", 10)
  );
  assert.equal(otpRows[0].purpose, "signup");
  await assert.rejects(
    () => passwordResetService.verifyResetOtp("mix@example.com", "000000"),
    (err) => {
      assert.equal(err.statusCode, 401);
      return true;
    }
  );
});

test("hashed OTPs are stored, verified once, and cannot be replayed", async () => {
  await userModel.create({
    name: "Local",
    email: "otp@example.com",
    passwordHash: await bcrypt.hash("Password1", 10),
  });
  await passwordResetService.requestReset("otp@example.com");
  const row = otpRows[0];
  assert.notEqual(row.otp.length, 6);
  assert.equal(row.otp.length, 64);

  await assert.rejects(
    () => passwordResetService.verifyResetOtp("otp@example.com", "000000"),
    /invalid verification code/i
  );

  const match = otpRows.find(function (r) {
    return r.purpose === "password_reset";
  });
  const known = "123456";
  match.otp = require("../src/services/otpService").hashOtp(known);
  match.attempts = 0;
  match.consumed_at = null;
  match.expires_at = new Date(Date.now() + 600000);

  const first = await passwordResetService.verifyResetOtp(
    "otp@example.com",
    known
  );
  assert.ok(first.resetToken);
  assert.equal(match.consumed_at != null, true);

  await assert.rejects(
    () => passwordResetService.verifyResetOtp("otp@example.com", known),
    /invalid verification code/i
  );
});

test("reset authorization is single-use and expired tokens fail", async () => {
  const hash = await bcrypt.hash("Password1", 10);
  const user = await userModel.create({
    name: "Local",
    email: "reset@example.com",
    passwordHash: hash,
  });
  await passwordResetService.requestReset("reset@example.com");
  const row = otpRows[0];
  const known = "654321";
  row.otp = require("../src/services/otpService").hashOtp(known);
  row.expires_at = new Date(Date.now() + 600000);

  const verified = await passwordResetService.verifyResetOtp(
    "reset@example.com",
    known
  );
  await passwordResetService.resetPassword(verified.resetToken, "Newpass9");

  const updated = await userModel.findById(user.id);
  assert.equal(await bcrypt.compare("Newpass9", updated.password_hash), true);
  assert.equal(updated.token_version, 1);

  await assert.rejects(
    () => passwordResetService.resetPassword(verified.resetToken, "Another1"),
    /invalid or expired/i
  );

  await assert.rejects(
    () => passwordResetService.resetPassword("deadbeef", "Another1"),
    /invalid or expired/i
  );
});
