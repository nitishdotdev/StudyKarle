const crypto = require("crypto");
require("dotenv").config();

const MIN_PRODUCTION_SECRET_LENGTH = 32;
const INSECURE_PLACEHOLDER_SECRETS = new Set([
  "dev_secret_change_me",
  "dev_jwt_secret_change_me",
  "dev_csrf_secret_change_me",
  "dev_otp_secret_change_me",
  "change_this_to_a_long_random_string",
  "change_this_to_a_separate_long_random_csrf_secret",
  "change_this_to_a_separate_long_random_otp_secret",
  "test_secret_change_me",
  "secret",
  "changeme",
]);

function isPlaceholderSecret(value) {
  return INSECURE_PLACEHOLDER_SECRETS.has(String(value || "").trim().toLowerCase());
}

function validateProductionSecret(name, rawValue) {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!value) {
    throw new Error(
      "Missing required production environment variable: " + name
    );
  }
  if (isPlaceholderSecret(value)) {
    throw new Error(
      "Insecure placeholder value configured for production secret: " + name
    );
  }
  if (value.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      "Production secret " +
        name +
        " must be at least " +
        MIN_PRODUCTION_SECRET_LENGTH +
        " characters long"
    );
  }
  return value;
}

function deriveDevSecret(baseSecret, domain) {
  return crypto
    .createHmac("sha256", baseSecret)
    .update("studykarle:dev:" + domain)
    .digest("hex");
}

function resolveSecrets(production) {
  if (production) {
    const jwtSecret = validateProductionSecret("JWT_SECRET", process.env.JWT_SECRET);
    const csrfSecret = validateProductionSecret("CSRF_SECRET", process.env.CSRF_SECRET);
    const otpSecret = validateProductionSecret("OTP_SECRET", process.env.OTP_SECRET);

    if (jwtSecret === csrfSecret) {
      throw new Error("CSRF_SECRET must be distinct from JWT_SECRET in production");
    }
    if (jwtSecret === otpSecret) {
      throw new Error("OTP_SECRET must be distinct from JWT_SECRET in production");
    }
    if (csrfSecret === otpSecret) {
      throw new Error("OTP_SECRET must be distinct from CSRF_SECRET in production");
    }

    return { jwtSecret, csrfSecret, otpSecret };
  }

  const rawJwt = typeof process.env.JWT_SECRET === "string" ? process.env.JWT_SECRET.trim() : "";
  const rawCsrf = typeof process.env.CSRF_SECRET === "string" ? process.env.CSRF_SECRET.trim() : "";
  const rawOtp = typeof process.env.OTP_SECRET === "string" ? process.env.OTP_SECRET.trim() : "";

  const jwtSecret = rawJwt || "dev_jwt_secret_change_me";
  const csrfSecret = rawCsrf || deriveDevSecret(jwtSecret, "csrf");
  const otpSecret = rawOtp || deriveDevSecret(jwtSecret, "otp");

  return { jwtSecret, csrfSecret, otpSecret };
}

function corsOrigins() {
  // Comma-separated allowlist from the environment, falling back to the
  // documented defaults. Credentialed requests (cookies) must never be
  // served with Access-Control-Allow-Origin: *.
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const origins = [clientUrl];
  if (origins.indexOf("http://localhost:5173") === -1) {
    origins.push("http://localhost:5173");
  }
  if (origins.indexOf("http://127.0.0.1:5173") === -1) {
    origins.push("http://127.0.0.1:5173");
  }
  return origins;
}

// Number of reverse-proxy hops in front of Express whose X-Forwarded-For
// entry may be trusted. Default 1 preserves existing behaviour. Do NOT
// raise it until the real chain is verified (see proxyDiagnostics.js),
// otherwise clients can spoof their IP and dodge rate limits.
function trustProxyHops() {
  const raw = process.env.TRUST_PROXY_HOPS;
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 1;
}

function isLoopbackHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isValidProductionAuthRedirectUri(uri) {
  if (!uri || typeof uri !== "string") return false;
  let parsed;
  try {
    parsed = new URL(uri);
  } catch (err) {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname || isLoopbackHostname(parsed.hostname)) return false;
  return true;
}

function googleAuthRedirectUri() {
  const raw = (process.env.GOOGLE_OAUTH_REDIRECT_URI || "").trim();
  const production =
    (process.env.NODE_ENV || "development") === "production";
  if (production) {
    return isValidProductionAuthRedirectUri(raw) ? raw : "";
  }
  return raw || "http://localhost:5000/api/auth/google/callback";
}

const googleOauthClientId =
  process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
const googleOauthClientSecret =
  process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  "";
const googleAuthRedirect = googleAuthRedirectUri();
const googleOauthSignInConfigured = !!(
  googleOauthClientId &&
  googleOauthClientSecret &&
  googleAuthRedirect
);

const isProduction = (process.env.NODE_ENV || "development") === "production";
const secrets = resolveSecrets(isProduction);

module.exports = {
  trustProxyHops: trustProxyHops(),
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  corsOrigins: corsOrigins(),

  jwtSecret: secrets.jwtSecret,
  csrfSecret: secrets.csrfSecret,
  otpSecret: secrets.otpSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  cookieName: process.env.COOKIE_NAME || "studykarle_token",

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/oauth2callback",
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
    oauthClientId: googleOauthClientId,
    oauthClientSecret: googleOauthClientSecret,
    authRedirectUri: googleAuthRedirect,
    oauthSignInConfigured: googleOauthSignInConfigured,
  },

  // Google Drive sync scheduler. Interval of 0 disables the periodic run
  // (the initial sync on boot still runs when DRIVE_SYNC_ON_START !== "false").
  driveSync: {
    intervalMs: Number(process.env.DRIVE_SYNC_INTERVAL_MS) || 0,
    onStart: process.env.DRIVE_SYNC_ON_START !== "false",
  },

  // FIXED: Proper default value with angle brackets
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "StudyKarle <onboarding@resend.dev>",

  otp: {
    expiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES) || 10,
    maxResendAttempts: Number(process.env.OTP_MAX_RESEND) || 3,
  },

  isProduction: isProduction,
};
