const { sendEmail } = require("./emailService");
const crypto = require("crypto");
const otpVerificationModel = require("../models/otpVerificationModel");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

function generateOtp() {
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0);
  return String(100000 + (num % 900000));
}

function getExpiryTimestamp() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + env.otp.expiryMinutes);
  return now;
}

module.exports = {
  async requestOtp(email, name, passwordHash) {
    await otpVerificationModel.removeByEmail(email);

    const otp = generateOtp();
    const expiresAt = getExpiryTimestamp();

    const record = await otpVerificationModel.create({
      email: email,
      name: name,
      passwordHash: passwordHash,
      otp: otp,
      expiresAt: expiresAt,
      resendCount: 0,
    });

    try {
      await sendEmail({
        to: email,
        subject: "Your StudyKarle Verification Code",
        html: `<p>Your OTP is: <strong>${otp}</strong></p><p>Expires in ${env.otp.expiryMinutes} minutes.</p>`,
        text: `Your OTP is: ${otp}. Expires in ${env.otp.expiryMinutes} minutes.`,
      });
    } catch (err) {
      await otpVerificationModel.removeByEmail(email);
      throw err;
    }

    return {
      email: record.email,
      expiresAt: record.expires_at,
    };
  },

  async verifyOtp(email, otp) {
    const record = await otpVerificationModel.findByEmailAndOtp(email, otp);

    if (!record) {
      throw ApiError.unauthorized("Invalid verification code");
    }

    const now = new Date();
    const expiresAt = new Date(record.expires_at);

    if (now > expiresAt) {
      throw ApiError.unauthorized(
        "Verification code has expired. Please request a new one."
      );
    }

    return {
      name: record.name,
      email: record.email,
      passwordHash: record.password_hash,
    };
  },

  async resendOtp(email) {
    const record = await otpVerificationModel.findByEmail(email);

    if (!record) {
      throw ApiError.notFound("No pending verification found for this email");
    }

    if (record.resend_count >= env.otp.maxResendAttempts) {
      throw ApiError.forbidden(
        "Maximum resend attempts reached. Please start over."
      );
    }

    const otp = generateOtp();
    const expiresAt = getExpiryTimestamp();

    await otpVerificationModel.removeByEmail(email);

    const newRecord = await otpVerificationModel.create({
      email: record.email,
      name: record.name,
      passwordHash: record.password_hash,
      otp: otp,
      expiresAt: expiresAt,
      resendCount: record.resend_count + 1,
    });

    try {
      await sendEmail({
        to: email,
        subject: "Your StudyKarle Verification Code",
        html: `<p>Your OTP is: <strong>${otp}</strong></p><p>Expires in ${env.otp.expiryMinutes} minutes.</p>`,
        text: `Your OTP is: ${otp}. Expires in ${env.otp.expiryMinutes} minutes.`,
      });
    } catch (err) {
      await otpVerificationModel.removeByEmail(email);
      throw err;
    }

    return {
      email: newRecord.email,
      expiresAt: newRecord.expires_at,
      remainingAttempts: env.otp.maxResendAttempts - newRecord.resend_count,
    };
  },

  async cleanup(email) {
    await otpVerificationModel.removeByEmail(email);
  },
};
