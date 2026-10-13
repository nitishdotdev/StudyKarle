// Retry policy for the initial session check (GET /api/auth/me).
//
// Two distinct questions are answered here:
//   1. isTransientError()  -> "the result is UNKNOWN, not a logout". Used for
//      authentication-state handling (keep the session, surface retry UI).
//   2. isRetryableError()  -> "it is safe and useful to send the request
//      again". Used for automatic retries.
//
// HTTP 429 is deliberately transient but NOT retryable. A 429 means "slow
// down"; blindly retrying it (especially Render's `hibernate-rate-limited`
// response, which comes from the platform router before Express) multiplies
// the burst instead of helping. A 429 must never be treated as proof that the
// visitor is logged out.

// Server/proxy errors with no side effects worth retrying automatically.
export const RETRYABLE_STATUSES = [502, 503, 504];
// Anything that leaves the authentication result unknown. 429 is included:
// the server answered, but it did not answer the question we asked.
export const TRANSIENT_STATUSES = [429].concat(RETRYABLE_STATUSES);
export const MAX_ATTEMPTS = 4;
export const MAX_WAIT_MS = 8000;
export const BASE_DELAY_MS = 400;

export function getStatus(error) {
  if (!error) {
    return 0;
  }
  if (typeof error.status === "number") {
    return error.status;
  }
  if (error.response && typeof error.response.status === "number") {
    return error.response.status;
  }
  return 0;
}

// Axios reports an aborted request with no response and one of these codes.
// A cancelled request (e.g. the component unmounted) must never be retried or
// mistaken for a network outage.
export function isCanceled(error) {
  if (!error) {
    return false;
  }
  const code = error.code || (error.response && error.response.code);
  if (code === "ERR_CANCELED" || code === "ECONNABORTED") {
    return true;
  }
  const name = error.name;
  return name === "CanceledError" || name === "AbortError";
}

export function isTransientError(error) {
  if (isCanceled(error)) {
    return false;
  }
  const status = getStatus(error);
  if (TRANSIENT_STATUSES.indexOf(status) !== -1) {
    return true;
  }
  if (status === 0) {
    return true;
  }
  return false;
}

// Safe to retry automatically: transient 5xx and network errors. A 429 is
// intentionally excluded, and so is any cancelled request.
export function isRetryableError(error) {
  if (isCanceled(error)) {
    return false;
  }
  const status = getStatus(error);
  if (RETRYABLE_STATUSES.indexOf(status) !== -1) {
    return true;
  }
  return status === 0;
}

export function parseRetryAfter(value) {
  if (value == null || value === "") {
    return null;
  }
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  return Math.ceil(seconds * 1000);
}

export function computeDelayMs(error, attempt, options) {
  const maxWait = (options && options.maxWaitMs) || MAX_WAIT_MS;
  const retryAfter = parseRetryAfter(error && error.retryAfter);
  if (retryAfter != null) {
    return Math.min(retryAfter, maxWait);
  }
  const base = (options && options.baseDelayMs) || BASE_DELAY_MS;
  const exp = Math.min(maxWait, base * Math.pow(2, attempt));
  const randomFn = options && options.random ? options.random : Math.random;
  return Math.floor(randomFn() * exp);
}

function defaultSleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// Bounded retry for idempotent, retryable failures only. Non-retryable errors
// (401, 429, 4xx, cancellations) reject immediately on the first attempt, so a
// single logical session check never turns into a burst of requests.
export function withTransientRetry(fn, options) {
  const opts = options || {};
  const maxAttempts = opts.maxAttempts || MAX_ATTEMPTS;
  const sleep = opts.sleep || defaultSleep;

  function run(attempt) {
    return Promise.resolve()
      .then(fn)
      .catch(function (err) {
        if (!isRetryableError(err) || attempt >= maxAttempts - 1) {
          return Promise.reject(err);
        }
        return sleep(computeDelayMs(err, attempt, opts)).then(function () {
          return run(attempt + 1);
        });
      });
  }

  return run(0);
}
