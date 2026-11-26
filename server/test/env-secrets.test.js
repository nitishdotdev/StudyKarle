process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");

const ENV_PATH = path.join(__dirname, "..", "src", "config", "env.js");

const VALID_PROD_SECRETS = {
  JWT_SECRET: "a".repeat(32) + "_jwt_prod_secret",
  CSRF_SECRET: "b".repeat(32) + "_csrf_prod_secret",
  OTP_SECRET: "c".repeat(32) + "_otp_prod_secret",
};

function runLoadEnv(envVars) {
  const script =
    "const env = require(process.argv[1]);" +
    "process.stdout.write(JSON.stringify({" +
    "jwtSecret: env.jwtSecret," +
    "csrfSecret: env.csrfSecret," +
    "otpSecret: env.otpSecret," +
    "isProduction: env.isProduction" +
    "}));";

  try {
    const stdout = execFileSync(process.execPath, ["-e", script, ENV_PATH], {
      env: Object.assign({ PATH: process.env.PATH }, envVars),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, data: JSON.parse(stdout) };
  } catch (err) {
    return {
      ok: false,
      stderr: String(err.stderr || ""),
      stdout: String(err.stdout || ""),
      status: err.status,
    };
  }
}

test("production startup fails when JWT_SECRET is missing", () => {
  const res = runLoadEnv({
    NODE_ENV: "production",
    CSRF_SECRET: VALID_PROD_SECRETS.CSRF_SECRET,
    OTP_SECRET: VALID_PROD_SECRETS.OTP_SECRET,
  });
  assert.equal(res.ok, false);
  assert.match(res.stderr, /Missing required production environment variable: JWT_SECRET/);
});

test("production startup fails when CSRF_SECRET is missing", () => {
  const res = runLoadEnv({
    NODE_ENV: "production",
    JWT_SECRET: VALID_PROD_SECRETS.JWT_SECRET,
    OTP_SECRET: VALID_PROD_SECRETS.OTP_SECRET,
  });
  assert.equal(res.ok, false);
  assert.match(res.stderr, /Missing required production environment variable: CSRF_SECRET/);
});

test("production startup fails when OTP_SECRET is missing", () => {
  const res = runLoadEnv({
    NODE_ENV: "production",
    JWT_SECRET: VALID_PROD_SECRETS.JWT_SECRET,
    CSRF_SECRET: VALID_PROD_SECRETS.CSRF_SECRET,
  });
  assert.equal(res.ok, false);
  assert.match(res.stderr, /Missing required production environment variable: OTP_SECRET/);
});

test("production startup rejects insecure placeholder secrets", () => {
  const placeholders = [
    "dev_secret_change_me",
    "change_this_to_a_long_random_string",
    "change_this_to_a_separate_long_random_csrf_secret",
    "change_this_to_a_separate_long_random_otp_secret",
    "test_secret_change_me",
  ];
  for (const placeholder of placeholders) {
    const res = runLoadEnv({
      NODE_ENV: "production",
      JWT_SECRET: placeholder,
      CSRF_SECRET: VALID_PROD_SECRETS.CSRF_SECRET,
      OTP_SECRET: VALID_PROD_SECRETS.OTP_SECRET,
    });
    assert.equal(res.ok, false, "placeholder must be rejected: " + placeholder);
    assert.match(res.stderr, /Insecure placeholder value configured for production secret: JWT_SECRET/);
    assert.equal(
      res.stderr.includes(placeholder),
      false,
      "error output must not leak secret value"
    );
  }
});

test("production startup rejects secrets shorter than 32 characters", () => {
  const shortSecret = "short_secret_value_12345";
  const res = runLoadEnv({
    NODE_ENV: "production",
    JWT_SECRET: shortSecret,
    CSRF_SECRET: VALID_PROD_SECRETS.CSRF_SECRET,
    OTP_SECRET: VALID_PROD_SECRETS.OTP_SECRET,
  });
  assert.equal(res.ok, false);
  assert.match(res.stderr, /Production secret JWT_SECRET must be at least 32 characters long/);
  assert.equal(res.stderr.includes(shortSecret), false);
});

test("production startup rejects reused secrets across JWT, CSRF, and OTP", () => {
  const shared = "s".repeat(40);

  const jwtEqCsrf = runLoadEnv({
    NODE_ENV: "production",
    JWT_SECRET: shared,
    CSRF_SECRET: shared,
    OTP_SECRET: VALID_PROD_SECRETS.OTP_SECRET,
  });
  assert.equal(jwtEqCsrf.ok, false);
  assert.match(jwtEqCsrf.stderr, /CSRF_SECRET must be distinct from JWT_SECRET/);

  const jwtEqOtp = runLoadEnv({
    NODE_ENV: "production",
    JWT_SECRET: shared,
    CSRF_SECRET: VALID_PROD_SECRETS.CSRF_SECRET,
    OTP_SECRET: shared,
  });
  assert.equal(jwtEqOtp.ok, false);
  assert.match(jwtEqOtp.stderr, /OTP_SECRET must be distinct from JWT_SECRET/);

  const csrfEqOtp = runLoadEnv({
    NODE_ENV: "production",
    JWT_SECRET: VALID_PROD_SECRETS.JWT_SECRET,
    CSRF_SECRET: shared,
    OTP_SECRET: shared,
  });
  assert.equal(csrfEqOtp.ok, false);
  assert.match(csrfEqOtp.stderr, /OTP_SECRET must be distinct from CSRF_SECRET/);
});

test("production startup succeeds with distinct high-entropy secrets", () => {
  const res = runLoadEnv(Object.assign({ NODE_ENV: "production" }, VALID_PROD_SECRETS));
  assert.equal(res.ok, true);
  assert.equal(res.data.isProduction, true);
  assert.equal(res.data.jwtSecret, VALID_PROD_SECRETS.JWT_SECRET);
  assert.equal(res.data.csrfSecret, VALID_PROD_SECRETS.CSRF_SECRET);
  assert.equal(res.data.otpSecret, VALID_PROD_SECRETS.OTP_SECRET);
});

test("production preserves raw JWT_SECRET value without trimming surrounding whitespace", () => {
  const paddedJwt = " " + VALID_PROD_SECRETS.JWT_SECRET + " ";
  const res = runLoadEnv({
    NODE_ENV: "production",
    JWT_SECRET: paddedJwt,
    CSRF_SECRET: VALID_PROD_SECRETS.CSRF_SECRET,
    OTP_SECRET: VALID_PROD_SECRETS.OTP_SECRET,
  });
  assert.equal(res.ok, true);
  assert.equal(res.data.jwtSecret, paddedJwt);
});

test("non-production derives distinct fallback secrets when CSRF_SECRET and OTP_SECRET are unset", () => {
  const res = runLoadEnv({
    NODE_ENV: "development",
    JWT_SECRET: "local_dev_jwt_secret",
  });
  assert.equal(res.ok, true);
  assert.equal(res.data.isProduction, false);
  assert.equal(res.data.jwtSecret, "local_dev_jwt_secret");
  assert.notEqual(res.data.csrfSecret, res.data.jwtSecret);
  assert.notEqual(res.data.otpSecret, res.data.jwtSecret);
  assert.notEqual(res.data.csrfSecret, res.data.otpSecret);
});

test("otpService.hashOtp uses env.otpSecret rather than env.jwtSecret", () => {
  const env = require("../src/config/env");
  const { hmacSha256 } = require("../src/utils/cryptoHash");
  const otpService = require("../src/services/otpService");

  const digest = otpService.hashOtp("654321");
  assert.equal(digest, hmacSha256("654321", env.otpSecret));
  assert.notEqual(digest, hmacSha256("654321", env.jwtSecret));
});

test("csrfProtection issues and validates tokens using env.csrfSecret", async () => {
  const csrfProtection = require("../src/middleware/csrfProtection");
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.get("/csrf", csrfProtection.issueToken);
  app.post("/mutate", csrfProtection, (req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({ message: err.message });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const tokenRes = await fetch(`http://127.0.0.1:${port}/csrf`);
    assert.equal(tokenRes.status, 200);
    const tokenJson = await tokenRes.json();
    const setCookie = tokenRes.headers.get("set-cookie");
    assert.ok(setCookie && setCookie.startsWith("csrf="));
    const cookieHeader = setCookie.split(";")[0];

    const validRes = await fetch(`http://127.0.0.1:${port}/mutate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRF-Token": tokenJson.data.csrfToken,
        Cookie: cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(validRes.status, 200);

    const invalidRes = await fetch(`http://127.0.0.1:${port}/mutate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRF-Token": "forged-token",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({}),
    });
    assert.equal(invalidRes.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
