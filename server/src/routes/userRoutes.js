const express = require("express");
const userController = require("../controllers/userController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { changePasswordValidator } = require("../validators/authValidators");
const {
  authenticatedActionLimiter,
  sensitiveActionLimiter,
} = require("../middleware/rateLimiter");
const { body } = require("express-validator");

const router = express.Router();

router.use(authenticate);
router.use(authenticatedActionLimiter);

router.get("/me", userController.getMe);
router.get("/me/continue-studying", authorize("student"), userController.continueStudying);

router.patch(
  "/me",
  [
    body("name").optional().trim().isLength({ min: 2, max: 120 }),
    body("course").optional().trim().isLength({ max: 150 }),
    body("currentYear").optional().trim().isLength({ max: 50 }),
  ],
  validate,
  userController.updateMe
);

// Password changes are sensitive even for an already-authenticated user
// (e.g. account takeover after a session is stolen), so they get the
// tighter, account-aware limiter on top of the normal authenticated one.
router.patch(
  "/me/password",
  sensitiveActionLimiter,
  changePasswordValidator,
  validate,
  userController.changePassword
);

module.exports = router;
