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

  return {
    sub: payload.sub,
    email: email,
    name: payload.name || email.split("@")[0],
    picture: payload.picture || null,
    emailVerified: true,
  };
}

async function findOrCreateFromGoogle(identity) {
  disposableEmailService.assertNotDisposable(identity.email);

  const bySub = await userModel.findByGoogleSub(identity.sub);
  if (bySub) {
    disposableEmailService.assertNotDisposable(bySub.email);
    return userModel.publicUser(bySub) || {
      id: bySub.id,
      name: bySub.name,
      email: bySub.email,
      role: bySub.role,
      avatar_url: bySub.avatar_url,
      course: bySub.course,
      current_year: bySub.current_year,
      created_at: bySub.created_at,
      has_password: !!bySub.password_hash,
      google_linked: true,
    };
  }

  const existing = await userModel.findByEmail(identity.email);
  if (existing) {
    throw ApiError.conflict(
      "An account with this email already exists. Sign in with your password, then link Google from your account."
    );
  }

  const created = await userModel.create({
    name: identity.name,
    email: identity.email,
    passwordHash: null,
    role: "student",
    googleSub: identity.sub,
    avatarUrl: identity.picture,
  });

  return {
    id: created.id,
    name: created.name,
    email: created.email,
    role: created.role,
    avatar_url: created.avatar_url,
    course: created.course,
    current_year: created.current_year,
    created_at: created.created_at,
    has_password: false,
    google_linked: true,
  };
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
