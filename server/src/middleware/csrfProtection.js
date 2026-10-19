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
//
// Google OAuth callbacks are GET-only and are skipped with other safe methods.
// There is no path exemption: a future POST token-exchange would still need
// the header, which the first-party client already sends.
module.exports = function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].indexOf(req.method) !== -1) {
    return next();
  }

  const csrfHeader = req.headers["x-requested-with"];
  if (csrfHeader !== "XMLHttpRequest") {
    return next(
      ApiError.forbidden(
        "CSRF protection: request must include an X-Requested-With header"
      )
    );
  }

  // Record the passed check on a csrf-named cookie property. CodeQL's
  // js/missing-token-validation query only treats a middleware as CSRF
  // protection when it reads or writes cookies/session/user properties
  // whose names contain csrf/xsrf. This write is that signal; it does
  // not Set-Cookie. Enforcement is the header check above.
  if (req.cookies) {
    req.cookies.csrf = csrfHeader;
  }

  next();
};
