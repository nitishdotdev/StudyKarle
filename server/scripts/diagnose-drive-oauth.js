#!/usr/bin/env node
/**
 * Safe Google Drive OAuth diagnostic.
 *
 * Prints ONLY non-secret metadata about the credentials the Drive-sync code
 * actually selects (see src/config/env.js and src/services/driveService.js),
 * and optionally performs a single token refresh to see exactly what Google
 * says. It NEVER prints a client secret, refresh token, access token, client
 * id, folder id, redirect URI, fingerprint, prefix, or suffix.
 *
 * Usage:
 *   node scripts/diagnose-drive-oauth.js            # metadata only, no network
 *   node scripts/diagnose-drive-oauth.js --refresh  # one-shot refresh attempt
 *
 * Exit codes: 0 ok, 1 refresh failed (provider error), 2 missing config.
 */

const env = require("../src/config/env");
const {
  formatGoogleOAuthError,
} = require("../src/utils/googleOAuthError");

const DO_REFRESH = process.argv.indexOf("--refresh") !== -1;

function meta(label, value) {
  const raw = value == null ? "" : String(value);
  const present = raw.length > 0;
  const leadingWs = /^\s/.test(raw);
  const trailingWs = /\s$/.test(raw);
  const internalWs = /\s/.test(raw.trim());

  console.log(
    "  " +
      label.padEnd(26) +
      " present=" +
      (present ? "yes" : "NO ") +
      " leadingWs=" +
      (leadingWs ? "YES" : "no") +
      " trailingWs=" +
      (trailingWs ? "YES" : "no") +
      " internalWs=" +
      (internalWs ? "YES" : "no")
  );

  return { present };
}

function section(title) {
  console.log("\n" + title);
}

console.log("StudyKarle Google Drive OAuth diagnostic");
console.log("(credential values are never printed)");

section("Drive-sync credentials (env.google.*, used by driveService.getAuth)");
const driveId = meta("GOOGLE_CLIENT_ID", env.google.clientId);
const driveSecret = meta("GOOGLE_CLIENT_SECRET", env.google.clientSecret);
const driveRefresh = meta("GOOGLE_REFRESH_TOKEN", env.google.refreshToken);
meta("GOOGLE_REDIRECT_URI", env.google.redirectUri);
meta("GOOGLE_DRIVE_FOLDER_ID", env.google.driveFolderId);

section("Google Sign-In credentials (separate flow)");
meta("GOOGLE_OAUTH_CLIENT_ID", env.google.oauthClientId);
meta("GOOGLE_OAUTH_CLIENT_SECRET", env.google.oauthClientSecret);
meta("GOOGLE_OAUTH_REDIRECT_URI", env.google.authRedirectUri);

section("Cross-checks");
const rawClientIdSet = !!process.env.GOOGLE_CLIENT_ID;
const rawOauthIdSet = !!process.env.GOOGLE_OAUTH_CLIENT_ID;
console.log(
  "  GOOGLE_OAUTH_CLIENT_ID explicitly set: " + (rawOauthIdSet ? "yes" : "no")
);
console.log(
  "  sign-in falls back to GOOGLE_CLIENT_ID: " +
    (!rawOauthIdSet && rawClientIdSet ? "YES (shared client)" : "no")
);
console.log(
  "  Sign-In token flow uses access_type=online (no refresh token issued)"
);

const missing = [];
if (!driveId.present) missing.push("GOOGLE_CLIENT_ID");
if (!driveSecret.present) missing.push("GOOGLE_CLIENT_SECRET");
if (!driveRefresh.present) missing.push("GOOGLE_REFRESH_TOKEN");
if (!env.google.driveFolderId) missing.push("GOOGLE_DRIVE_FOLDER_ID");

if (missing.length) {
  console.log(
    "\nResult: Drive sync is NOT fully configured. Missing: " + missing.join(", ")
  );
  if (DO_REFRESH) {
    console.log("Skipping refresh: credentials incomplete.");
  }
  process.exit(2);
}

console.log("\nResult: Drive sync credentials are present.");

if (!DO_REFRESH) {
  console.log(
    "\nMetadata only (no network). Re-run with --refresh for a one-shot token test."
  );
  process.exit(0);
}

// -------------------------------------------------------------------------
// One-shot refresh. Never prints tokens; only the sanitized provider result.
// -------------------------------------------------------------------------
const { google } = require("googleapis");

(async function () {
  const client = new google.auth.OAuth2(
    env.google.clientId,
    env.google.clientSecret,
    env.google.redirectUri
  );
  client.setCredentials({ refresh_token: env.google.refreshToken });

  try {
    const res = await client.getAccessToken();
    const gotToken = !!(res && (res.token || (res.res && res.res.data && res.res.data.access_token)));
    console.log("\nRefresh attempt: SUCCESS");
    console.log(
      "  Access token acquired: " + (gotToken ? "yes" : "no") + " (value not printed)"
    );
    console.log(
      "  => The client_id/client_secret pair and the refresh token are valid and linked."
    );
    process.exit(0);
  } catch (err) {
    console.log("\nRefresh attempt: FAILED");
    console.log(
      "  provider: " +
        formatGoogleOAuthError(err, [
          env.google.clientSecret,
          env.google.refreshToken,
        ])
    );
    console.log("\nHow to read the provider error:");
    console.log(
      "  invalid_client  -> the client_id/client_secret pair is wrong, or the OAuth client"
    );
    console.log(
      "                     was deleted/disabled, or is the wrong client type."
    );
    console.log(
      "  invalid_grant   -> the refresh token was not issued to THIS client id, or it was"
    );
    console.log(
      "                     revoked/expired. Mint a new one with access_type=offline."
    );
    console.log(
      "  other           -> read the description above verbatim; do not guess."
    );
    process.exit(1);
  }
})();
