const express = require("express");
const authController = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const {
  authLimiter,
  authIpLimiter,
  otpRequestLimiter,
  otpIpLimiter,
  sensitiveActionLimiter,
  sessionCheckLimiter,
} = require("../middleware/rateLimiter");
const {
  signupValidator,
  loginValidator,
  requestPasswordResetValidator,
  verifyPasswordResetOtpValidator,
  resetPasswordValidator,
} = require("../validators/authValidators");
const {
  requestOtpValidator,
  verifyOtpValidator,
  resendOtpValidator,
} = require("../validators/otpValidators");

const router = express.Router();

router.post(
  "/request-otp",
  otpIpLimiter,
  otpRequestLimiter,
  requestOtpValidator,
  validate,
  authController.requestOtp
);

router.post(
  "/verify-otp",
  authIpLimiter,
  sensitiveActionLimiter,
  verifyOtpValidator,
  validate,
  authController.verifyOtp
);

router.post(
  "/resend-otp",
  otpIpLimiter,
  sensitiveActionLimiter,
  resendOtpValidator,
  validate,
  authController.resendOtp
);

router.post(
  "/signup",
  authIpLimiter,
  authLimiter,
  signupValidator,
  validate,
  authController.signup
);

router.post(
  "/login",
  authIpLimiter,
  authLimiter,
  loginValidator,
  validate,
  authController.login
);

router.post(
  "/forgot-password",
  otpIpLimiter,
  otpRequestLimiter,
  requestPasswordResetValidator,
  validate,
  authController.requestPasswordReset
);

router.post(
  "/forgot-password/resend",
  otpIpLimiter,
  sensitiveActionLimiter,
  requestPasswordResetValidator,
  validate,
  authController.resendPasswordReset
);

router.post(
  "/forgot-password/verify",
  authIpLimiter,
  sensitiveActionLimiter,
  verifyPasswordResetOtpValidator,
  validate,
  authController.verifyPasswordResetOtp
);

router.post(
  "/reset-password",
  authIpLimiter,
  sensitiveActionLimiter,
  resetPasswordValidator,
  validate,
  authController.resetPassword
);

router.get("/google", authController.googleStart);
router.get("/google/callback", authController.googleCallback);
router.post(
  "/google/complete",
  authIpLimiter,
  authLimiter,
  authController.googleComplete
);

router.post("/logout", authController.logout);
router.get("/me", sessionCheckLimiter, authenticate, authController.me);

module.exports = router;
