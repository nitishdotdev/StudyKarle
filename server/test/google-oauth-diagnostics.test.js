// Tests for the Drive-sync OAuth credential selection and the sanitized
// Google error diagnostic. No network and no real credentials are used.
//
//   node --test test/google-oauth-diagnostics.test.js

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.GOOGLE_CLIENT_ID = "drive-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "drive-client-secret-DO-NOT-LOG";
process.env.GOOGLE_REFRESH_TOKEN = "drive-refresh-token-DO-NOT-LOG";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:5000/oauth2callback";
process.env.GOOGLE_DRIVE_FOLDER_ID = "drive-folder-abc";
process.env.GOOGLE_OAUTH_CLIENT_ID = "signin-client.apps.googleusercontent.com";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "signin-client-secret-DO-NOT-LOG";
process.env.GOOGLE_OAUTH_REDIRECT_URI =
  "http://localhost:5000/api/auth/google/callback";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { execFileSync } = require("child_process");

const {
  describeGoogleOAuthError,
  formatGoogleOAuthError,
  redact,
} = require("../src/utils/googleOAuthError");
const env = require("../src/config/env");

const DRIVE_SECRETS = [env.google.clientSecret, env.google.refreshToken];

function gaxiosError(status, data, message) {
  const err = new Error(message || "Request failed with status code " + status);
  err.response = { status, data };
  err.code = String(status);
  return err;
}

test("Drive sync uses the GOOGLE_* credentials, not the Google Sign-In ones", () => {
  assert.equal(env.google.clientId, "drive-client.apps.googleusercontent.com");
  assert.equal(env.google.clientSecret, "drive-client-secret-DO-NOT-LOG");
  assert.equal(env.google.refreshToken, "drive-refresh-token-DO-NOT-LOG");
  assert.equal(env.google.redirectUri, "http://localhost:5000/oauth2callback");
  assert.equal(env.google.driveFolderId, "drive-folder-abc");
});

test("Google Sign-In uses the separate GOOGLE_OAUTH_* credentials when set", () => {
  assert.equal(
    env.google.oauthClientId,
    "signin-client.apps.googleusercontent.com"
  );
  assert.equal(env.google.oauthClientSecret, "signin-client-secret-DO-NOT-LOG");
  assert.equal(
    env.google.authRedirectUri,
    "http://localhost:5000/api/auth/google/callback"
  );
});

function loadEnv(extra) {
  const script =
    "const env=require(process.argv[1]);" +
    "process.stdout.write(JSON.stringify({" +
    "authRedirectUri:env.google.authRedirectUri," +
    "oauthSignInConfigured:env.google.oauthSignInConfigured" +
    "}))";
  const envPath = path.join(__dirname, "..", "src", "config", "env.js");
  const out = execFileSync(process.execPath, ["-e", script, envPath], {
    env: Object.assign(
      {
        PATH: process.env.PATH,
        JWT_SECRET: "x",
      },
      extra || {}
    ),
    encoding: "utf8",
  });
  return JSON.parse(out);
}

test("production Google Sign-In is not configured without an explicit HTTPS redirect URI", () => {
  const missing = loadEnv({
    NODE_ENV: "production",
    GOOGLE_OAUTH_CLIENT_ID: "prod-client.apps.googleusercontent.com",
    GOOGLE_OAUTH_CLIENT_SECRET: "prod-secret",
  });
  assert.equal(missing.authRedirectUri, "");
  assert.equal(missing.oauthSignInConfigured, false);

  const localhost = loadEnv({
    NODE_ENV: "production",
    GOOGLE_OAUTH_CLIENT_ID: "prod-client.apps.googleusercontent.com",
    GOOGLE_OAUTH_CLIENT_SECRET: "prod-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:5000/api/auth/google/callback",
  });
  assert.equal(localhost.oauthSignInConfigured, false);
});

test("production Google Sign-In is configured when the HTTPS callback URI is set", () => {
  const configured = loadEnv({
    NODE_ENV: "production",
    GOOGLE_OAUTH_CLIENT_ID: "prod-client.apps.googleusercontent.com",
    GOOGLE_OAUTH_CLIENT_SECRET: "prod-secret",
    GOOGLE_OAUTH_REDIRECT_URI:
      "https://studykarle-backend.onrender.com/api/auth/google/callback",
  });
  assert.equal(
    configured.authRedirectUri,
    "https://studykarle-backend.onrender.com/api/auth/google/callback"
  );
  assert.equal(configured.oauthSignInConfigured, true);
});

test("development Google Sign-In still defaults the redirect URI to localhost", () => {
  const dev = loadEnv({
    NODE_ENV: "development",
    GOOGLE_OAUTH_CLIENT_ID: "dev-client.apps.googleusercontent.com",
    GOOGLE_OAUTH_CLIENT_SECRET: "dev-secret",
  });
  assert.equal(
    dev.authRedirectUri,
    "http://localhost:5000/api/auth/google/callback"
  );
  assert.equal(dev.oauthSignInConfigured, true);
});

test("Sign-In falls back to GOOGLE_CLIENT_ID only when GOOGLE_OAUTH_CLIENT_ID is unset", () => {
  const script =
    "const env=require(process.argv[1]);" +
    "process.stdout.write(String(env.google.oauthClientId))";
  const envPath = path.join(__dirname, "..", "src", "config", "env.js");

  const out = execFileSync(
    process.execPath,
    ["-e", script, envPath],
    {
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        JWT_SECRET: "x",
        GOOGLE_CLIENT_ID: "only-drive-client.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "s",
        // GOOGLE_OAUTH_CLIENT_ID intentionally unset
      },
      encoding: "utf8",
    }
  );
  assert.equal(out, "only-drive-client.apps.googleusercontent.com");
});

test("extracts status, provider code, and description from a token error", () => {
  const err = gaxiosError(401, {
    error: "invalid_client",
    error_description: "The OAuth client was not found.",
  });
  assert.deepEqual(describeGoogleOAuthError(err, DRIVE_SECRETS), {
    status: 401,
    code: "invalid_client",
    description: "The OAuth client was not found.",
  });
});

test("distinguishes invalid_grant (refresh token) from invalid_client", () => {
  const err = gaxiosError(400, {
    error: "invalid_grant",
    error_description: "Token has been expired or revoked.",
  });
  const diag = describeGoogleOAuthError(err, DRIVE_SECRETS);
  assert.equal(diag.status, 400);
  assert.equal(diag.code, "invalid_grant");
});

test("never leaks a secret even if the provider text embeds one", () => {
  const err = gaxiosError(401, {
    error: "invalid_client",
    error_description:
      "bad client_secret=drive-client-secret-DO-NOT-LOG for token " +
      "drive-refresh-token-DO-NOT-LOG",
  });
  const diag = describeGoogleOAuthError(err, DRIVE_SECRETS);
  assert.ok(diag.description.indexOf("DO-NOT-LOG") === -1);
  assert.ok(diag.description.indexOf("[REDACTED]") !== -1);

  const line = formatGoogleOAuthError(err, DRIVE_SECRETS);
  assert.ok(line.indexOf("drive-client-secret-DO-NOT-LOG") === -1);
  assert.ok(line.indexOf("drive-refresh-token-DO-NOT-LOG") === -1);
  assert.ok(line.indexOf("status=401") !== -1);
  assert.ok(line.indexOf("error=invalid_client") !== -1);
});

test("falls back to a provider code carried on the error message", () => {
  const err = new Error("invalid_client");
  err.response = { status: 401, data: "" };
  assert.equal(describeGoogleOAuthError(err, DRIVE_SECRETS).code, "invalid_client");
});

test("does not mistake a gaxios wrapper message for a provider code", () => {
  const err = new Error("Request failed with status code 401");
  err.response = { status: 401, data: {} };
  assert.equal(describeGoogleOAuthError(err, DRIVE_SECRETS).code, null);
});

test("handles a missing response (network error) without throwing", () => {
  const diag = describeGoogleOAuthError(new Error("socket hang up"), DRIVE_SECRETS);
  assert.equal(diag.status, 0);
  assert.equal(diag.code, null);
  assert.equal(diag.description, null);
});

test("extracts a provider response nested under a context-error cause", () => {
  const provider = gaxiosError(401, {
    error: "invalid_client",
    error_description: "The OAuth client was not found.",
  });
  const wrapped = new Error(
    "Failed to list children of : Request failed with status code 401",
    { cause: provider }
  );

  const diag = describeGoogleOAuthError(wrapped, DRIVE_SECRETS);
  assert.equal(diag.status, 401);
  assert.equal(diag.code, "invalid_client");
  assert.equal(diag.description, "The OAuth client was not found.");

  const line = formatGoogleOAuthError(wrapped, DRIVE_SECRETS);
  assert.ok(line.indexOf("status=401") !== -1);
  assert.ok(line.indexOf("error=invalid_client") !== -1);
});

test("redacts secrets embedded in a nested provider description", () => {
  const provider = gaxiosError(401, {
    error: "invalid_client",
    error_description:
      "client_secret=drive-client-secret-DO-NOT-LOG " +
      "token=drive-refresh-token-DO-NOT-LOG",
  });
  const wrapped = new Error("context wrapper", { cause: provider });

  const line = formatGoogleOAuthError(wrapped, DRIVE_SECRETS);
  assert.ok(line.indexOf("DO-NOT-LOG") === -1);
  assert.ok(line.indexOf("drive-client-secret-DO-NOT-LOG") === -1);
  assert.ok(line.indexOf("drive-refresh-token-DO-NOT-LOG") === -1);
  assert.ok(line.indexOf("status=401") !== -1);
  assert.ok(line.indexOf("[REDACTED]") !== -1);
});

test("finds the provider response at any depth of the cause chain", () => {
  const provider = gaxiosError(403, {
    error: "invalid_grant",
    error_description: "Token has been expired or revoked.",
  });
  const middle = new Error("Request failed with status code 403", {
    cause: provider,
  });
  const outer = new Error("drive sync failed", { cause: middle });

  const diag = describeGoogleOAuthError(outer, DRIVE_SECRETS);
  assert.equal(diag.status, 403);
  assert.equal(diag.code, "invalid_grant");
  assert.equal(diag.description, "Token has been expired or revoked.");
});

test("nested cause with no provider response yields the n/a diagnostic", () => {
  const wrapped = new Error("drive sync failed", {
    cause: new Error("socket hang up"),
  });
  const diag = describeGoogleOAuthError(wrapped, DRIVE_SECRETS);
  assert.equal(diag.status, 0);
  assert.equal(diag.code, null);
  assert.equal(diag.description, null);
  assert.equal(formatGoogleOAuthError(wrapped, DRIVE_SECRETS), "status=n/a error=n/a");
});

test("circular cause chains terminate and still surface the provider", () => {
  const provider = gaxiosError(401, {
    error: "invalid_client",
    error_description: "The OAuth client was not found.",
  });
  const start = new Error("start", { cause: provider });
  provider.cause = start; // close the loop back to the head

  const diag = describeGoogleOAuthError(start, DRIVE_SECRETS);
  assert.equal(diag.status, 401);
  assert.equal(diag.code, "invalid_client");
  assert.equal(diag.description, "The OAuth client was not found.");
});

test("circular cause chains with no provider terminate safely", () => {
  const a = new Error("a");
  const b = new Error("b");
  a.cause = b;
  b.cause = a;

  assert.deepEqual(describeGoogleOAuthError(a, DRIVE_SECRETS), {
    status: 0,
    code: null,
    description: null,
  });
});

test("ignores malformed provider response bodies", () => {
  const bodies = ["not-json-{", 42, true, null];
  for (let i = 0; i < bodies.length; i++) {
    const err = gaxiosError(500, bodies[i], "Request failed with status code 500");
    const diag = describeGoogleOAuthError(err, DRIVE_SECRETS);
    assert.equal(diag.status, 500);
    assert.equal(diag.code, null);
    assert.equal(diag.description, null);
  }
});

test("ordinary non-OAuth errors stay n/a without throwing", () => {
  const err = new Error("ECONNREFUSED 127.0.0.1:5432");
  const diag = describeGoogleOAuthError(err, DRIVE_SECRETS);
  assert.equal(diag.status, 0);
  assert.equal(diag.code, null);
  assert.equal(diag.description, null);
  assert.equal(formatGoogleOAuthError(err, DRIVE_SECRETS), "status=n/a error=n/a");
});

test("does not follow the cause chain past the depth limit", () => {
  let current = gaxiosError(401, {
    error: "invalid_client",
    error_description: "The OAuth client was not found.",
  });
  for (let i = 0; i < 10; i++) {
    current = new Error("wrapper " + i, { cause: current });
  }

  const diag = describeGoogleOAuthError(current, DRIVE_SECRETS);
  assert.equal(diag.status, 0);
  assert.equal(diag.code, null);
  assert.equal(diag.description, null);
});

test("redact leaves short/absent secrets alone and caps length", () => {
  assert.equal(redact("normal text", ["short"]), "normal text");
  assert.equal(redact("abc secret-value xyz", ["secret-value"]), "abc [REDACTED] xyz");
  const long = redact("x".repeat(1000), []);
  assert.ok(long.length <= 300);
});
