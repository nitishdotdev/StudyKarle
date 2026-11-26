const courseAnalyticsModel = require("../models/courseAnalyticsModel");
const { hmacSha256 } = require("../utils/cryptoHash");
const env = require("../config/env");

const ALLOWED_EVENTS = new Set([
  "course_visit",
  "unlock_cta_click",
  "unlock_checkout",
  "unlock_approved",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function sanitizeCourseSlug(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value || value.length > 160) return null;
  if (!SLUG_RE.test(value)) return null;
  return value;
}

function extractReferrerHost(rawReferrer) {
  if (!rawReferrer) return null;
  try {
    const parsed = new URL(String(rawReferrer));
    return parsed.hostname ? parsed.hostname.toLowerCase().slice(0, 255) : null;
  } catch (err) {
    return null;
  }
}

function buildVisitorHash(ip, userAgent) {
  const ipPart = String(ip || "").trim();
  const uaPart = String(userAgent || "").trim().slice(0, 200);
  if (!ipPart && !uaPart) return null;
  return hmacSha256(
    "course-visitor:" + ipPart + "|" + uaPart,
    env.otpSecret || env.csrfSecret || env.jwtSecret
  );
}

async function recordEvent(params, trx) {
  const eventType = String((params && params.eventType) || "").trim();
  if (!ALLOWED_EVENTS.has(eventType)) return null;

  const courseSlug = sanitizeCourseSlug(params && params.courseSlug);
  if (!courseSlug) return null;

  const entry = {
    event_type: eventType,
    course_slug: courseSlug,
    user_id: params && params.userId ? Number(params.userId) : null,
    visitor_hash: buildVisitorHash(params && params.ip, params && params.userAgent),
    referrer_host: extractReferrerHost(params && params.referrer),
  };

  try {
    return await courseAnalyticsModel.record(entry, trx);
  } catch (err) {
    // Best-effort analytics must never break public pages or payment flows.
    return null;
  }
}

async function getConversionSummary(options) {
  const days = options && Number(options.days) > 0 ? Number(options.days) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await courseAnalyticsModel.summarizeByCourse(since);

  const bySlug = new Map();
  const totals = {
    visits: 0,
    ctaClicks: 0,
    checkouts: 0,
    approvals: 0,
  };

  (rows || []).forEach(function (row) {
    const slug = row.course_slug;
    const count = Number(row.total) || 0;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, {
        slug: slug,
        visits: 0,
        ctaClicks: 0,
        checkouts: 0,
        approvals: 0,
      });
    }
    const bucket = bySlug.get(slug);
    if (row.event_type === "course_visit") {
      bucket.visits += count;
      totals.visits += count;
    } else if (row.event_type === "unlock_cta_click") {
      bucket.ctaClicks += count;
      totals.ctaClicks += count;
    } else if (row.event_type === "unlock_checkout") {
      bucket.checkouts += count;
      totals.checkouts += count;
    } else if (row.event_type === "unlock_approved") {
      bucket.approvals += count;
      totals.approvals += count;
    }
  });

  const courses = Array.from(bySlug.values())
    .map(function (item) {
      return {
        slug: item.slug,
        visits: item.visits,
        ctaClicks: item.ctaClicks,
        checkouts: item.checkouts,
        approvals: item.approvals,
        visitToCheckoutRate:
          item.visits > 0 ? Number(((item.checkouts / item.visits) * 100).toFixed(2)) : 0,
        visitToApprovalRate:
          item.visits > 0 ? Number(((item.approvals / item.visits) * 100).toFixed(2)) : 0,
      };
    })
    .sort(function (a, b) {
      return b.visits - a.visits || b.approvals - a.approvals;
    });

  return {
    windowDays: days,
    totals: {
      visits: totals.visits,
      ctaClicks: totals.ctaClicks,
      checkouts: totals.checkouts,
      approvals: totals.approvals,
      visitToCheckoutRate:
        totals.visits > 0 ? Number(((totals.checkouts / totals.visits) * 100).toFixed(2)) : 0,
      visitToApprovalRate:
        totals.visits > 0 ? Number(((totals.approvals / totals.visits) * 100).toFixed(2)) : 0,
    },
    courses: courses,
  };
}

module.exports = {
  ALLOWED_EVENTS,
  sanitizeCourseSlug,
  extractReferrerHost,
  buildVisitorHash,
  recordEvent,
  getConversionSummary,
};
