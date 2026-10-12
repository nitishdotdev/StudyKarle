export const TRANSIENT_STATUSES = [429, 502, 503, 504];
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

export function isTransientError(error) {
  const status = getStatus(error);
  if (TRANSIENT_STATUSES.indexOf(status) !== -1) {
    return true;
  }
  if (status === 0) {
    return true;
  }
  return false;
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

export function withTransientRetry(fn, options) {
  const opts = options || {};
  const maxAttempts = opts.maxAttempts || MAX_ATTEMPTS;
  const sleep = opts.sleep || defaultSleep;

  function run(attempt) {
    return Promise.resolve()
      .then(fn)
      .catch(function (err) {
        if (!isTransientError(err) || attempt >= maxAttempts - 1) {
          return Promise.reject(err);
        }
        return sleep(computeDelayMs(err, attempt, opts)).then(function () {
          return run(attempt + 1);
        });
      });
  }

  return run(0);
}
