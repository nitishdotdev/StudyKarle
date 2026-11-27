const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const publicCourseService = require("../services/publicCourseService");
const courseAnalyticsService = require("../services/courseAnalyticsService");

const PUBLIC_TRACKABLE_EVENTS = new Set(["course_visit", "unlock_cta_click"]);

function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

module.exports = {
  listCourses: asyncHandler(async function (req, res) {
    const courses = await publicCourseService.listPublicCourses();
    res.set("Cache-Control", "no-store");
    return ApiResponse.ok(res, { courses: courses });
  }),

  getCourse: asyncHandler(async function (req, res) {
    const course = await publicCourseService.getPublicCourseBySlug(req.params.slug);
    if (!course) {
      throw ApiError.notFound("Course not found");
    }
    res.set("Cache-Control", "no-store");
    return ApiResponse.ok(res, { course: course });
  }),

  resolveItem: asyncHandler(async function (req, res) {
    const driveId = await publicCourseService.resolvePublishedItem(req.params.slug, req.params.itemKey);
    if (!driveId) throw ApiError.notFound("Course material not found");
    res.set("Cache-Control", "no-store");
    return ApiResponse.ok(res, { driveId });
  }),

  listManageableCourses: asyncHandler(async function (req, res) {
    return ApiResponse.ok(res, { courses: await publicCourseService.listManageableCourses() });
  }),

  getPublication: asyncHandler(async function (req, res) {
    const folderId = positiveId(req.params.folderId);
    const course = folderId && await publicCourseService.getManageableCourse(folderId);
    if (!course) throw ApiError.notFound("Course folder not found");
    return ApiResponse.ok(res, course);
  }),

  savePublication: asyncHandler(async function (req, res) {
    const folderId = positiveId(req.params.folderId);
    const { published, fileIds } = req.body || {};
    if (!folderId || typeof published !== "boolean" || !Array.isArray(fileIds) ||
        fileIds.length > 1000 || !fileIds.every(function (id) {
          return typeof id === "number" && positiveId(id);
        })) {
      throw ApiError.badRequest("Provide a course folder, publication status, and up to 1,000 material IDs");
    }
    const publication = await publicCourseService.savePublication(folderId, published, Array.from(new Set(fileIds)));
    if (!publication) throw ApiError.notFound("Course folder not found");
    return ApiResponse.ok(res, publication);
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
