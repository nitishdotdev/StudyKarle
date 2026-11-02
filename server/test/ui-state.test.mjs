import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyLoadState,
  shouldShowSkeleton,
  describeRequestError,
  LOAD_STATES,
} from "../../client/src/utils/uiState.js";

test("classifyLoadState is loading until the first request finishes", () => {
  assert.equal(
    classifyLoadState({ loading: true, error: null, hasData: false, isEmpty: true }),
    LOAD_STATES.LOADING
  );
});

test("classifyLoadState never reports empty while loading", () => {
  assert.notEqual(
    classifyLoadState({ loading: true, error: null, hasData: false, isEmpty: true }),
    LOAD_STATES.EMPTY
  );
});

test("classifyLoadState never reports empty when the request failed", () => {
  assert.equal(
    classifyLoadState({
      loading: false,
      error: "Couldn't load notes",
      hasData: false,
      isEmpty: true,
    }),
    LOAD_STATES.ERROR
  );
});

test("classifyLoadState reports empty only after a successful zero-result response", () => {
  assert.equal(
    classifyLoadState({ loading: false, error: null, hasData: true, isEmpty: true }),
    LOAD_STATES.EMPTY
  );
});

test("classifyLoadState reports ready when content exists", () => {
  assert.equal(
    classifyLoadState({ loading: false, error: null, hasData: true, isEmpty: false }),
    LOAD_STATES.READY
  );
});

test("classifyLoadState keeps ready content during a refresh", () => {
  assert.equal(
    classifyLoadState({
      loading: true,
      error: null,
      hasData: true,
      isEmpty: false,
      refreshing: true,
    }),
    LOAD_STATES.READY
  );
});

test("classifyLoadState keeps ready content when a refresh fails", () => {
  assert.equal(
    classifyLoadState({
      loading: false,
      error: "Couldn't load notes",
      hasData: true,
      isEmpty: false,
    }),
    LOAD_STATES.READY
  );
});

test("shouldShowSkeleton skips brief flashes on fast first loads", () => {
  assert.equal(
    shouldShowSkeleton({ loading: true, hasData: false, elapsedMs: 80, minDelayMs: 200 }),
    false
  );
  assert.equal(
    shouldShowSkeleton({ loading: true, hasData: false, elapsedMs: 250, minDelayMs: 200 }),
    true
  );
});

test("shouldShowSkeleton does not replace already loaded content", () => {
  assert.equal(
    shouldShowSkeleton({ loading: true, hasData: true, elapsedMs: 800, minDelayMs: 200 }),
    false
  );
});

test("describeRequestError distinguishes offline from a failed online request", () => {
  const offline = describeRequestError({ status: 0 }, { online: false });
  assert.equal(offline.kind, "offline");
  assert.match(offline.title, /offline/i);
  assert.equal(offline.canRetry, true);

  const failed = describeRequestError({ status: 0, message: "Network Error" }, { online: true });
  assert.equal(failed.kind, "unavailable");
  assert.notEqual(failed.kind, "offline");
  assert.equal(failed.canRetry, true);
});

test("describeRequestError does not treat 403 as a signed-out session", () => {
  const denied = describeRequestError({ status: 403, message: "Forbidden" }, { online: true });
  assert.equal(denied.kind, "forbidden");
  assert.notEqual(denied.kind, "unauthenticated");
  assert.equal(denied.canRetry, false);
  assert.equal(denied.actionTo, "/dashboard");
});

test("describeRequestError treats 402 as payment access, not a retryable load failure", () => {
  const required = describeRequestError(
    { status: 402, details: { code: "PAYMENT_REQUIRED" } },
    { online: true }
  );
  assert.equal(required.kind, "payment");
  assert.equal(required.canRetry, false);
  assert.equal(required.actionTo, "/access?reason=PAYMENT_REQUIRED");

  const pending = describeRequestError(
    { status: 402, details: { code: "PAYMENT_PENDING" } },
    { online: true }
  );
  assert.equal(pending.actionTo, "/access?reason=PAYMENT_PENDING");
});

test("describeRequestError treats 401 as expired authentication", () => {
  const expired = describeRequestError({ status: 401 }, { online: true });
  assert.equal(expired.kind, "unauthenticated");
});

test("describeRequestError never exposes stack traces or tokens", () => {
  const described = describeRequestError(
    {
      status: 500,
      message: "Internal",
      stack: "Error: boom\n    at foo.js:1:1",
      token: "secret-token",
    },
    { online: true }
  );
  assert.equal(described.kind, "unavailable");
  assert.equal(described.message.includes("foo.js"), false);
  assert.equal(described.message.includes("secret-token"), false);
});
