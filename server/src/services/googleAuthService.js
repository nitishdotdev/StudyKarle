const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const userModel = require("../models/userModel");
const disposableEmailService = require("./disposableEmailService");
const { normalizeEmail } = require("../utils/email");
const { hmacSha256 } = require("../utils/cryptoHash");

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const STATE_TTL_MS = 10 * 60 * 1000;

function oauthConfigured() {
  return !!(env.google.oauthClientId && env.google.oauthClientSecret);
}

function getClient() {
  return new OAuth2Client(
    env.google.oauthClientId,
    env.google.oauthClientSecret,
    env.google.authRedirectUri
  );
}

function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmacSha256(body);
  return body + "." + sig;
}

function verifyState(state) {
  if (!state || typeof state !== "string" || state.indexOf(".") === -1) {
    throw ApiError.unauthorized("Invalid Google sign-in request");
  }
  const dot = state.lastIndexOf(".");
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = hmacSha256(body);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw ApiError.unauthorized("Invalid Google sign-in request");
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch (err) {
    throw ApiError.unauthorized("Invalid Google sign-in request");
  }
  if (!payload || !payload.n || !payload.ts) {
    throw ApiError.unauthorized("Invalid Google sign-in request");
  }
  if (Date.now() - Number(payload.ts) > STATE_TTL_MS) {
    throw ApiError.unauthorized("Google sign-in expired. Please try again.");
  }
  return payload;
}

function codeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function safeRedirectPath(value) {
  if (!value || typeof value !== "string") {
    return "/dashboard";
  }
  if (value.charAt(0) !== "/" || value.indexOf("//") === 0 || value.indexOf("://") !== -1) {
    return "/dashboard";
  }
  return value;
}

function buildAuthorizationUrl(nonce, codeVerifier, redirectTo) {
  if (!oauthConfigured()) {
    throw ApiError.badRequest(
      "Google sign-in is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI."
    );
  }
  const client = getClient();
  const state = signState({
    n: nonce,
    cv: codeVerifier,
    ts: Date.now(),
    r: safeRedirectPath(redirectTo),
  });
  return client.generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state: state,
    nonce: nonce,
    code_challenge: codeChallenge(codeVerifier),
    code_challenge_method: "S256",
    include_granted_scopes: true,
  });
}

async function exchangeCode(code, codeVerifier) {
  if (!oauthConfigured()) {
    throw ApiError.badRequest("Google sign-in is not configured");
  }
  const client = getClient();
  try {
    const result = await client.getToken({
      code: code,
      codeVerifier: codeVerifier,
    });
    return result.tokens;
  } catch (err) {
    throw ApiError.unauthorized("Google sign-in failed. Please try again.");
  }
}

async function verifyIdToken(idToken, expectedNonce) {
  if (!oauthConfigured()) {
    throw ApiError.badRequest("Google sign-in is not configured");
  }
  const client = getClient();
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: env.google.oauthClientId,
    });
  } catch (err) {
    throw ApiError.unauthorized("Google sign-in failed. Please try again.");
  }

  const payload = ticket.getPayload();
  if (!payload) {
    throw ApiError.unauthorized("Google sign-in failed. Please try again.");
  }
  if (GOOGLE_ISSUERS.indexOf(payload.iss) === -1) {
    throw ApiError.unauthorized("Google sign-in failed. Please try again.");
  }
  if (payload.aud !== env.google.oauthClientId) {
    throw ApiError.unauthorized("Google sign-in failed. Please try again.");
  }
  if (!payload.sub) {
    throw ApiError.unauthorized("Google sign-in failed. Please try again.");
  }
  if (payload.email_verified !== true) {
    throw ApiError.unauthorized(
      "Your Google email is not verified. Please verify it with Google, then try again."
    );
  }
  if (expectedNonce && payload.nonce && payload.nonce !== expectedNonce) {
    throw ApiError.unauthorized("Google sign-in failed. Please try again.");
  }
  if (expectedNonce && !payload.nonce) {
    throw ApiError.unauthorized("Google sign-in failed. Please try again.");
  }

  const email = normalizeEmail(payload.email);
  if (!email) {
    throw ApiError.unauthorized("Google did not provide a verified email.");
  }

  const name = payload.name ? String(payload.name).trim() : "";
  return {
    sub: payload.sub,
    email: email,
    name: name || email.split("@")[0],
    picture: payload.picture || null,
    emailVerified: true,
  };
}

// The message shown when a Google identity is already attached to a different
// StudyKarle account (or vice versa). It gives recovery guidance rather than
// silently replacing a link.
const DIFFERENT_IDENTITY_MESSAGE =
  "This account is already linked to a different Google account. Please sign in with the Google account you originally used, or reset your password to sign in with email.";

function usableName(identity) {
  const raw = identity && identity.name ? String(identity.name).trim() : "";
  const local = identity && identity.email
    ? String(identity.email).split("@")[0]
    : "";
  return raw || local;
}

// Present a consistent, public-safe account shape to the callback regardless
// of whether the row came from a fresh create or an existing lookup.
function decisionUser(row) {
  if (!row) return row;
  return Object.assign({}, row, {
    has_password: !!row.password_hash,
    google_linked: !!row.google_sub,
  });
}

async function createGoogleUser(identity) {
  const name = usableName(identity);
  if (!name || name.length < 2) {
    throw ApiError.badRequest(
      "We could not read a valid name from your Google profile. Please sign up with your email address."
    );
  }
  return userModel.create({
    name: name,
    email: identity.email,
    passwordHash: null,
    role: "student",
    googleSub: identity.sub,
    avatarUrl: identity.picture,
  });
}

// Classify an existing email/password-less account without ever auto-linking.
function classifyExisting(existing, identity) {
  if (existing.google_sub && existing.google_sub !== identity.sub) {
    throw ApiError.conflict(DIFFERENT_IDENTITY_MESSAGE);
  }
  if (existing.google_sub === identity.sub) {
    return { status: "authenticated", user: decisionUser(existing) };
  }
  if (existing.password_hash) {
    return { status: "link_required", user: decisionUser(existing) };
  }
  return { status: "recovery_required", user: decisionUser(existing) };
}

// Resolve an unexpected unique-violation (email or Google subject) into a
// concrete account state instead of surfacing a raw database error.
async function resolveGoogleRace(identity) {
  const bySub = await userModel.findByGoogleSub(identity.sub);
  if (bySub) {
    disposableEmailService.assertNotDisposable(bySub.email);
    return { status: "authenticated", user: decisionUser(bySub) };
  }
  const existing = await userModel.findByEmail(identity.email);
  if (existing) {
    disposableEmailService.assertNotDisposable(existing.email);
    return classifyExisting(existing, identity);
  }
  throw ApiError.conflict(
    "We could not complete Google sign-in. Please try again."
  );
}

/**
 * Resolve a verified Google identity into a StudyKarle account decision.
 *
 * @returns {Promise<{status:"authenticated"|"link_required"|"recovery_required", user:object}>}
 *   - authenticated: existing linked account, or a brand-new account.
 *   - link_required: an existing password account must confirm its password
 *     before the Google subject is attached.
 *   - recovery_required: an existing password-less account must verify via
 *     email before the Google subject is attached.
 * Never creates a duplicate and never auto-links by email alone.
 */
async function findOrCreateFromGoogle(identity) {
  disposableEmailService.assertNotDisposable(identity.email);

  const bySub = await userModel.findByGoogleSub(identity.sub);
  if (bySub) {
    disposableEmailService.assertNotDisposable(bySub.email);
    return { status: "authenticated", user: decisionUser(bySub) };
  }

  const existing = await userModel.findByEmail(identity.email);
  if (existing) {
    disposableEmailService.assertNotDisposable(existing.email);
    return classifyExisting(existing, identity);
  }

  let created;
  try {
    created = await createGoogleUser(identity);
  } catch (err) {
    if (err && err.code === "23505") {
      return resolveGoogleRace(identity);
    }
    throw err;
  }

  return { status: "authenticated", user: decisionUser(created) };
}

module.exports = {
  oauthConfigured: oauthConfigured,
  buildAuthorizationUrl: buildAuthorizationUrl,
  verifyState: verifyState,
  verifyIdToken: verifyIdToken,
  findOrCreateFromGoogle: findOrCreateFromGoogle,
  exchangeCode: exchangeCode,
  safeRedirectPath: safeRedirectPath,
  signState: signState,
};
