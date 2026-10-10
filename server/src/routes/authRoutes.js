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

router.post("/logout", authController.logout);
router.get("/me", sessionCheckLimiter, authenticate, authController.me);

module.exports = router;
