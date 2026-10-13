import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionCheck,
  interpretSessionError,
  TEMPORARY_SESSION_MESSAGE,
} from "../../client/src/utils/sessionCheck.js";

const noDelay = {
  sleep: function () {
    return Promise.resolve();
  },
  random: function () {
    return 0;
  },
};

test("one initialization issues exactly one session-check request", async () => {
  let requests = 0;
  const check = createSessionCheck(
    function () {
      requests += 1;
      return Promise.resolve({ id: "u1" });
    },
    noDelay
  );

  const user = await check.check();
  assert.equal(user.id, "u1");
  assert.equal(requests, 1);

  // A later explicit refresh is allowed to perform a fresh request (the
  // single-flight slot is released once the previous check settles).
  await check.check();
  assert.equal(requests, 2);
});

test("concurrent consumers share one in-flight request", async () => {
  let requests = 0;
  let release;
  const gate = new Promise(function (resolve) {
    release = resolve;
  });
  const check = createSessionCheck(
    function () {
      requests += 1;
      return gate;
    },
    noDelay
  );

  const a = check.check();
  const b = check.check();
  const c = check.check();
  // Flush one macrotask so the (single) shared request has actually started.
  await new Promise(function (resolve) {
    setImmediate(resolve);
  });
  assert.equal(requests, 1);

  release({ id: "u1" });
  const results = await Promise.all([a, b, c]);
  assert.equal(requests, 1);
  results.forEach((u) => assert.equal(u.id, "u1"));
});

test("a successful response resolves with the current user", async () => {
  const check = createSessionCheck(function () {
    return Promise.resolve({ id: "u9", role: "admin" });
  }, noDelay);
  const user = await check.check();
  assert.deepEqual(user, { id: "u9", role: "admin" });
});

test("an unauthenticated 401 is not retried", async () => {
  let requests = 0;
  const check = createSessionCheck(
    function () {
      requests += 1;
      return Promise.reject({ status: 401, message: "Authentication required" });
    },
    noDelay
  );

  await assert.rejects(
    () => check.check(),
    (err) => {
      assert.equal(err.status, 401);
      return true;
    }
  );
  assert.equal(requests, 1);
});

test("a 429 is not retried and is never treated as a logout", async () => {
  let requests = 0;
  const check = createSessionCheck(
    function () {
      requests += 1;
      return Promise.reject({ status: 429, message: "Too many requests" });
    },
    noDelay
  );

  await assert.rejects(
    () => check.check(),
    (err) => {
      assert.equal(err.status, 429);
      return true;
    }
  );
  assert.equal(requests, 1, "429 must not trigger a retry loop");

  // Existing session is preserved; a fresh visitor gets a retry UI, not a
  // bogus logout.
  assert.equal(interpretSessionError({ status: 429 }, true).action, "keep");
  const fresh = interpretSessionError({ status: 429 }, false);
  assert.equal(fresh.action, "error");
  assert.equal(fresh.message, TEMPORARY_SESSION_MESSAGE);
});

test("401 maps to logout; transient failures never clear the session", () => {
  assert.equal(interpretSessionError({ status: 401 }, true).action, "logout");
  assert.equal(interpretSessionError({ status: 401 }, false).action, "logout");
  assert.equal(interpretSessionError({ status: 503 }, true).action, "keep");
  assert.equal(interpretSessionError({ status: 0 }, true).action, "keep");
});

test("Retry-After is respected for a retryable error", async () => {
  const delays = [];
  let requests = 0;
  const check = createSessionCheck(
    function () {
      requests += 1;
      if (requests === 1) {
        return Promise.reject({
          status: 503,
          message: "warming up",
          retryAfter: "2",
        });
      }
      return Promise.resolve({ id: "u1" });
    },
    {
      sleep: function (ms) {
        delays.push(ms);
        return Promise.resolve();
      },
      random: function () {
        return 0;
      },
    }
  );

  const user = await check.check();
  assert.equal(user.id, "u1");
  assert.equal(requests, 2);
  assert.deepEqual(delays, [2000]);
});

test("non-retryable client errors fail immediately", async () => {
  let requests = 0;
  const check = createSessionCheck(
    function () {
      requests += 1;
      return Promise.reject({ status: 400, message: "Bad request" });
    },
    noDelay
  );
  await assert.rejects(() => check.check());
  assert.equal(requests, 1);
});

test("createSessionCheck validates its input", () => {
  assert.throws(() => createSessionCheck(null), TypeError);
});
