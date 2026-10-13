import test from "node:test";
import assert from "node:assert/strict";
import {
  isTransientError,
  isRetryableError,
  isCanceled,
  parseRetryAfter,
  computeDelayMs,
  withTransientRetry,
  RETRYABLE_STATUSES,
  MAX_WAIT_MS,
} from "../../client/src/utils/sessionRetry.js";

test("429 is transient (result unknown) but must NOT be auto-retried", () => {
  assert.equal(isTransientError({ status: 429 }), true);
  assert.equal(isRetryableError({ status: 429 }), false);
});

test("treats 502, 503, 504, and network errors as transient and retryable", () => {
  RETRYABLE_STATUSES.forEach((status) => {
    assert.equal(isTransientError({ status }), true);
    assert.equal(isRetryableError({ status }), true);
  });
  assert.equal(isTransientError({ status: 0 }), true);
  assert.equal(isRetryableError({ status: 0 }), true);
  assert.equal(isTransientError({}), true);
  assert.equal(isRetryableError({}), true);
});

test("definitive answers (401/400/500) are neither transient nor retryable", () => {
  assert.equal(isTransientError({ status: 401 }), false);
  assert.equal(isTransientError({ status: 400 }), false);
  assert.equal(isTransientError({ status: 500 }), false);
  assert.equal(isRetryableError({ status: 401 }), false);
  assert.equal(isRetryableError({ status: 400 }), false);
  assert.equal(isRetryableError({ status: 500 }), false);
});

test("aborted requests are detected and never retried", () => {
  assert.equal(isCanceled({ code: "ERR_CANCELED" }), true);
  assert.equal(isCanceled({ name: "CanceledError" }), true);
  assert.equal(isCanceled({ name: "AbortError" }), true);
  assert.equal(isCanceled({ status: 0 }), false);
  assert.equal(isTransientError({ code: "ERR_CANCELED" }), false);
  assert.equal(isRetryableError({ code: "ERR_CANCELED" }), false);
});

test("respects Retry-After up to the maximum wait", () => {
  assert.equal(parseRetryAfter("2"), 2000);
  assert.equal(parseRetryAfter("0"), 0);
  assert.equal(parseRetryAfter("nope"), null);
  const delay = computeDelayMs({ retryAfter: "30" }, 0, { maxWaitMs: MAX_WAIT_MS });
  assert.equal(delay, MAX_WAIT_MS);
  const short = computeDelayMs({ retryAfter: "1" }, 0);
  assert.equal(short, 1000);
});

test("retries a transient 5xx error then recovers", async () => {
  let attempts = 0;
  const result = await withTransientRetry(
    function () {
      attempts += 1;
      if (attempts < 3) {
        return Promise.reject({ status: 503, message: "cold" });
      }
      return Promise.resolve({ id: "u1" });
    },
    {
      sleep: function () {
        return Promise.resolve();
      },
      random: function () {
        return 0;
      },
    }
  );
  assert.equal(attempts, 3);
  assert.equal(result.id, "u1");
});

test("does not retry a genuine 401", async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      withTransientRetry(
        function () {
          attempts += 1;
          return Promise.reject({
            status: 401,
            message: "Authentication required",
          });
        },
        {
          sleep: function () {
            return Promise.resolve();
          },
        }
      ),
    (err) => {
      assert.equal(err.status, 401);
      return true;
    }
  );
  assert.equal(attempts, 1);
});

test("does NOT retry a persistent 429 (no burst)", async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      withTransientRetry(
        function () {
          attempts += 1;
          return Promise.reject({ status: 429, message: "Too many requests" });
        },
        {
          sleep: function () {
            return Promise.resolve();
          },
        }
      ),
    (err) => {
      assert.equal(err.status, 429);
      return true;
    }
  );
  assert.equal(attempts, 1);
});

test("retries network failures then gives up", async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      withTransientRetry(
        function () {
          attempts += 1;
          return Promise.reject({ status: 0, message: "Network Error" });
        },
        {
          maxAttempts: 3,
          sleep: function () {
            return Promise.resolve();
          },
        }
      ),
    (err) => {
      assert.equal(err.status, 0);
      return true;
    }
  );
  assert.equal(attempts, 3);
});
