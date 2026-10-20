const { doubleCsrf } = require("csrf-csrf");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

const CSRF_COOKIE_NAME = "csrf";

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: function () {
    return env.jwtSecret;
  },
  getSessionIdentifier: function () {
    return "anonymous";
  },
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: {
    sameSite: env.isProduction ? "none" : "lax",
    secure: env.isProduction,
    httpOnly: true,
    path: "/",
  },
  getCsrfTokenFromRequest: function (req) {
    return req.headers["x-csrf-token"];
  },
});

function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].indexOf(req.method) === -1) {
    if (req.headers["x-requested-with"] !== "XMLHttpRequest") {
      return next(
        ApiError.forbidden(
          "CSRF protection: request must include an X-Requested-With header"
        )
      );
    }

    const csrfCookie = req.cookies && req.cookies.csrf;
    const csrfHeader = req.headers["x-csrf-token"];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return next(ApiError.forbidden("CSRF protection: invalid CSRF token"));
    }
  }

  doubleCsrfProtection(req, res, function (err) {
    if (err) {
      return next(ApiError.forbidden("CSRF protection: invalid CSRF token"));
    }
    next();
  });
}

function applyPartitionedFlag(res) {
  if (!env.isProduction) return;
  let cookies = res.getHeader("Set-Cookie");
  if (!cookies) return;
  if (!Array.isArray(cookies)) cookies = [cookies];
  res.setHeader(
    "Set-Cookie",
    cookies.map(function (c) {
      if (c.indexOf(CSRF_COOKIE_NAME + "=") === 0 && c.indexOf("Partitioned") === -1) {
        return c + "; Partitioned";
      }
      return c;
    })
  );
}

function issueToken(req, res) {
  const csrfToken = generateCsrfToken(req, res);
  applyPartitionedFlag(res);
  res.status(200).json({
    success: true,
    data: { csrfToken: csrfToken },
  });
}

csrfProtection.issueToken = issueToken;
module.exports = csrfProtection;
