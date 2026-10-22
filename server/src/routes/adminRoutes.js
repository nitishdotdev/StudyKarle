const express = require("express");
const multer = require("multer");
const adminController = require("../controllers/adminController");
const paymentController = require("../controllers/paymentController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const {
  createNoteValidator,
  bulkUploadValidator,
  updateNoteValidator,
  idParamValidator,
} = require("../validators/noteValidators");
const {
  createSubjectValidator,
  updateSubjectValidator,
} = require("../validators/subjectValidators");
const constants = require("../config/constants");
const { authenticatedActionLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: constants.MAX_UPLOAD_BYTES },
});

router.use(authenticate, authorize("admin"), authenticatedActionLimiter);

router.get("/stats", adminController.stats);
router.get("/activity", adminController.activity);
router.get("/pdf-activity", adminController.pdfActivity);
router.delete("/pdf-activity", adminController.clearPdfActivity);
router.get("/view-history", adminController.viewHistory);

router.get("/drive-sync/status", adminController.driveSyncStatus);
router.post("/drive-sync", adminController.triggerDriveSync);

router.get("/notes", adminController.listNotes);
router.post(
  "/notes",
  upload.single("file"),
  createNoteValidator,
  validate,
  adminController.createNote
);
router.post(
  "/notes/bulk-upload",
  upload.array("files", 50),
  bulkUploadValidator,
  validate,
  adminController.bulkUploadNotes
);
router.patch(
  "/notes/:id",
  updateNoteValidator,
  validate,
  adminController.updateNote
);
router.delete(
  "/notes/:id",
  idParamValidator,
  validate,
  adminController.deleteNote
);

router.get("/subjects", adminController.listSubjects);
router.post(
  "/subjects",
  createSubjectValidator,
  validate,
  adminController.createSubject
);
router.patch(
  "/subjects/:id",
  updateSubjectValidator,
  validate,
  adminController.updateSubject
);
router.delete(
  "/subjects/:id",
  idParamValidator,
  validate,
  adminController.deleteSubject
);

router.get("/users", adminController.listUsers);
router.patch(
  "/users/:id/role",
  idParamValidator,
  validate,
  adminController.updateUserRole
);
router.delete(
  "/users/:id",
  idParamValidator,
  validate,
  adminController.deleteUser
);

router.get("/payments", paymentController.adminList);
router.get("/payments/:id", paymentController.adminGet);
router.get("/payments/:id/screenshot", paymentController.adminScreenshot);
router.post("/payments/:id/approve", paymentController.adminApprove);
router.post("/payments/:id/reject", paymentController.adminReject);

module.exports = router;
