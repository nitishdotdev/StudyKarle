import { isTransientError, withTransientRetry } from "./sessionRetry.js";

export const TEMPORARY_SESSION_MESSAGE =
  "StudyKarle is temporarily unavailable. Please try again in a moment.";

/**
 * Pure decision for how the app reacts to a failed session check, so the
 * authentication-state rules can be tested without a browser.
 *
 * Returns one of:
 *   { action: "logout" } -> a documented 401: the visitor is definitively
 *                           unauthenticated. Clears the session.
 *   { action: "keep" }   -> the result is unknown (transient 5xx/429/network)
 *                           or non-fatal; keep whatever session we already had.
 *   { action: "error" }  -> unknown result for a visitor with no prior session:
 *                           show a retry UI instead of wrongly bouncing to
 *                           /login.
 *
 * A 429 is a transient failure, never a logout, and never triggers an
 * immediate retry (see withTransientRetry / isRetryableError).
 */
export function interpretSessionError(error, hasUser) {
  if (error && error.status === 401) {
    return { action: "logout" };
  }
  if (isTransientError(error) && hasUser) {
    return { action: "keep" };
  }
  if (!hasUser) {
    return { action: "error", message: TEMPORARY_SESSION_MESSAGE };
  }
  return { action: "keep" };
}

/**
 * Single-flight runner for the initial authentication session check.
 *
 * Every consumer of the session check (the AuthProvider mount, route guards,
 * a manual "retry", a future tab-focus refresh) calls `check()`. Concurrent
 * callers share ONE in-flight promise, so the application can never issue
 * duplicate `/api/auth/me` requests for the same logical check. Once the
 * promise settles the slot is released, so an explicit later refresh performs
 * a fresh request.
 *
 * The runner is intentionally dependency-free and framework-free so the exact
 * behaviour the app relies on can be unit tested (see server/test).
 *
 * @param {Function} runRequest returns a promise resolving to the current user.
 * @param {Object} [options] forwarded to withTransientRetry (maxAttempts,
 *   sleep, random, maxWaitMs, baseDelayMs). Primarily for tests.
 */
export function createSessionCheck(runRequest, options) {
  if (typeof runRequest !== "function") {
    throw new TypeError("createSessionCheck requires a request function");
  }

  let inFlight = null;

  function check() {
    if (inFlight) {
      return inFlight;
    }
    inFlight = withTransientRetry(function () {
      return runRequest();
    }, options).then(
      function (value) {
        inFlight = null;
        return value;
      },
      function (error) {
        inFlight = null;
        throw error;
      }
    );
    return inFlight;
  }

  function reset() {
    inFlight = null;
  }

  return { check: check, reset: reset };
}
