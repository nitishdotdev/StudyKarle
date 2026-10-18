const { body } = require("express-validator");

const signupValidator = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Name must be 2-120 characters"),
  body("email")
    .trim()
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/\d/)
    .withMessage("Password must contain at least one number"),
];

const loginValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const changePasswordValidator = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters")
    .matches(/\d/)
    .withMessage("New password must contain at least one number"),
];

const requestPasswordResetValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),
];

const verifyPasswordResetOtpValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("A valid email is required")
    .normalizeEmail(),
  body("otp")
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),
];

const resetPasswordValidator = [
  body("resetToken").trim().notEmpty().withMessage("Reset authorization is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/\d/)
    .withMessage("Password must contain at least one number"),
  body("confirmPassword")
    .notEmpty()
    .withMessage("Please confirm your new password"),
];

const googleLinkTicketValidator = [
  body("ticket")
    .isString()
    .withMessage("A linking ticket is required")
    .trim()
    .notEmpty()
    .withMessage("A linking ticket is required")
    .isLength({ max: 512 })
    .withMessage("A linking ticket is required"),
];

const googleLinkVerifyValidator = [
  body("ticket")
    .isString()
    .withMessage("A linking ticket is required")
    .trim()
    .notEmpty()
    .withMessage("A linking ticket is required")
    .isLength({ max: 512 })
    .withMessage("A linking ticket is required"),
  body("password")
    .isString()
    .withMessage("Password is required")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ max: 1024 })
    .withMessage("Password is too long"),
];

const googleLinkRecoveryVerifyValidator = [
  body("ticket")
    .isString()
    .withMessage("A linking ticket is required")
    .trim()
    .notEmpty()
    .withMessage("A linking ticket is required")
    .isLength({ max: 512 })
    .withMessage("A linking ticket is required"),
  body("otp")
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),
];

module.exports = {
  signupValidator: signupValidator,
  loginValidator: loginValidator,
  changePasswordValidator: changePasswordValidator,
  requestPasswordResetValidator: requestPasswordResetValidator,
  verifyPasswordResetOtpValidator: verifyPasswordResetOtpValidator,
  resetPasswordValidator: resetPasswordValidator,
  googleLinkTicketValidator: googleLinkTicketValidator,
  googleLinkVerifyValidator: googleLinkVerifyValidator,
  googleLinkRecoveryVerifyValidator: googleLinkRecoveryVerifyValidator,
};
