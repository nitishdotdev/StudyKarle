const express = require("express");
const { param } = require("express-validator");
const yearController = require("../controllers/yearController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const { authenticatedActionLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.use(["/years", "/subjects"], authenticate, authenticatedActionLimiter);

router.get("/years", yearController.listYears);

router.get(
  "/years/:yearId/semesters",
  [param("yearId").isInt({ min: 1 }).withMessage("Invalid year id")],
  validate,
  yearController.listSemesters
);

router.get(
  "/subjects/:subjectId/units",
  [param("subjectId").isInt({ min: 1 }).withMessage("Invalid subject id")],
  validate,
  yearController.getSubjectUnits
);

module.exports = router;
