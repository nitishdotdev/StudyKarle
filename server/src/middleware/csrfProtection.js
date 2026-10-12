const ApiError = require("../utils/ApiError");

// CSRF defense for cookie-authenticated state-changing requests.
//
// Every state-changing request from the StudyKarle client goes through axios,
// which sets the `X-Requested-With: XMLHttpRequest` header. Browsers cannot
// attach custom headers to cross-site requests (forms, images, iframes) without
// first passing a CORS preflight, and the preflight is rejected for any origin
// outside the trusted allowlist. Requiring the header therefore blocks CSRF
// while leaving the first-party client untouched. CORS alone is not enough —
// this header check is the enforcement layer.
module.exports = function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].indexOf(req.method) !== -1) {
    return next();
  }

  // Browser redirects from Google cannot attach X-Requested-With. The
  // callback is GET-only and already skipped above; this documents the
  // exemption if a POST token-exchange is ever added.
  if (req.originalUrl.indexOf("/auth/google") === 0) {
    return next();
  }

  if (req.headers["x-requested-with"] !== "XMLHttpRequest") {
    return next(
      ApiError.forbidden("CSRF protection: request must include an X-Requested-With header")
    );
  }

  next();
};
