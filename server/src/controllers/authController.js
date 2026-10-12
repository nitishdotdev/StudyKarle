const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const authService = require("../services/authService");
const otpService = require("../services/otpService");
const tokenService = require("../services/tokenService");
const googleAuthService = require("../services/googleAuthService");
const passwordResetService = require("../services/passwordResetService");
const disposableEmailService = require("../services/disposableEmailService");
const userModel = require("../models/userModel");
const oauthLoginTicketModel = require("../models/oauthLoginTicketModel");
const env = require("../config/env");
const { hmacSha256, randomToken } = require("../utils/cryptoHash");
const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { normalizeEmail } = require("../utils/email");

function issueSession(res, user) {
  const token = tokenService.signToken(user.id, user.token_version || 0);
  tokenService.setAuthCookie(res, token);
}

function clientErrorRedirect(message, extra) {
  const params = new URLSearchParams();
  params.set("error", message);
  if (extra) {
    Object.keys(extra).forEach(function (key) {
      if (extra[key]) params.set(key, extra[key]);
    });
  }
  return env.clientUrl.replace(/\/$/, "") + "/login?" + params.toString();
}

function clientSuccessRedirect(ticket, path) {
  const params = new URLSearchParams();
  params.set("ticket", ticket);
  params.set("redirect", googleAuthService.safeRedirectPath(path));
  return (
    env.clientUrl.replace(/\/$/, "") +
    "/auth/google/complete?" +
    params.toString()
  );
}

module.exports = {
  requestOtp: asyncHandler(async function (req, res) {
    const { name, email, password } = req.body;
    const normalized = normalizeEmail(email);
    disposableEmailService.assertNotDisposable(normalized);

    const existing = await userModel.findByEmail(normalized);
    if (existing) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await otpService.requestOtp(normalized, name, passwordHash);

    return ApiResponse.ok(res, {
      message: "Verification code sent to your email",
      email: result.email,
      expiresAt: result.expiresAt,
    });
  }),

  verifyOtp: asyncHandler(async function (req, res) {
    const { email, otp } = req.body;
    const normalized = normalizeEmail(email);
    disposableEmailService.assertNotDisposable(normalized);

    const otpData = await otpService.verifyOtp(normalized, otp);
    const user = await authService.createUserFromOtp(otpData);

    await otpService.cleanup(normalized);

    const full = await userModel.findById(user.id);
    issueSession(res, full || user);

    return ApiResponse.created(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      has_password: user.has_password,
      google_linked: user.google_linked,
    });
  }),

  resendOtp: asyncHandler(async function (req, res) {
    const { email } = req.body;
    const normalized = normalizeEmail(email);
    disposableEmailService.assertNotDisposable(normalized);

    const result = await otpService.resendOtp(normalized);

    return ApiResponse.ok(res, {
      message: "New verification code sent to your email",
      email: result.email,
      expiresAt: result.expiresAt,
      remainingAttempts: result.remainingAttempts,
    });
  }),

  signup: asyncHandler(async function (req, res) {
    const user = await authService.signup(req.body);
    const full = await userModel.findById(user.id);
    issueSession(res, full || user);
    return ApiResponse.created(res, user);
  }),

  login: asyncHandler(async function (req, res) {
    const user = await authService.login(req.body.email, req.body.password);
    const full = await userModel.findById(user.id);
    issueSession(res, full || user);
    return ApiResponse.ok(res, user);
  }),

  logout: asyncHandler(async function (req, res) {
    tokenService.clearAuthCookie(res);
    return ApiResponse.ok(res, { loggedOut: true });
  }),

  me: asyncHandler(async function (req, res) {
    const user = await userModel.findPublicById(req.user.id);
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    return ApiResponse.ok(res, user);
  }),

  requestPasswordReset: asyncHandler(async function (req, res) {
    const result = await passwordResetService.requestReset(req.body.email);
    return ApiResponse.ok(res, {
      message: result.message,
    });
  }),

  resendPasswordReset: asyncHandler(async function (req, res) {
    const result = await passwordResetService.resendReset(req.body.email);
    return ApiResponse.ok(res, {
      message: result.message,
    });
  }),

  verifyPasswordResetOtp: asyncHandler(async function (req, res) {
    const result = await passwordResetService.verifyResetOtp(
      req.body.email,
      req.body.otp
    );
    return ApiResponse.ok(res, {
      message: "Verification successful. You may now set a new password.",
      resetToken: result.resetToken,
      expiresAt: result.expiresAt,
    });
  }),

  resetPassword: asyncHandler(async function (req, res) {
    if (req.body.password !== req.body.confirmPassword) {
      throw ApiError.badRequest("Passwords do not match");
    }
    await passwordResetService.resetPassword(
      req.body.resetToken,
      req.body.password
    );
    return ApiResponse.ok(res, {
      message: "Password updated. You can now log in with your new password.",
    });
  }),

  googleStart: asyncHandler(async function (req, res) {
    const nonce = crypto.randomBytes(16).toString("hex");
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const redirectTo = req.query.redirect || "/dashboard";
    const url = googleAuthService.buildAuthorizationUrl(
      nonce,
      codeVerifier,
      redirectTo
    );
    return res.redirect(url);
  }),

  googleCallback: asyncHandler(async function (req, res) {
    if (req.query.error) {
      return res.redirect(
        clientErrorRedirect("Google sign-in was cancelled. Please try again.")
      );
    }

    const code = req.query.code;
    const state = req.query.state;
    if (!code || !state) {
      return res.redirect(
        clientErrorRedirect("Google sign-in failed. Please try again.")
      );
    }

    let statePayload;
    try {
      statePayload = googleAuthService.verifyState(state);
    } catch (err) {
      return res.redirect(
        clientErrorRedirect("Google sign-in failed. Please try again.")
      );
    }

    let tokens;
    try {
      tokens = await googleAuthService.exchangeCode(code, statePayload.cv);
    } catch (err) {
      return res.redirect(
        clientErrorRedirect("Google sign-in failed. Please try again.")
      );
    }

    if (!tokens || !tokens.id_token) {
      return res.redirect(
        clientErrorRedirect("Google sign-in failed. Please try again.")
      );
    }

    let identity;
    try {
      identity = await googleAuthService.verifyIdToken(
        tokens.id_token,
        statePayload.n
      );
    } catch (err) {
      const message =
        err && err.isOperational
          ? err.message
          : "Google sign-in failed. Please try again.";
      return res.redirect(clientErrorRedirect(message));
    }

    let user;
    try {
      user = await googleAuthService.findOrCreateFromGoogle(identity);
    } catch (err) {
      const message =
        err && err.isOperational
          ? err.message
          : "Google sign-in failed. Please try again.";
      return res.redirect(clientErrorRedirect(message));
    }

    const full = await userModel.findById(user.id);
    const ticket = randomToken(32);
    await oauthLoginTicketModel.create({
      userId: (full || user).id,
      ticketHash: hmacSha256("google:" + ticket),
      expiresAt: new Date(Date.now() + 2 * 60 * 1000),
    });
    return res.redirect(clientSuccessRedirect(ticket, statePayload.r));
  }),

  googleComplete: asyncHandler(async function (req, res) {
    const ticket = req.body && req.body.ticket;
    if (!ticket) {
      throw ApiError.unauthorized("Google sign-in failed. Please try again.");
    }
    const record = await oauthLoginTicketModel.findValidByHash(
      hmacSha256("google:" + ticket)
    );
    if (!record) {
      throw ApiError.unauthorized("Google sign-in expired. Please try again.");
    }
    const user = await userModel.findById(record.user_id);
    if (!user) {
      await oauthLoginTicketModel.consume(record.id);
      throw ApiError.unauthorized("Google sign-in failed. Please try again.");
    }
    disposableEmailService.assertNotDisposable(user.email);
    await oauthLoginTicketModel.consume(record.id);
    issueSession(res, user);
    return ApiResponse.ok(res, userModel.publicUser(user));
  }),
};
