// Regression tests for POST /api/auth/request-otp HTTP 500.
// Resend and otp_verifications are stubbed; no network or Postgres.
//
//   npm run test:otp-email

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.RESEND_API_KEY = "re_test_dummy_key";
process.env.EMAIL_FROM = "StudyKarle <onboarding@resend.dev>";

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

let sendResult = { data: { id: "em_ok" }, error: null };
let sendThrow = null;

class FakeResend {
  constructor() {
    this.emails = {
      send: async function () {
        if (sendThrow) throw sendThrow;
        return sendResult;
      },
    };
  }
}

stub("resend", { Resend: FakeResend });

const rows = new Map();

function normalizeEmail(email) {
  return String(email).toLowerCase();
}

const otpVerificationModel = {
  async removeByEmail(email) {
    rows.delete(normalizeEmail(email));
  },
  async create(data) {
    const row = {
      email: normalizeEmail(data.email),
      name: data.name,
      password_hash: data.passwordHash,
      otp: data.otp,
      expires_at: data.expiresAt,
      resend_count: data.resendCount || 0,
    };
    rows.set(row.email, row);
    return row;
  },
  async findByEmail(email) {
    return rows.get(normalizeEmail(email)) || null;
  },
  async findByEmailAndOtp(email, otp) {
    const row = rows.get(normalizeEmail(email));
    if (!row || row.otp !== String(otp)) return null;
    return row;
  },
};

stub(path.join(__dirname, "..", "src", "models", "otpVerificationModel.js"), otpVerificationModel);

const { sendEmail } = require("../src/services/emailService");
const otpService = require("../src/services/otpService");

const PROVIDER_ERROR = {
  message: "API key is invalid",
  name: "validation_error",
  statusCode: 401,
};

test.beforeEach(() => {
  rows.clear();
  sendResult = { data: { id: "em_ok" }, error: null };
  sendThrow = null;
});

test("provider error becomes operational 503 with a generic message", async () => {
  sendResult = { data: null, error: PROVIDER_ERROR };
  await assert.rejects(
    () =>
      sendEmail({
        to: "a@example.com",
        subject: "s",
        html: "<p>x</p>",
        text: "x",
      }),
    (err) => {
      assert.equal(err.isOperational, true);
      assert.equal(err.statusCode, 503);
      assert.match(err.message, /unable to send verification email/i);
      assert.doesNotMatch(err.message, /api key/i);
      assert.doesNotMatch(err.message, /invalid/i);
      return true;
    }
  );
});

test("SDK throw becomes operational 503 with a generic message", async () => {
  sendThrow = new Error("network down");
  await assert.rejects(
    () =>
      sendEmail({
        to: "a@example.com",
        subject: "s",
        html: "<p>x</p>",
        text: "x",
      }),
    (err) => {
      assert.equal(err.isOperational, true);
      assert.equal(err.statusCode, 503);
      assert.match(err.message, /unable to send verification email/i);
      assert.doesNotMatch(err.message, /network down/i);
      return true;
    }
  );
});

test("requestOtp does not return success when email send fails", async () => {
  sendResult = { data: null, error: PROVIDER_ERROR };
  await assert.rejects(() =>
    otpService.requestOtp("newuser@example.com", "New User", "hash")
  );
});

test("requestOtp rolls back the OTP row when email send fails", async () => {
  sendResult = { data: null, error: PROVIDER_ERROR };
  await assert.rejects(() =>
    otpService.requestOtp("newuser@example.com", "New User", "hash")
  );
  assert.equal(await otpVerificationModel.findByEmail("newuser@example.com"), null);
});

test("requestOtp stores a row when email send succeeds", async () => {
  const result = await otpService.requestOtp(
    "ok@example.com",
    "Ok User",
    "hash"
  );
  assert.equal(result.email, "ok@example.com");
  const row = await otpVerificationModel.findByEmail("ok@example.com");
  assert.ok(row);
  assert.equal(row.otp.length, 6);
});

test("resendOtp rolls back the OTP row when email send fails", async () => {
  await otpVerificationModel.create({
    email: "r@example.com",
    name: "R",
    passwordHash: "h",
    otp: "123456",
    expiresAt: new Date(Date.now() + 600000),
    resendCount: 0,
  });
  sendResult = { data: null, error: PROVIDER_ERROR };
  await assert.rejects(() => otpService.resendOtp("r@example.com"));
  assert.equal(await otpVerificationModel.findByEmail("r@example.com"), null);
});
