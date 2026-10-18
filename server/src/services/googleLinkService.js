/**
 * Google account linking.
 *
 * Flow (see also googleAuthService.findOrCreateFromGoogle):
 *
 *   1. Google returns a verified identity (sub + verified email).
 *   2. If the email already belongs to a StudyKarle account that is NOT linked
 *      to this Google subject, the callback creates a short-lived challenge
 *      bound to that account (the account is chosen by the server, never by the
 *      client) and redirects to the linking screen.
 *   3. The user proves ownership:
 *        - existing password accounts -> submit the StudyKarle password, or
 *        - password-less accounts    -> receive + submit an email OTP.
 *   4. On success the Google subject is attached atomically, the challenge is
 *      consumed, and a normal session is issued.
 *
 * Security properties:
 *   - Only a hash of the opaque ticket is stored.
 *   - The challenge is bound to a specific user + Google subject on the server.
 *   - Single use is enforced with a conditional update inside a transaction.
 *   - A Google identity can never be linked to two accounts (unique constraint
 *     + conditional update).
 *   - Passwords, OTPs, tickets and tokens are never logged.
 */

const bcrypt = require("bcryptjs");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const userModel = require("../models/userModel");
const googleLinkChallengeModel = require("../models/googleLinkChallengeModel");
const { sendEmail } = require("./emailService");
const { safeRedirectPath } = require("./googleAuthService");
const {
  hmacSha256,
  randomToken,
  generateNumericOtp,
  timingSafeEqualHex,
} = require("../utils/cryptoHash");

const TICKET_TTL_MS = 5 * 60 * 1000;
const OTP_TTL_MS = (env.otp.expiryMinutes || 10) * 60 * 1000;
const MAX_PASSWORD_ATTEMPTS = 5;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_RESENDS = env.otp.maxResendAttempts || 3;

const INVALID_CHALLENGE_MESSAGE =
  "This Google linking request is invalid or has expired. Please try signing in with Google again.";

function hashTicket(ticket) {
  return hmacSha256("google-link:" + ticket);
}

function hashOtp(otp) {
  return hmacSha256("google-link-otp:" + otp);
}

function linkFailureMessage(reason) {
  if (reason === "sub_taken") {
    return "This Google account is already linked to a different StudyKarle account. Please sign in with that Google account instead.";
  }
  if (reason === "already_linked") {
    return "This StudyKarle account is already linked to a Google account. Please sign in with your password, or use the linked Google account.";
  }
  if (reason === "consumed") {
    return "This Google linking request was already used. Please start again.";
  }
  return "We could not connect your Google account. Please try again.";
}

async function loadValidChallenge(ticket) {
  if (!ticket || typeof ticket !== "string") {
    throw ApiError.unauthorized(INVALID_CHALLENGE_MESSAGE);
  }
  const record = await googleLinkChallengeModel.findValidByHash(
    hashTicket(ticket)
  );
  if (!record) {
    throw ApiError.unauthorized(INVALID_CHALLENGE_MESSAGE);
  }
  return record;
}

async function loadBoundUserOrConsume(record) {
  const user = await userModel.findById(record.user_id);
  if (!user) {
    await googleLinkChallengeModel.consume(record.id);
    throw ApiError.unauthorized(INVALID_CHALLENGE_MESSAGE);
  }
  return user;
}

// Issue the challenge after the callback has resolved that linking is needed.
async function createChallenge(user, identity, redirectPath) {
  // A Google identity may only ever be attached to one account.
  const owner = await userModel.findByGoogleSub(identity.sub);
  if (owner && owner.id !== user.id) {
    throw ApiError.conflict(
      "This Google account is already linked to a different StudyKarle account. Please sign in with that Google account instead."
    );
  }
  // Never overwrite a different Google identity already on this account.
  if (user.google_sub && user.google_sub !== identity.sub) {
    throw ApiError.conflict(
      "This StudyKarle account is already linked to a different Google account. Please sign in with your password instead."
    );
  }

  await googleLinkChallengeModel.consumeAllForUser(user.id);

  const ticket = randomToken(32);
  await googleLinkChallengeModel.create({
    userId: user.id,
    googleSub: identity.sub,
    googleEmail: identity.email,
    googleName: identity.name || null,
    googlePicture: identity.picture || null,
    redirectPath: safeRedirectPath(redirectPath),
    ticketHash: hashTicket(ticket),
    expiresAt: new Date(Date.now() + TICKET_TTL_MS),
  });

  return { ticket: ticket };
}

// Server-validated challenge context for the linking screen. The email comes
// from the server-side challenge, never from a URL or the client.
async function getChallengeInfo(ticket) {
  const record = await loadValidChallenge(ticket);
  const user = await loadBoundUserOrConsume(record);
  return {
    email: record.google_email,
    name: record.google_name || null,
    hasPassword: !!user.password_hash,
    expiresAt: record.expires_at,
  };
}

async function completePasswordLink(ticket, password) {
  const record = await loadValidChallenge(ticket);
  const user = await loadBoundUserOrConsume(record);

  if (!user.password_hash) {
    throw ApiError.badRequest(
      "This account does not use a password. Use email verification to connect Google instead."
    );
  }
  if (record.attempts >= MAX_PASSWORD_ATTEMPTS) {
    throw ApiError.unauthorized(
      "Too many incorrect password attempts. Please start over."
    );
  }

  const match = await bcrypt.compare(String(password), user.password_hash);
  if (!match) {
    await googleLinkChallengeModel.incrementAttempts(record.id);
    throw ApiError.unauthorized("Incorrect password. Please try again.");
  }

  const result = await googleLinkChallengeModel.consumeAndLinkGoogleSub(record);
  if (!result.ok) {
    throw ApiError.conflict(linkFailureMessage(result.reason));
  }

  const full = await userModel.findById(result.user.id);
  return {
    user: userModel.publicUser(full || result.user),
    redirect: safeRedirectPath(record.redirect_path),
  };
}

async function requestRecoveryOtp(ticket) {
  const record = await loadValidChallenge(ticket);
  const user = await loadBoundUserOrConsume(record);

  if (user.password_hash) {
    throw ApiError.badRequest(
      "This account uses a password. Enter your password to connect Google."
    );
  }
  const resends = record.otp_resend_count || 0;
  if (resends >= MAX_OTP_RESENDS) {
    throw ApiError.forbidden(
      "Maximum verification attempts reached. Please start over."
    );
  }

  const otp = generateNumericOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await googleLinkChallengeModel.setOtp(
    record.id,
    hashOtp(otp),
    expiresAt,
    resends + 1
  );

  await sendEmail({
    to: record.google_email,
    subject: "Your StudyKarle account-link code",
    html:
      "<p>Your StudyKarle account-link code is: <strong>" +
      otp +
      "</strong></p><p>Expires in " +
      (env.otp.expiryMinutes || 10) +
      " minutes. If you did not request this, you can ignore this email.</p>",
    text:
      "Your StudyKarle account-link code is: " +
      otp +
      ". Expires in " +
      (env.otp.expiryMinutes || 10) +
      " minutes.",
  });

  return { email: record.google_email, expiresAt: expiresAt };
}

async function verifyRecoveryOtp(ticket, otp) {
  const record = await loadValidChallenge(ticket);
  const user = await loadBoundUserOrConsume(record);

  if (user.password_hash) {
    throw ApiError.badRequest(
      "This account uses a password. Enter your password to connect Google."
    );
  }
  if (!record.otp_hash || !record.otp_expires_at) {
    throw ApiError.unauthorized(
      "Please request a verification code before continuing."
    );
  }
  if (record.otp_attempts >= MAX_OTP_ATTEMPTS) {
    throw ApiError.unauthorized(
      "Too many incorrect codes. Please request a new one."
    );
  }
  if (Date.now() > new Date(record.otp_expires_at).getTime()) {
    throw ApiError.unauthorized(
      "Verification code has expired. Please request a new one."
    );
  }
  if (!timingSafeEqualHex(record.otp_hash, hashOtp(otp))) {
    await googleLinkChallengeModel.incrementOtpAttempts(record.id);
    throw ApiError.unauthorized("Invalid verification code");
  }

  const result = await googleLinkChallengeModel.consumeAndLinkGoogleSub(record);
  if (!result.ok) {
    throw ApiError.conflict(linkFailureMessage(result.reason));
  }

  const full = await userModel.findById(result.user.id);
  return {
    user: userModel.publicUser(full || result.user),
    redirect: safeRedirectPath(record.redirect_path),
  };
}

module.exports = {
  INVALID_CHALLENGE_MESSAGE: INVALID_CHALLENGE_MESSAGE,
  TICKET_TTL_MS: TICKET_TTL_MS,
  MAX_PASSWORD_ATTEMPTS: MAX_PASSWORD_ATTEMPTS,
  MAX_OTP_ATTEMPTS: MAX_OTP_ATTEMPTS,
  MAX_OTP_RESENDS: MAX_OTP_RESENDS,
  createChallenge: createChallenge,
  getChallengeInfo: getChallengeInfo,
  completePasswordLink: completePasswordLink,
  requestRecoveryOtp: requestRecoveryOtp,
  verifyRecoveryOtp: verifyRecoveryOtp,
};
