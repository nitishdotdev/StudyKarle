const { body, param, query } = require("express-validator");

const createNoteValidator = [
  body("title")
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Title must be 2-200 characters"),
  body("description").optional({ checkFalsy: true }).isLength({ max: 2000 }),
  body("subjectId")
    .isInt({ min: 1 })
    .withMessage("A valid subject is required"),
  body("unitId").isInt({ min: 1 }).withMessage("A valid unit is required"), // ← REQUIRED now
  body("status").optional().isIn(["draft", "published"]),
];

const updateNoteValidator = [
  param("id").isInt({ min: 1 }),
  body("title").optional().trim().isLength({ min: 2, max: 200 }),
  body("description").optional({ checkFalsy: true }).isLength({ max: 2000 }),
  body("unitId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Unit ID must be a positive integer"),
  body("status").optional().isIn(["draft", "published"]),
];

// Bulk uploads derive each note's title from its filename, so `title` is not
// part of the payload (the old createNoteValidator rejected every bulk upload).
const bulkUploadValidator = [
  body("subjectId").isInt({ min: 1 }).withMessage("A valid subject is required"),
  body("unitId").isInt({ min: 1 }).withMessage("A valid unit is required"),
  body("description").optional({ checkFalsy: true }).isLength({ max: 2000 }),
];

const idParamValidator = [
  param("id").isInt({ min: 1 }).withMessage("Invalid id"),
];

const searchValidator = [
  query("q")
    .trim()
    .notEmpty()
    .withMessage("Search query is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be 1-100 characters"),
  query("kind")
    .optional({ checkFalsy: true })
    .isIn(["file", "folder"])
    .withMessage("kind must be file or folder"),
  query("year")
    .optional({ checkFalsy: true })
    .isIn(["1", "2"])
    .withMessage("year must be 1 or 2"),
  query("type")
    .optional({ checkFalsy: true })
    .isIn(["pdf"])
    .withMessage("type must be pdf"),
  query("page")
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer"),
  query("limit")
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 50 })
    .withMessage("limit must be between 1 and 50"),
];

module.exports = {
  createNoteValidator,
  bulkUploadValidator,
  updateNoteValidator,
  idParamValidator,
  searchValidator,
};
