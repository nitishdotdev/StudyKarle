const express = require("express");
const { param } = require("express-validator");
const noteController = require("../controllers/noteController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const { authenticatedActionLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.use("/notes", authenticate, authenticatedActionLimiter);

const noteIdValidator = [
  param("noteId").isInt({ min: 1 }).withMessage("Invalid note id"),
];

router.get("/notes/:noteId", noteIdValidator, validate, noteController.getById);
router.get(
  "/notes/:noteId/preview",
  noteIdValidator,
  validate,
  noteController.preview
);
router.get(
  "/notes/:noteId/download",
  noteIdValidator,
  validate,
  noteController.download
);

module.exports = router;
