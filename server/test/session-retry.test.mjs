import test from "node:test";
import assert from "node:assert/strict";
import {
  isTransientError,
  parseRetryAfter,
  computeDelayMs,
  withTransientRetry,
  MAX_WAIT_MS,
} from "../../client/src/utils/sessionRetry.js";

test("treats 429, 502, 503, 504, and network errors as transient", () => {
  assert.equal(isTransientError({ status: 429 }), true);
  assert.equal(isTransientError({ status: 502 }), true);
  assert.equal(isTransientError({ status: 503 }), true);
  assert.equal(isTransientError({ status: 504 }), true);
  assert.equal(isTransientError({ status: 0 }), true);
  assert.equal(isTransientError({}), true);
  assert.equal(isTransientError({ status: 401 }), false);
  assert.equal(isTransientError({ status: 400 }), false);
  assert.equal(isTransientError({ status: 500 }), false);
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

test("retries transient errors then recovers", async () => {
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

test("stops after exhausting retries on persistent 429", async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      withTransientRetry(
        function () {
          attempts += 1;
          return Promise.reject({ status: 429, message: "Too many requests" });
        },
        {
          maxAttempts: 4,
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
  assert.equal(attempts, 4);
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
