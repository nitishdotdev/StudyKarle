const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const publicCourseService = require("../services/publicCourseService");
const courseAnalyticsService = require("../services/courseAnalyticsService");

const PUBLIC_TRACKABLE_EVENTS = new Set(["course_visit", "unlock_cta_click"]);

module.exports = {
  listCourses: asyncHandler(async function (req, res) {
    const courses = await publicCourseService.listPublicCourses();
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return ApiResponse.ok(res, { courses: courses });
  }),

  getCourse: asyncHandler(async function (req, res) {
    const course = await publicCourseService.getPublicCourseBySlug(req.params.slug);
    if (!course) {
      throw ApiError.notFound("Course not found");
    }
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return ApiResponse.ok(res, { course: course });
  }),

  trackEvent: asyncHandler(async function (req, res) {
    const eventType = String((req.body && req.body.eventType) || "").trim();
    if (!PUBLIC_TRACKABLE_EVENTS.has(eventType)) {
      throw ApiError.badRequest("Invalid course analytics event type");
    }

    const slug = courseAnalyticsService.sanitizeCourseSlug(req.params.slug);
    if (!slug) {
      throw ApiError.badRequest("Invalid course slug");
    }

    const course = await publicCourseService.getPublicCourseBySlug(slug);
    if (!course) {
      throw ApiError.notFound("Course not found");
    }

    await courseAnalyticsService.recordEvent({
      eventType: eventType,
      courseSlug: course.slug,
      userId: req.user ? req.user.id : null,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      referrer: (req.body && req.body.referrer) || req.get("referer"),
    });

    return ApiResponse.ok(res, { recorded: true });
  }),

  adminAnalytics: asyncHandler(async function (req, res) {
    const days = req.query && req.query.days ? Number(req.query.days) : 30;
    const summary = await courseAnalyticsService.getConversionSummary({
      days: Number.isFinite(days) && days > 0 && days <= 365 ? days : 30,
    });
    return ApiResponse.ok(res, summary);
  }),
};
