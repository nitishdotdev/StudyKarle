/**
 * Sanitized extraction of a Google OAuth token-endpoint error.
 *
 * Google returns failures from https://oauth2.googleapis.com/token as JSON:
 *
 *   { "error": "invalid_client",
 *     "error_description": "The OAuth client was not found.", ... }
 *
 * The google-auth-library / gaxios wrapper only surfaces
 * `Request failed with status code 401` as the Error message, so the useful
 * provider fields live on `error.response.data`. This module pulls those out so
 * a diagnostic can report what Google actually said WITHOUT ever emitting
 * client ids, client secrets, refresh tokens, or access tokens.
 *
 * `redactSecrets` is applied defensively: if a credential ever appears inside
 * the provider text it is replaced with [REDACTED] before anything is logged.
 */

const REDACTED = "[REDACTED]";

// Token-endpoint error codes Google is known to return. Only a string this
// shape is ever treated as the provider `error` code.
const KNOWN_CODES = [
  "invalid_client",
  "deleted_client",
  "invalid_grant",
  "unauthorized_client",
  "invalid_request",
  "unsupported_grant_type",
  "invalid_scope",
  "access_denied",
  "invalid_redirect_uri",
];

function asString(value) {
  return value == null ? "" : String(value);
}

function looksLikeOAuthCode(value) {
  const s = asString(value).trim();
  return KNOWN_CODES.indexOf(s) !== -1 || /^[a-z][a-z0-9_]{2,40}$/.test(s);
}

function redact(text, secrets) {
  let out = asString(text);
  if (!Array.isArray(secrets)) {
    secrets = [];
  }
  for (let i = 0; i < secrets.length; i++) {
    const secret = asString(secrets[i]);
    if (secret.length >= 6) {
      out = out.split(secret).join(REDACTED);
    }
  }
  // Never let a provider description span multiple log lines or balloon.
  out = out.replace(/[\r\n\t]+/g, " ").slice(0, 300).trim();
  return out;
}

function extractProviderBody(error) {
  const response = error && error.response;
  if (!response) {
    return null;
  }
  const data = response.data;
  if (data && typeof data === "object") {
    return data;
  }
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (err) {
      return null;
    }
  }
  return null;
}

function statusOf(error) {
  const response = error && error.response;
  const status =
    (response && response.status) ||
    (error && typeof error.status === "number" && error.status) ||
    (response && Number(response.code)) ||
    0;
  return Number(status) || 0;
}

/**
 * @param {Error} error the error thrown by googleapis / google-auth-library
 * @param {string[]} [secrets] credential values that must never be shown
 * @returns {{ status:number, code:string|null, description:string|null }}
 */
function describeGoogleOAuthError(error, secrets) {
  const body = extractProviderBody(error);

  let code = null;
  let description = null;

  if (body) {
    const rawCode = body.error || body.error_code;
    if (rawCode) {
      code = redact(rawCode, secrets);
    }
    const rawDescription =
      body.error_description || body.error_message || body.message;
    if (rawDescription) {
      description = redact(rawDescription, secrets);
    }
  }

  // Fallback: some paths set the provider code directly as the message.
  if (!code && error && looksLikeOAuthCode(error.message)) {
    code = redact(error.message, secrets);
  }

  return {
    status: statusOf(error),
    code: code || null,
    description: description || null,
  };
}

/**
 * Human-readable one-line summary safe to log. Never includes credentials.
 */
function formatGoogleOAuthError(error, secrets) {
  const diag = describeGoogleOAuthError(error, secrets);
  const parts = ["status=" + (diag.status || "n/a")];
  parts.push("error=" + (diag.code || "n/a"));
  if (diag.description) {
    parts.push("description=" + diag.description);
  }
  return parts.join(" ");
}

module.exports = {
  REDACTED,
  KNOWN_CODES,
  redact: redact,
  describeGoogleOAuthError: describeGoogleOAuthError,
  formatGoogleOAuthError: formatGoogleOAuthError,
};
