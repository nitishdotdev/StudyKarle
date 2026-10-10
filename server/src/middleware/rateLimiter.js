const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const MemoryStore = require("express-rate-limit/lib/memory-store");

/**
 * All thresholds are configurable via environment variables so limits can be
 * tuned per-environment without a code change. Sensible defaults are used
 * when a variable is not set.
 */
function int(name, fallback) {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function emailFromBody(req) {
  return req.body && req.body.email
    ? String(req.body.email).toLowerCase().trim()
    : "";
}

function clientIp(req) {
  return req.ip || "unknown";
}

function ipKey(req) {
  return clientIp(req);
}

function accountAwareKey(req) {
  // Combine client IP with the account identifier (email) when present so a
  // single IP can't brute-force many accounts, without needing a hard
  // account lockout. Requests with no email still fall back to IP so missing
  // fields cannot bypass the limiter.
  const email = emailFromBody(req);
  const ip = clientIp(req);
  return email ? ip + ":" + email : ip;
}

/**
 * Build a limiter that never lets transient SERVER failures eat the budget.
 *
 * express-rate-limit v5 only knows "successful" (<400) vs "failed" (>=400), so
 * a 500 caused by a database outage or a failed email send counts as a failed
 * login. During an incident every retry then burns the user's budget and they
 * stay locked out for the whole window after the incident is fixed. Here any
 * response with status >= 500 is refunded from the same store/key afterwards.
 * 4xx (bad credentials, duplicate account, bad OTP) still counts.
 */
function buildLimiter(options) {
  const keyGenerator = options.keyGenerator;
  const store = new MemoryStore(options.windowMs);
  const limiter = rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: !!options.failuresOnly,
    keyGenerator: keyGenerator,
    store: store,
    message: { success: false, message: options.message },
  });

  return function limiterWithServerErrorRefund(req, res, next) {
    const key = keyGenerator(req);
    res.on("finish", function () {
      if (res.statusCode >= 500) {
        store.decrement(key);
      }
    });
    return limiter(req, res, next);
  };
}

// Per account+IP limiter for credential attempts: login, signup.
// Only FAILED attempts (4xx) count; successes and 5xx are not charged.
const authLimiter = buildLimiter({
  windowMs: int("AUTH_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: int("AUTH_RATE_LIMIT_MAX", 8),
  failuresOnly: true,
  keyGenerator: accountAwareKey,
  message: "Too many attempts. Please wait a few minutes before trying again.",
});

// Per-IP limiter across ALL emails, so rotating email addresses cannot dodge
// the per-account limiter above. Higher ceiling because shared campus/office
// NAT IPs legitimately host many students. Failures only.
const authIpLimiter = buildLimiter({
  windowMs: int("AUTH_IP_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: int("AUTH_IP_RATE_LIMIT_MAX", 40),
  failuresOnly: true,
  keyGenerator: ipKey,
  message: "Too many attempts from this network. Please try again later.",
});

// OTP email sending (request-otp). SUCCESSES COUNT here: every success sends
// an email, so unlike login the abuse is in the successful requests.
const otpRequestLimiter = buildLimiter({
  windowMs: int("OTP_REQUEST_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: int("OTP_REQUEST_RATE_LIMIT_MAX", 5),
  keyGenerator: accountAwareKey,
  message: "Too many verification requests. Please try again later.",
});

// Per-IP cap on OTP emails across all addresses (email-bombing / provider
// quota protection). Counts successes; 5xx refunded.
const otpIpLimiter = buildLimiter({
  windowMs: int("OTP_IP_RATE_LIMIT_WINDOW_MS", 60 * 60 * 1000),
  max: int("OTP_IP_RATE_LIMIT_MAX", 20),
  keyGenerator: ipKey,
  message:
    "Too many verification requests from this network. Please try again later.",
});

// OTP verify/resend and password change. Counts every non-5xx attempt.
const sensitiveActionLimiter = buildLimiter({
  windowMs: int("SENSITIVE_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: int("SENSITIVE_RATE_LIMIT_MAX", 5),
  keyGenerator: accountAwareKey,
  message: "Too many attempts. Please try again later.",
});

// Session checks (GET /auth/me) run on every page load and tab focus, so they
// get a generous, separate budget that can never be consumed by login/OTP
// traffic. Keyed by a hash of the session cookie when present (so users behind
// one NAT/proxy IP don't share a bucket), else by IP. The raw token is never
// stored or logged.
function sessionKey(req) {
  const cookieName = process.env.COOKIE_NAME || "studykarle_token";
  const token = req.cookies ? req.cookies[cookieName] : null;
  if (token) {
    return (
      "sess:" +
      crypto.createHash("sha256").update(String(token)).digest("hex").slice(0, 24)
    );
  }
  return clientIp(req);
}

const sessionCheckLimiter = buildLimiter({
  windowMs: int("SESSION_RATE_LIMIT_WINDOW_MS", 60 * 1000),
  max: int("SESSION_RATE_LIMIT_MAX", 120),
  keyGenerator: sessionKey,
  message: "Too many session checks. Please slow down.",
});

const publicApiLimiter = rateLimit({
  windowMs: int("PUBLIC_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: int("PUBLIC_RATE_LIMIT_MAX", 300),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
});

const authenticatedActionLimiter = rateLimit({
  windowMs: int("USER_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: int("USER_RATE_LIMIT_MAX", 600),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function (req) {
    return req.user && req.user.id ? "user:" + req.user.id : clientIp(req);
  },
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
});

module.exports = {
  clientIp: clientIp,
  authLimiter: authLimiter,
  authIpLimiter: authIpLimiter,
  otpRequestLimiter: otpRequestLimiter,
  otpIpLimiter: otpIpLimiter,
  sessionCheckLimiter: sessionCheckLimiter,
  sensitiveActionLimiter: sensitiveActionLimiter,
  publicApiLimiter: publicApiLimiter,
  authenticatedActionLimiter: authenticatedActionLimiter,
};
