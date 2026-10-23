const express = require("express");
const driveController = require("../controllers/driveController");
const authenticate = require("../middleware/authenticate");
const {
  authenticatedActionLimiter,
  publicApiLimiter,
} = require("../middleware/rateLimiter");

const router = express.Router();

// ------------------------------------------------------------------
// Public share access. These endpoints are reachable without a login —
// the security boundary is the cryptographically random, revocable share
// token embedded in the URL, and the per-share permission (preview-only
// vs download). Normal file metadata/preview/download remain protected.
// ------------------------------------------------------------------
router.get("/drive/shares/:token", publicApiLimiter, driveController.getSharedFile);
router.get(
  "/drive/shares/:token/preview",
  publicApiLimiter,
  driveController.previewShared
);
router.get(
  "/drive/shares/:token/download",
  publicApiLimiter,
  driveController.downloadShared
);

// ------------------------------------------------------------------
// Protected drive tree + file access. `:nodeId` is a stable Google Drive
// file id (not a numeric StudyKarle id), so it is NOT constrained with
// isInt().
// ------------------------------------------------------------------
router.use(authenticate);
router.use(authenticatedActionLimiter);

router.get("/drive", driveController.listRoot);
router.get("/drive/nodes/:nodeId", driveController.listFolder);
router.get("/drive/files/:nodeId", driveController.getFile);
router.get("/drive/files/:nodeId/thumbnail", driveController.thumbnail);
router.get("/drive/files/:nodeId/preview", driveController.preview);
router.get("/drive/files/:nodeId/download", driveController.download);

// Share management (create/list/update/revoke) — requires an authenticated,
// authorized user. Public consumption happens via /drive/shares/:token.
router.get("/drive/files/:nodeId/share", driveController.listShares);
router.post("/drive/files/:nodeId/share", driveController.createShare);
router.patch("/drive/files/:nodeId/share/:shareId", driveController.updateShare);
router.delete("/drive/files/:nodeId/share/:shareId", driveController.revokeShare);

module.exports = router;
