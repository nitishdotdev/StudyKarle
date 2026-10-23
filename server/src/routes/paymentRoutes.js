const express = require("express");
const multer = require("multer");
const paymentController = require("../controllers/paymentController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { authenticatedActionLimiter } = require("../middleware/rateLimiter");
const { MAX_PROOF_BYTES } = require("../config/paymentConfig");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES },
});

router.use(authenticate);
router.use(authenticatedActionLimiter);

router.get("/payments/offer", paymentController.offer);
router.get("/payments/access", paymentController.access);
router.get("/payments/me", paymentController.me);
router.get("/payments/checkout", authorize("student"), paymentController.previewCheckout);
router.post("/payments/checkout", authorize("student"), paymentController.checkout);
router.post("/payments/submit", authorize("student"), upload.single("screenshot"), paymentController.submit);
router.get("/payments/:id", paymentController.getMine);

module.exports = router;
