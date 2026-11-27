const express = require("express");
const publicCourseController = require("../controllers/publicCourseController");
const { publicApiLimiter } = require("../middleware/rateLimiter");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.use(publicApiLimiter);

router.get("/courses", publicCourseController.listCourses);
router.get("/courses/:slug", publicCourseController.getCourse);
router.get("/courses/:slug/items/:itemKey", authenticate, publicCourseController.resolveItem);
router.post("/courses/:slug/events", publicCourseController.trackEvent);

module.exports = router;
