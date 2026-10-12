const bcrypt = require("bcryptjs");
const userModel = require("../models/userModel");
const otpService = require("./otpService");
const passwordResetAuthorizationModel = require("../models/passwordResetAuthorizationModel");
const disposableEmailService = require("./disposableEmailService");
const ApiError = require("../utils/ApiError");
const { normalizeEmail } = require("../utils/email");
const { hmacSha256, randomToken } = require("../utils/cryptoHash");

const GENERIC_OTP_SENT =
  "If an eligible account exists for this email, a reset code has been sent.";
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const SALT_ROUNDS = 10;

function hashResetToken(token) {
  return hmacSha256("reset:" + token);
}

module.exports = {
  GENERIC_OTP_SENT: GENERIC_OTP_SENT,

  async requestReset(email) {
    const normalized = normalizeEmail(email);
    if (disposableEmailService.isDisposableEmail(normalized)) {
      return { message: GENERIC_OTP_SENT };
    }
    const user = await userModel.findByEmail(normalized);
    if (!user || !user.password_hash) {
      return { message: GENERIC_OTP_SENT };
    }

    try {
      await otpService.requestPasswordResetOtp(normalized);
    } catch (err) {
      throw err;
    }

    return { message: GENERIC_OTP_SENT, email: normalized };
  },

  async resendReset(email) {
    const normalized = normalizeEmail(email);
    if (disposableEmailService.isDisposableEmail(normalized)) {
      return { message: GENERIC_OTP_SENT };
    }
    const user = await userModel.findByEmail(normalized);
    if (!user || !user.password_hash) {
      return { message: GENERIC_OTP_SENT };
    }

    try {
      await otpService.resendPasswordResetOtp(normalized);
    } catch (err) {
      if (err.statusCode === 404) {
        return { message: GENERIC_OTP_SENT };
      }
      throw err;
    }

    return { message: GENERIC_OTP_SENT, email: normalized };
  },

  async verifyResetOtp(email, otp) {
    const normalized = normalizeEmail(email);
    if (disposableEmailService.isDisposableEmail(normalized)) {
      throw ApiError.unauthorized("Invalid verification code");
    }
    const user = await userModel.findByEmail(normalized);
    if (!user || !user.password_hash) {
      throw ApiError.unauthorized("Invalid verification code");
    }

    await otpService.verifyPasswordResetOtp(normalized, otp);

    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await passwordResetAuthorizationModel.consumeAllForUser(user.id);
    await passwordResetAuthorizationModel.create({
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: expiresAt,
    });

    return {
      resetToken: token,
      expiresAt: expiresAt.toISOString(),
    };
  },

  async resetPassword(resetToken, newPassword) {
    if (!resetToken) {
      throw ApiError.unauthorized("Reset authorization is invalid or expired");
    }

    const record = await passwordResetAuthorizationModel.findValidByHash(
      hashResetToken(resetToken)
    );
    if (!record) {
      throw ApiError.unauthorized("Reset authorization is invalid or expired");
    }

    const user = await userModel.findById(record.user_id);
    if (!user) {
      throw ApiError.unauthorized("Reset authorization is invalid or expired");
    }
    if (!user.password_hash) {
      throw ApiError.badRequest(
        "This account uses Google sign-in and cannot set a password this way."
      );
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userModel.updatePassword(user.id, newHash);
    await passwordResetAuthorizationModel.consume(record.id);
    await passwordResetAuthorizationModel.consumeAllForUser(user.id);
    await otpService.invalidatePasswordResetOtps(user.email);
    await userModel.incrementTokenVersion(user.id);

    try {
      const { sendEmail } = require("./emailService");
      await sendEmail({
        to: user.email,
        subject: "Your StudyKarle password was changed",
        html: "<p>Your StudyKarle password was changed successfully. If you did not do this, contact support immediately.</p>",
        text: "Your StudyKarle password was changed successfully. If you did not do this, contact support immediately.",
      });
    } catch (err) {
      // Password is already updated; do not fail the request on notify errors.
    }

    return { updated: true };
  },
};
