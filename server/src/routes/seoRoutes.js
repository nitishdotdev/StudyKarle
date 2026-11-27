const express = require("express");
const publicCourseService = require("../services/publicCourseService");
const { publicApiLimiter } = require("../middleware/rateLimiter");

const router = express.Router();
const SITE_URL = "https://www.studykarle.me";
const SOCIAL_IMAGE = SITE_URL + "/social-preview.png";

const STATIC_PUBLIC_PATHS = [
  "/",
  "/courses",
  "/features",
  "/how-it-works",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderHtmlShell(opts) {
  const canonical = opts.canonical;
  const robots = opts.noindex
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large";

  return (
    "<!doctype html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '  <meta charset="UTF-8" />\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    "  <title>" + escapeHtml(opts.title) + "</title>\n" +
    '  <meta name="description" content="' + escapeHtml(opts.description) + '" />\n' +
    '  <meta name="robots" content="' + robots + '" />\n' +
    '  <link rel="canonical" href="' + escapeHtml(canonical) + '" />\n' +
    '  <meta property="og:type" content="website" />\n' +
    '  <meta property="og:title" content="' + escapeHtml(opts.title) + '" />\n' +
    '  <meta property="og:description" content="' + escapeHtml(opts.description) + '" />\n' +
    '  <meta property="og:url" content="' + escapeHtml(canonical) + '" />\n' +
    '  <meta property="og:image" content="' + escapeHtml(SOCIAL_IMAGE) + '" />\n' +
    '  <meta property="og:site_name" content="StudyKarle" />\n' +
    '  <meta property="og:locale" content="en_IN" />\n' +
    '  <meta name="twitter:card" content="summary_large_image" />\n' +
    '  <meta name="twitter:title" content="' + escapeHtml(opts.title) + '" />\n' +
    '  <meta name="twitter:description" content="' + escapeHtml(opts.description) + '" />\n' +
    '  <meta name="twitter:image" content="' + escapeHtml(SOCIAL_IMAGE) + '" />\n' +
    '  <script id="studykarle-schema" type="application/ld+json">' +
    safeJsonLd(opts.schema) +
    "</script>\n" +
    "  <style>" +
    "body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;color:#111827;background:#f8fafc;line-height:1.5}" +
    "header,main,footer{max-width:960px;margin:0 auto;padding:24px 16px}" +
    "header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;background:#fff}" +
    "a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}" +
    ".stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:20px 0}" +
    ".card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px}" +
    ".badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;background:#eff6ff;color:#1d4ed8}" +
    ".locked{background:#fef3c7;color:#92400e}" +
    ".cta{display:inline-block;margin-top:12px;padding:10px 18px;border-radius:8px;background:#2563eb;color:#fff;font-weight:600}" +
    "ul.items{list-style:none;padding:0;display:grid;gap:10px}" +
    "</style>\n" +
    "</head>\n" +
    "<body>\n" +
    '  <header><a href="' + SITE_URL + '/"><strong>StudyKarle</strong></a>' +
    '<nav aria-label="Primary"><a href="' + SITE_URL + '/courses">Courses</a> &middot; ' +
    '<a href="' + SITE_URL + '/how-it-works">How It Works</a> &middot; ' +
    '<a href="' + SITE_URL + '/signup">Sign Up</a></nav></header>\n' +
    "  <main>\n" +
    opts.bodyHtml +
    "\n  </main>\n" +
    '  <footer><p>&copy; StudyKarle &middot; <a href="' + SITE_URL + '/courses">All Courses</a> &middot; ' +
    '<a href="' + SITE_URL + '/privacy">Privacy</a> &middot; <a href="' + SITE_URL + '/terms">Terms</a></p></footer>\n' +
    "</body>\n" +
    "</html>\n"
  );
}

router.get("/sitemap.xml", publicApiLimiter, async function (req, res) {
  let courses;
  try {
    courses = await publicCourseService.listPublicCourses();
  } catch (err) {
    return res.status(503).set("Cache-Control", "no-store").send("Course catalog temporarily unavailable");
  }

  const staticUrls = STATIC_PUBLIC_PATHS.map(function (path) {
    return (
      "  <url><loc>" +
      escapeXml(SITE_URL + (path === "/" ? "/" : path)) +
      "</loc></url>"
    );
  });

  const courseUrls = courses.map(function (course) {
    const loc = escapeXml(SITE_URL + "/courses/" + course.slug);
    const lastmod = course.updatedAt
      ? "<lastmod>" + escapeXml(course.updatedAt.slice(0, 10)) + "</lastmod>"
      : "";
    return "  <url><loc>" + loc + "</loc>" + lastmod + "</url>";
  });

  res
    .type("application/xml")
    .set("Cache-Control", "no-store")
    .send(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        staticUrls.concat(courseUrls).join("\n") +
        "\n</urlset>\n"
    );
});

router.get("/courses", publicApiLimiter, async function (req, res) {
  let courses;
  try {
    courses = await publicCourseService.listPublicCourses();
  } catch (err) {
    return res.status(503).set("Cache-Control", "no-store").send("Course catalog temporarily unavailable");
  }

  const canonical = SITE_URL + "/courses";
  const title = "Engineering Courses, Notes & PYQ Solutions | StudyKarle";
  const description =
    "Browse engineering subjects on StudyKarle with organized lecture notes, previous-year question papers (PYQs), and solutions. Unlock full semester access for ₹9.";

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": SITE_URL + "/#organization",
        name: "StudyKarle",
        url: SITE_URL + "/",
      },
      {
        "@type": "WebSite",
        "@id": SITE_URL + "/#website",
        url: SITE_URL + "/",
        name: "StudyKarle",
        publisher: { "@id": SITE_URL + "/#organization" },
      },
      {
        "@type": "CollectionPage",
        "@id": canonical + "#webpage",
        url: canonical,
        name: title,
        description: description,
        isPartOf: { "@id": SITE_URL + "/#website" },
      },
      {
        "@type": "ItemList",
        name: "StudyKarle Engineering Courses",
        numberOfItems: courses.length,
        itemListElement: courses.map(function (c, idx) {
          return {
            "@type": "ListItem",
            position: idx + 1,
            name: c.title,
            url: SITE_URL + "/courses/" + c.slug,
          };
        }),
      },
    ],
  };

  const listHtml = courses.length
    ? '<ul class="items">' +
      courses
        .map(function (c) {
          return (
            '<li class="card">' +
            '<h2><a href="' + SITE_URL + "/courses/" + escapeHtml(c.slug) + '">' +
            escapeHtml(c.title) +
            "</a></h2>" +
            "<p>" +
            escapeHtml(c.yearLabel) +
            " &middot; " +
            c.counts.notes + " Notes &middot; " +
            c.counts.pyqs + " PYQs &middot; " +
            c.counts.solutions + " Solutions" +
            (c.locked ? ' &middot; <span class="badge locked">Locked &middot; ' + escapeHtml(c.priceFormatted) + "</span>" : "") +
            "</p></li>"
          );
        })
        .join("") +
      "</ul>"
    : "<p>Courses are updated continuously as new semester notes and PYQs are synced.</p>";

  const bodyHtml =
    "<h1>Engineering Courses, Notes &amp; PYQ Solutions</h1>" +
    "<p>" + escapeHtml(description) + "</p>" +
    listHtml;

  res
    .type("text/html; charset=utf-8")
    .set("Cache-Control", "no-store")
    .send(
      renderHtmlShell({
        title: title,
        description: description,
        canonical: canonical,
        schema: schema,
        bodyHtml: bodyHtml,
      })
    );
});

router.get("/courses/:slug", publicApiLimiter, async function (req, res) {
  let course;
  try {
    course = await publicCourseService.getPublicCourseBySlug(req.params.slug);
  } catch (err) {
    return res.status(503).set("Cache-Control", "no-store").send("Course catalog temporarily unavailable");
  }

  if (!course) {
    const notFoundCanonical = SITE_URL + "/courses";
    return res
      .status(404)
      .type("text/html; charset=utf-8")
      .set("Cache-Control", "no-store")
      .send(
        renderHtmlShell({
          title: "Course Not Found | StudyKarle",
          description: "The requested StudyKarle course page could not be found.",
          canonical: notFoundCanonical,
          noindex: true,
          schema: {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Course Not Found",
            url: notFoundCanonical,
          },
          bodyHtml:
            '<h1>Course not found</h1><p>Explore all available engineering subjects in the <a href="' +
            SITE_URL +
            '/courses">StudyKarle course catalog</a>.</p>',
        })
      );
  }

  const canonical = course.seo.canonicalUrl;
  const unlockUrl =
    SITE_URL +
    "/signup?returnTo=" +
    encodeURIComponent("/access?course=" + course.slug);

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": SITE_URL + "/#organization",
        name: "StudyKarle",
        url: SITE_URL + "/",
      },
      {
        "@type": "WebSite",
        "@id": SITE_URL + "/#website",
        url: SITE_URL + "/",
        name: "StudyKarle",
        publisher: { "@id": SITE_URL + "/#organization" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL + "/" },
          { "@type": "ListItem", position: 2, name: "Courses", item: SITE_URL + "/courses" },
          { "@type": "ListItem", position: 3, name: course.title, item: canonical },
        ],
      },
      {
        "@type": "Course",
        "@id": canonical + "#course",
        name: course.title,
        description: course.seo.description,
        url: canonical,
        provider: { "@id": SITE_URL + "/#organization" },
        offers: course.locked ? {
          "@type": "Offer",
          price: String(course.priceRupees),
          priceCurrency: "INR",
          availability: "https://schema.org/InStock",
          url: unlockUrl,
        } : undefined,
      },
      {
        "@type": "ItemList",
        name: course.title + " Study Materials",
        numberOfItems: course.items.length,
        itemListElement: course.items.slice(0, 50).map(function (item, idx) {
          return {
            "@type": "ListItem",
            position: idx + 1,
            name: item.title,
          };
        }),
      },
    ],
  };

  const itemsHtml = course.items
    .map(function (item) {
      const catLabel =
        item.category === "pyq_solution"
          ? "PYQ + Solution"
          : item.category === "pyqs"
            ? "PYQ"
            : item.category === "solutions"
              ? "Solution"
              : "Notes";
      return (
        '<li class="card">' +
        "<strong>" + escapeHtml(item.title) + "</strong> " +
        '<span class="badge">' + catLabel + "</span> " +
        (item.locked ? '<span class="badge locked">Locked Preview</span>' : "") +
        (item.unitLabel ? "<div><small>" + escapeHtml(item.unitLabel) + "</small></div>" : "") +
        "</li>"
      );
    })
    .join("");

  const stepsHtml = course.unlockSteps
    .map(function (step) {
      return "<li>" + escapeHtml(step) + "</li>";
    })
    .join("");

  const bodyHtml =
    '<p><a href="' + SITE_URL + '/courses">&larr; All Courses</a> &middot; ' +
    escapeHtml(course.yearLabel) + "</p>" +
    "<h1>" + escapeHtml(course.title) + " — Notes, PYQs &amp; Solutions</h1>" +
    "<p>" + escapeHtml(course.seo.description) + "</p>" +
    '<section class="stats" aria-label="Material counts">' +
    '<div class="card"><strong>' + course.counts.notes + "</strong><div>Notes</div></div>" +
    '<div class="card"><strong>' + course.counts.pyqs + "</strong><div>PYQs</div></div>" +
    '<div class="card"><strong>' + course.counts.solutions + "</strong><div>Solutions</div></div>" +
    (course.locked ? '<div class="card"><strong>' + escapeHtml(course.priceFormatted) + "</strong><div>Semester Pass</div></div>" : "") +
    "</section>" +
    (course.locked ? '<section class="card"><h2>Unlock full access in 3 steps</h2><ol>' +
    stepsHtml +
    '</ol><a class="cta" href="' + escapeHtml(unlockUrl) + '">Unlock ' +
    escapeHtml(course.title) + " (" + escapeHtml(course.priceFormatted) + ")</a></section>" : "") +
    '<section><h2>Included Materials (' + course.counts.total + ')</h2><ul class="items">' +
    itemsHtml +
    "</ul></section>";

  res
    .type("text/html; charset=utf-8")
    .set("Cache-Control", "no-store")
    .send(
      renderHtmlShell({
        title: course.seo.title,
        description: course.seo.description,
        canonical: canonical,
        schema: schema,
        bodyHtml: bodyHtml,
      })
    );
});

module.exports = router;
