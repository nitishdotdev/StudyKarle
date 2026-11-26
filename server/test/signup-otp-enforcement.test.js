process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");

// Stub DB-backed models and email sender before loading auth routes/services.
const users = [];
const otpRows = [];
let sentOtps = [];
let nextUserId = 1;
let nextOtpId = 1;

const userModel = require("../src/models/userModel");
userModel.findByEmail = async (email) =>
  users.find((u) => u.email === String(email).toLowerCase()) || null;
userModel.findById = async (id) => users.find((u) => u.id === id) || null;
userModel.findByGoogleSub = async (sub) =>
  users.find((u) => u.google_sub === sub) || null;
userModel.create = async (data) => {
  const row = {
    id: nextUserId++,
    name: data.name,
    email: String(data.email).toLowerCase(),
    password_hash: data.passwordHash || null,
    role: data.role || "student",
    google_sub: data.googleSub || null,
    avatar_url: data.avatarUrl || null,
    course: null,
    current_year: null,
    token_version: 0,
    created_at: new Date().toISOString(),
  };
  users.push(row);
  return row;
};

const otpVerificationModel = require("../src/models/otpVerificationModel");
otpVerificationModel.removeByEmailAndPurpose = async (email, purpose) => {
  for (let i = otpRows.length - 1; i >= 0; i--) {
    if (otpRows[i].email === email && otpRows[i].purpose === purpose) {
      otpRows.splice(i, 1);
    }
  }
};
otpVerificationModel.create = async (data) => {
  const row = {
    id: nextOtpId++,
    email: data.email,
    name: data.name,
    password_hash: data.passwordHash,
    otp: data.otp,
    expires_at: data.expiresAt,
    resend_count: data.resendCount || 0,
    purpose: data.purpose,
    attempts: data.attempts || 0,
    consumed_at: null,
  };
  otpRows.push(row);
  return row;
};
otpVerificationModel.findLatestByEmailAndPurpose = async (email, purpose) => {
  const matches = otpRows.filter(
    (r) => r.email === email && r.purpose === purpose && !r.consumed_at
  );
  return matches.length ? matches[matches.length - 1] : null;
};
otpVerificationModel.incrementAttempts = async (id) => {
  const row = otpRows.find((r) => r.id === id);
  if (row) row.attempts += 1;
};
otpVerificationModel.consume = async (id) => {
  const row = otpRows.find((r) => r.id === id);
  if (row) row.consumed_at = new Date();
};

const emailService = require("../src/services/emailService");
emailService.sendEmail = async (payload) => {
  const match = String(payload.text || "").match(/\b(\d{6})\b/);
  sentOtps.push({ to: payload.to, otp: match ? match[1] : null });
  return { id: "mock-email-id" };
};

const authRoutes = require("../src/routes/authRoutes");
const authService = require("../src/services/authService");
const googleAuthService = require("../src/services/googleAuthService");
const errorHandler = require("../src/middleware/errorHandler");

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

function resetState() {
  users.length = 0;
  otpRows.length = 0;
  sentOtps = [];
  nextUserId = 1;
  nextOtpId = 1;
}

test("POST /api/auth/signup is disabled (410), creates no user, and issues no session cookie", async () => {
  resetState();
  const srv = await createTestServer();
  try {
    const res = await fetch(`${srv.baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bypass Attempt",
        email: "bypass@example.com",
        password: "Password123",
      }),
    });
    assert.equal(res.status, 410);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /request-otp/i);
    assert.equal(body.code, "EMAIL_VERIFICATION_REQUIRED");
    assert.equal(res.headers.get("set-cookie"), null);
    assert.equal(users.length, 0);
  } finally {
    await srv.close();
  }
});

test("authService.signup directly rejects unverified account creation", async () => {
  resetState();
  await assert.rejects(
    () =>
      authService.signup({
        name: "Direct Caller",
        email: "direct@example.com",
        password: "Password123",
      }),
    (err) => err.statusCode === 410 && err.code === "EMAIL_VERIFICATION_REQUIRED"
  );
  assert.equal(users.length, 0);
});

test("email signup requires OTP verification before account creation and session issuance", async () => {
  resetState();
  const srv = await createTestServer();
  try {
    // 1. Request OTP — sends code, does NOT create user or set session cookie
    const reqRes = await fetch(`${srv.baseUrl}/api/auth/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Verified Student",
        email: "student@example.com",
        password: "Password123",
      }),
    });
    assert.equal(reqRes.status, 200);
    assert.equal(reqRes.headers.get("set-cookie"), null);
    assert.equal(users.length, 0);
    assert.equal(sentOtps.length, 1);
    const issuedOtp = sentOtps[0].otp;
    assert.match(issuedOtp, /^\d{6}$/);

    // 2. Wrong OTP — rejected (401), no user, no cookie
    const wrongOtp = issuedOtp === "000000" ? "111111" : "000000";
    const badRes = await fetch(`${srv.baseUrl}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@example.com",
        otp: wrongOtp,
      }),
    });
    assert.equal(badRes.status, 401);
    assert.equal(badRes.headers.get("set-cookie"), null);
    assert.equal(users.length, 0);

    // 3. Valid OTP — creates student account and issues HttpOnly session cookie
    const okRes = await fetch(`${srv.baseUrl}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@example.com",
        otp: issuedOtp,
      }),
    });
    assert.equal(okRes.status, 201);
    const setCookie = okRes.headers.get("set-cookie") || "";
    assert.match(setCookie, /studykarle_token=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.equal(users.length, 1);
    assert.equal(users[0].email, "student@example.com");
    assert.equal(users[0].role, "student");

    // 4. Replaying the same OTP fails
    const replayRes = await fetch(`${srv.baseUrl}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@example.com",
        otp: issuedOtp,
      }),
    });
    assert.equal(replayRes.status, 401);
  } finally {
    await srv.close();
  }
});

test("Google OAuth new-user creation continues to work without email OTP", async () => {
  resetState();
  const result = await googleAuthService.findOrCreateFromGoogle({
    sub: "google-sub-verified-123",
    email: "google.student@example.com",
    name: "Google Student",
    picture: "https://example.com/avatar.png",
  });
  assert.equal(result.status, "authenticated");
  assert.equal(result.user.email, "google.student@example.com");
  assert.equal(result.user.role, "student");
  assert.equal(result.user.google_linked, true);
  assert.equal(users.length, 1);
});
