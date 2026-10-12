const bcrypt = require("bcryptjs");
const userModel = require("../models/userModel");
const ApiError = require("../utils/ApiError");
const disposableEmailService = require("./disposableEmailService");
const { normalizeEmail } = require("../utils/email");

const SALT_ROUNDS = 10;
const GENERIC_LOGIN_ERROR = "Invalid email or password";

function toSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatar_url,
    course: user.course,
    current_year: user.current_year,
    created_at: user.created_at,
    has_password: !!user.password_hash,
    google_linked: !!user.google_sub,
  };
}

module.exports = {
  SALT_ROUNDS: SALT_ROUNDS,
  toSessionUser: toSessionUser,

  async signup(data) {
    const email = normalizeEmail(data.email);
    disposableEmailService.assertNotDisposable(email);

    const existing = await userModel.findByEmail(email);
    if (existing) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = await userModel.create({
      name: data.name,
      email: email,
      passwordHash: passwordHash,
      role: "student",
    });
    return toSessionUser(user);
  },

  async createUserFromOtp(otpData) {
    const email = normalizeEmail(otpData.email);
    disposableEmailService.assertNotDisposable(email);

    const existing = await userModel.findByEmail(email);
    if (existing) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const user = await userModel.create({
      name: otpData.name,
      email: email,
      passwordHash: otpData.passwordHash,
      role: "student",
    });

    return toSessionUser(user);
  },

  async login(email, password) {
    const normalized = normalizeEmail(email);
    disposableEmailService.assertNotDisposable(normalized);

    const user = await userModel.findByEmail(normalized);
    if (!user || !user.password_hash) {
      throw ApiError.unauthorized(GENERIC_LOGIN_ERROR);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw ApiError.unauthorized(GENERIC_LOGIN_ERROR);
    }

    return toSessionUser(user);
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = await userModel.findById(userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    if (!user.password_hash) {
      throw ApiError.badRequest(
        "This account uses Google sign-in. Set a password from account recovery after verifying ownership, or continue with Google."
      );
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw ApiError.badRequest("Current password is incorrect");
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userModel.updatePassword(userId, newHash);
  },
};
