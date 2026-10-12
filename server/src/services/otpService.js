const { sendEmail } = require("./emailService");
const otpVerificationModel = require("../models/otpVerificationModel");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const {
  hmacSha256,
  generateNumericOtp,
  timingSafeEqualHex,
} = require("../utils/cryptoHash");

const PURPOSE_SIGNUP = "signup";
const PURPOSE_PASSWORD_RESET = "password_reset";
const MAX_VERIFY_ATTEMPTS = 5;

function getExpiryTimestamp() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + env.otp.expiryMinutes);
  return now;
}

function hashOtp(otp) {
  return hmacSha256(otp);
}

function otpMatches(record, otp) {
  if (!record || !record.otp) {
    return false;
  }
  const candidate = hashOtp(otp);
  if (record.otp.length === 6 && /^\d{6}$/.test(record.otp)) {
    return record.otp === String(otp);
  }
  return timingSafeEqualHex(record.otp, candidate);
}

async function persistAndSend(options) {
  const otp = generateNumericOtp();
  const expiresAt = getExpiryTimestamp();
  const record = await otpVerificationModel.create({
    email: options.email,
    name: options.name || null,
    passwordHash: options.passwordHash || null,
    otp: hashOtp(otp),
    expiresAt: expiresAt,
    resendCount: options.resendCount || 0,
    purpose: options.purpose,
    attempts: 0,
  });

  try {
    await sendEmail({
      to: options.email,
      subject: options.subject,
      html: options.html(otp),
      text: options.text(otp),
    });
  } catch (err) {
    await otpVerificationModel.removeByEmailAndPurpose(
      options.email,
      options.purpose
    );
    throw err;
  }

  return {
    email: record.email,
    expiresAt: record.expires_at,
    remainingAttempts:
      env.otp.maxResendAttempts - (record.resend_count || 0),
  };
}

async function assertNotLocked(record) {
  if (!record) {
    throw ApiError.unauthorized("Invalid verification code");
  }
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw ApiError.unauthorized(
      "Too many incorrect codes. Please request a new one."
    );
  }
  const now = new Date();
  if (now > new Date(record.expires_at)) {
    throw ApiError.unauthorized(
      "Verification code has expired. Please request a new one."
    );
  }
}

module.exports = {
  PURPOSE_SIGNUP: PURPOSE_SIGNUP,
  PURPOSE_PASSWORD_RESET: PURPOSE_PASSWORD_RESET,
  MAX_VERIFY_ATTEMPTS: MAX_VERIFY_ATTEMPTS,
  hashOtp: hashOtp,

  async requestOtp(email, name, passwordHash) {
    await otpVerificationModel.removeByEmailAndPurpose(email, PURPOSE_SIGNUP);

    return persistAndSend({
      email: email,
      name: name,
      passwordHash: passwordHash,
      purpose: PURPOSE_SIGNUP,
      resendCount: 0,
      subject: "Your StudyKarle Verification Code",
      html: function (otp) {
        return (
          "<p>Your OTP is: <strong>" +
          otp +
          "</strong></p><p>Expires in " +
          env.otp.expiryMinutes +
          " minutes.</p>"
        );
      },
      text: function (otp) {
        return (
          "Your OTP is: " +
          otp +
          ". Expires in " +
          env.otp.expiryMinutes +
          " minutes."
        );
      },
    });
  },

  async verifyOtp(email, otp) {
    const record = await otpVerificationModel.findLatestByEmailAndPurpose(
      email,
      PURPOSE_SIGNUP
    );
    await assertNotLocked(record);

    if (!otpMatches(record, otp)) {
      await otpVerificationModel.incrementAttempts(record.id);
      throw ApiError.unauthorized("Invalid verification code");
    }

    await otpVerificationModel.consume(record.id);

    return {
      name: record.name,
      email: record.email,
      passwordHash: record.password_hash,
    };
  },

  async resendOtp(email) {
    const record = await otpVerificationModel.findLatestByEmailAndPurpose(
      email,
      PURPOSE_SIGNUP
    );

    if (!record) {
      throw ApiError.notFound("No pending verification found for this email");
    }

    if (record.resend_count >= env.otp.maxResendAttempts) {
      throw ApiError.forbidden(
        "Maximum resend attempts reached. Please start over."
      );
    }

    await otpVerificationModel.removeByEmailAndPurpose(email, PURPOSE_SIGNUP);

    return persistAndSend({
      email: record.email,
      name: record.name,
      passwordHash: record.password_hash,
      purpose: PURPOSE_SIGNUP,
      resendCount: record.resend_count + 1,
      subject: "Your StudyKarle Verification Code",
      html: function (otp) {
        return (
          "<p>Your OTP is: <strong>" +
          otp +
          "</strong></p><p>Expires in " +
          env.otp.expiryMinutes +
          " minutes.</p>"
        );
      },
      text: function (otp) {
        return (
          "Your OTP is: " +
          otp +
          ". Expires in " +
          env.otp.expiryMinutes +
          " minutes."
        );
      },
    });
  },

  async requestPasswordResetOtp(email) {
    await otpVerificationModel.removeByEmailAndPurpose(
      email,
      PURPOSE_PASSWORD_RESET
    );

    return persistAndSend({
      email: email,
      name: null,
      passwordHash: null,
      purpose: PURPOSE_PASSWORD_RESET,
      resendCount: 0,
      subject: "Your StudyKarle password reset code",
      html: function (otp) {
        return (
          "<p>Your password reset code is: <strong>" +
          otp +
          "</strong></p><p>Expires in " +
          env.otp.expiryMinutes +
          " minutes. If you did not request this, you can ignore this email.</p>"
        );
      },
      text: function (otp) {
        return (
          "Your password reset code is: " +
          otp +
          ". Expires in " +
          env.otp.expiryMinutes +
          " minutes. If you did not request this, you can ignore this email."
        );
      },
    });
  },

  async verifyPasswordResetOtp(email, otp) {
    const record = await otpVerificationModel.findLatestByEmailAndPurpose(
      email,
      PURPOSE_PASSWORD_RESET
    );
    await assertNotLocked(record);

    if (!otpMatches(record, otp)) {
      await otpVerificationModel.incrementAttempts(record.id);
      throw ApiError.unauthorized("Invalid verification code");
    }

    await otpVerificationModel.consume(record.id);
    return { email: record.email };
  },

  async resendPasswordResetOtp(email) {
    const record = await otpVerificationModel.findLatestByEmailAndPurpose(
      email,
      PURPOSE_PASSWORD_RESET
    );

    if (!record) {
      throw ApiError.notFound("No pending verification found for this email");
    }

    if (record.resend_count >= env.otp.maxResendAttempts) {
      throw ApiError.forbidden(
        "Maximum resend attempts reached. Please start over."
      );
    }

    await otpVerificationModel.removeByEmailAndPurpose(
      email,
      PURPOSE_PASSWORD_RESET
    );

    return persistAndSend({
      email: record.email,
      name: null,
      passwordHash: null,
      purpose: PURPOSE_PASSWORD_RESET,
      resendCount: record.resend_count + 1,
      subject: "Your StudyKarle password reset code",
      html: function (otp) {
        return (
          "<p>Your password reset code is: <strong>" +
          otp +
          "</strong></p><p>Expires in " +
          env.otp.expiryMinutes +
          " minutes. If you did not request this, you can ignore this email.</p>"
        );
      },
      text: function (otp) {
        return (
          "Your password reset code is: " +
          otp +
          ". Expires in " +
          env.otp.expiryMinutes +
          " minutes. If you did not request this, you can ignore this email."
        );
      },
    });
  },

  async cleanup(email) {
    await otpVerificationModel.removeByEmailAndPurpose(email, PURPOSE_SIGNUP);
  },

  async invalidatePasswordResetOtps(email) {
    await otpVerificationModel.consumeByEmailAndPurpose(
      email,
      PURPOSE_PASSWORD_RESET
    );
  },
};
