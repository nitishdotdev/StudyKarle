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

// Bound how far we follow `error.cause` so a pathological chain cannot turn a
// diagnostic into an unbounded walk (or an accidental cycle).
const MAX_CAUSE_DEPTH = 5;

// Flatten an error and its `cause` chain, newest first. Deeper `cause` links
// are common in this codebase: driveService.walkTree wraps the original Drive
// error to add folder-path context, and google-auth-library / gaxios wrap the
// token-endpoint failure again. The provider response can therefore live on a
// nested error, not necessarily the one handed to the diagnostic.
//
// Traversal is depth-limited and cycle-safe via the `seen` set so a
// self-referential or mutually-referential `cause` can never loop forever.
function collectCauseChain(error) {
  const chain = [];
  const seen = new Set();
  let current = error;
  let depth = 0;
  while (
    current &&
    (typeof current === "object" || typeof current === "function") &&
    depth < MAX_CAUSE_DEPTH
  ) {
    if (seen.has(current)) {
      break;
    }
    seen.add(current);
    chain.push(current);
    current = current.cause;
    depth++;
  }
  return chain;
}

function statusOf(errorOrChain) {
  const chain = Array.isArray(errorOrChain)
    ? errorOrChain
    : collectCauseChain(errorOrChain);
  for (let i = 0; i < chain.length; i++) {
    const error = chain[i];
    const response = error && error.response;
    const status =
      (response && response.status) ||
      (error && typeof error.status === "number" && error.status) ||
      (response && Number(response.code)) ||
      0;
    const normalized = Number(status) || 0;
    if (normalized) {
      return normalized;
    }
  }
  return 0;
}

/**
 * @param {Error} error the error thrown by googleapis / google-auth-library
 * @param {string[]} [secrets] credential values that must never be shown
 * @returns {{ status:number, code:string|null, description:string|null }}
 */
function describeGoogleOAuthError(error, secrets) {
  const chain = collectCauseChain(error);

  // Prefer the first error in the chain that actually carries a provider
  // response body; the outermost wrapper usually only has a generic message.
  let body = null;
  for (let i = 0; i < chain.length; i++) {
    body = extractProviderBody(chain[i]);
    if (body) {
      break;
    }
  }

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
  if (!code) {
    for (let i = 0; i < chain.length; i++) {
      const message = chain[i] && chain[i].message;
      if (looksLikeOAuthCode(message)) {
        code = redact(message, secrets);
        break;
      }
    }
  }

  return {
    status: statusOf(chain),
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
