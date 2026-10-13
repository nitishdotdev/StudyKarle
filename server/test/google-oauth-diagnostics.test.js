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

test("redact leaves short/absent secrets alone and caps length", () => {
  assert.equal(redact("normal text", ["short"]), "normal text");
  assert.equal(redact("abc secret-value xyz", ["secret-value"]), "abc [REDACTED] xyz");
  const long = redact("x".repeat(1000), []);
  assert.ok(long.length <= 300);
});
