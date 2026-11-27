const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_for_public_seo_courses_0123456789";
process.env.CSRF_SECRET = "test_csrf_secret_for_public_seo_courses_0123456789";
process.env.OTP_SECRET = "test_otp_secret_for_public_seo_courses_0123456789";

const app = require("../src/app");
const publicCourseService = require("../src/services/publicCourseService");
const courseAnalyticsModel = require("../src/models/courseAnalyticsModel");
const userModel = require("../src/models/userModel");
const tokenService = require("../src/services/tokenService");

const approvedAt = "2026-10-18T12:00:00.000Z";
const itemKey = "00000000-0000-4000-8000-000000000001";
const publications = [
  {
    slug: "elements-of-aiml",
    course_title: "Elements of AIML",
    folder_name: "Elements of AIML",
    depth: 2,
    parent_name: "Year 1",
    approved_at: approvedAt,
    file_type: "PDF",
  },
  {
    slug: "operating-systems",
    course_title: "Operating Systems",
    folder_name: "Operating Systems",
    depth: 2,
    parent_name: "Year 3",
    approved_at: approvedAt,
    file_type: "PDF",
  },
];
const catalog = [
  {
    ...publications[0],
    item_key: itemKey,
    drive_id: "SECRET_DRIVE_ID_FILE_1",
    item_title: "Unit 1 Search Algorithms Notes",
    file_name: "notes.pdf",
    file_path: "Year 1/Elements of AIML/notes.pdf",
    category: "notes",
  },
  {
    ...publications[0],
    item_key: "key-2",
    item_title: "2024 End-Sem PYQ Solutions",
    file_path: "Year 1/Elements of AIML/PYQs/solutions.pdf",
    category: "pyq_solution",
  },
  {
    ...publications[0],
    item_key: "key-3",
    item_title: "2023 Mid-Sem Question Paper",
    file_path: "Year 1/Elements of AIML/PYQs/paper.pdf",
    category: "pyqs",
  },
  {
    ...publications[1],
    item_key: "key-4",
    item_title: "Operating Systems Unit 1 Notes",
    file_path: "Year 3/Operating Systems/notes.pdf",
    category: "notes",
  },
];

function fetchPublications(slug, key) {
  return catalog.filter(function (row) {
    return (!slug || row.slug === slug) && (!key || row.item_key === key);
  });
}

test("Material classification treats underscore-separated terms as words", function () {
  assert.equal(publicCourseService.classifyMaterial("2024_PYQ_Solutions.pdf").category, "pyq_solution");
});

function startServer() {
  return new Promise(function (resolve) {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", function () {
      resolve({ server: server, port: server.address().port });
    });
  });
}

function request(port, method, path, opts) {
  const options = opts || {};
  return new Promise(function (resolve, reject) {
    const body = options.body ? JSON.stringify(options.body) : null;
    const headers = Object.assign({}, options.headers || {});
    if (body) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }
    const req = http.request(
      { host: "127.0.0.1", port: port, method: method, path: path, headers: headers },
      function (res) {
        let raw = "";
        res.on("data", function (chunk) {
          raw += chunk;
        });
        res.on("end", function () {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (err) {
            json = null;
          }
          resolve({ status: res.statusCode, headers: res.headers, text: raw, json: json });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getCsrfContext(port) {
  const res = await request(port, "GET", "/api/csrf-token");
  const cookie = (res.headers["set-cookie"] || [])
    .map(function (c) {
      return c.split(";")[0];
    })
    .join("; ");
  return {
    token: res.json.data.csrfToken,
    cookie: cookie,
  };
}

test("Public SEO courses API exposes metadata only, never Drive IDs, URLs, or PDF bytes", async function () {
  const origFetch = publicCourseService._fetchPublications;
  publicCourseService._fetchPublications = fetchPublications;

  const { server, port } = await startServer();
  try {
    const listRes = await request(port, "GET", "/api/public/courses");
    assert.equal(listRes.status, 200);
    assert.equal(listRes.json.success, true);
    assert.equal(listRes.json.data.courses.length, 2);

    const rawListText = listRes.text;
    assert.equal(rawListText.includes("SECRET_DRIVE_ID"), false);
    assert.equal(rawListText.includes("SECRET_ROOT_ID"), false);
    assert.equal(rawListText.includes("drive_id"), false);
    assert.equal(rawListText.includes("/preview"), false);
    assert.equal(rawListText.includes("/download"), false);
    assert.equal(listRes.headers["cache-control"], "no-store");

    const aiml = listRes.json.data.courses.find(function (c) {
      return c.slug === "elements-of-aiml";
    });
    assert.ok(aiml);
    assert.equal(aiml.yearNumber, 1);
    assert.equal(aiml.locked, true);
    assert.equal(aiml.counts.notes, 1);
    assert.equal(aiml.counts.pyqs, 2);
    assert.equal(aiml.counts.solutions, 1);
    assert.equal(aiml.counts.total, 3);

    const detailRes = await request(port, "GET", "/api/public/courses/elements-of-aiml");
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.text.includes("SECRET_DRIVE_ID"), false);
    assert.equal(detailRes.text.includes("drive_id"), false);
    const course = detailRes.json.data.course;
    assert.equal(course.seo.canonicalUrl, "https://www.studykarle.me/courses/elements-of-aiml");
    assert.equal(course.items.length, 3);
    course.items.forEach(function (item) {
      assert.equal(item.locked, true);
      assert.equal("drive_id" in item, false);
      assert.equal("url" in item, false);
      assert.equal("previewUrl" in item, false);
    });

    // Locked previews must never bypass auth/payment on actual Drive endpoints.
    const bypassPreview = await request(port, "GET", "/api/drive/files/SECRET_DRIVE_ID_FILE_1/preview");
    assert.equal(bypassPreview.status, 401);
    const bypassDownload = await request(port, "GET", "/api/drive/files/SECRET_DRIVE_ID_FILE_1/download");
    assert.equal(bypassDownload.status, 401);
  } finally {
    server.close();
    publicCourseService._fetchPublications = origFetch;
  }
});

test("SSR SEO course pages and dynamic sitemap render valid canonicals, JSON-LD, and 404 noindex", async function () {
  const origFetch = publicCourseService._fetchPublications;
  publicCourseService._fetchPublications = fetchPublications;

  const { server, port } = await startServer();
  try {
    const sitemapRes = await request(port, "GET", "/seo/sitemap.xml");
    assert.equal(sitemapRes.status, 200);
    assert.match(sitemapRes.headers["content-type"], /application\/xml/);
    assert.ok(sitemapRes.text.includes("<loc>https://www.studykarle.me/courses</loc>"));
    assert.ok(
      sitemapRes.text.includes(
        "<loc>https://www.studykarle.me/courses/elements-of-aiml</loc><lastmod>2026-10-18</lastmod>"
      )
    );

    const catalogRes = await request(port, "GET", "/seo/courses");
    assert.equal(catalogRes.status, 200);
    assert.ok(catalogRes.text.includes('<link rel="canonical" href="https://www.studykarle.me/courses" />'));
    assert.ok(catalogRes.text.includes("Elements of AIML"));
    assert.equal(catalogRes.text.includes("SECRET_DRIVE_ID"), false);

    const courseRes = await request(port, "GET", "/seo/courses/elements-of-aiml");
    assert.equal(courseRes.status, 200);
    assert.ok(
      courseRes.text.includes(
        '<link rel="canonical" href="https://www.studykarle.me/courses/elements-of-aiml" />'
      )
    );
    assert.ok(courseRes.text.includes('content="index, follow, max-image-preview:large"'));
    assert.equal(courseRes.text.includes("SECRET_DRIVE_ID"), false);

    const ldMatch = courseRes.text.match(
      /<script id="studykarle-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/
    );
    assert.ok(ldMatch, "JSON-LD script must be present");
    const parsed = JSON.parse(ldMatch[1]);
    const types = parsed["@graph"].map(function (n) {
      return n["@type"];
    });
    assert.deepEqual(types, ["Organization", "WebSite", "BreadcrumbList", "Course", "ItemList"]);

    const missingRes = await request(port, "GET", "/seo/courses/does-not-exist-xyz");
    assert.equal(missingRes.status, 404);
    assert.ok(missingRes.text.includes('content="noindex, nofollow"'));
  } finally {
    server.close();
    publicCourseService._fetchPublications = origFetch;
  }
});

test("Course visit & unlock CTA tracking records hashed visitor events and admin analytics requires admin role", async function () {
  const origFetch = publicCourseService._fetchPublications;
  const origRecord = courseAnalyticsModel.record;
  const origSummarize = courseAnalyticsModel.summarizeByCourse;
  const origFindById = userModel.findById;

  const recorded = [];
  publicCourseService._fetchPublications = fetchPublications;

  courseAnalyticsModel.record = async function (entry) {
    recorded.push(entry);
    return Object.assign({ id: recorded.length }, entry);
  };
  courseAnalyticsModel.summarizeByCourse = async function () {
    return [
      { course_slug: "elements-of-aiml", event_type: "course_visit", total: "10" },
      { course_slug: "elements-of-aiml", event_type: "unlock_cta_click", total: "4" },
      { course_slug: "elements-of-aiml", event_type: "unlock_checkout", total: "2" },
      { course_slug: "elements-of-aiml", event_type: "unlock_approved", total: "1" },
    ];
  };
  userModel.findById = async function (id) {
    if (id === 1) return { id: 1, name: "Admin", email: "admin@test.local", role: "admin", token_version: 0 };
    if (id === 2) return { id: 2, name: "Student", email: "student@test.local", role: "student", token_version: 0 };
    return null;
  };

  const { server, port } = await startServer();
  try {
    const csrf = await getCsrfContext(port);

    const visitRes = await request(port, "POST", "/api/public/courses/elements-of-aiml/events", {
      headers: {
        Cookie: csrf.cookie,
        "X-CSRF-Token": csrf.token,
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "TestBrowser/1.0",
      },
      body: { eventType: "course_visit", referrer: "https://www.google.com/search?q=aiml+pyq" },
    });
    assert.equal(visitRes.status, 200);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].event_type, "course_visit");
    assert.equal(recorded[0].course_slug, "elements-of-aiml");
    assert.equal(recorded[0].referrer_host, "www.google.com");
    assert.equal(recorded[0].visitor_hash.length, 64);
    assert.equal(recorded[0].visitor_hash.includes("127.0.0.1"), false);

    // Reject forged server-only event types from public endpoint.
    const forgedRes = await request(port, "POST", "/api/public/courses/elements-of-aiml/events", {
      headers: {
        Cookie: csrf.cookie,
        "X-CSRF-Token": csrf.token,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: { eventType: "unlock_approved" },
    });
    assert.equal(forgedRes.status, 400);

    // Admin analytics endpoint must reject unauthenticated (401) and students (403).
    const unauthAdmin = await request(port, "GET", "/api/admin/course-analytics");
    assert.equal(unauthAdmin.status, 401);

    const materialPath = "/api/public/courses/elements-of-aiml/items/" + itemKey;
    assert.equal((await request(port, "GET", materialPath)).status, 401);

    const studentToken = tokenService.signToken(2, 0);
    const studentHeaders = { Cookie: "studykarle_token=" + studentToken };
    const resolved = await request(port, "GET", materialPath, { headers: studentHeaders });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.json.data.driveId, "SECRET_DRIVE_ID_FILE_1");
    const missing = await request(port, "GET", materialPath.replace("elements-of-aiml", "unpublished"), { headers: studentHeaders });
    assert.equal(missing.status, 404);
    const forbiddenPublication = await request(port, "GET", "/api/admin/course-publications", { headers: studentHeaders });
    assert.equal(forbiddenPublication.status, 403);

    const studentAdmin = await request(port, "GET", "/api/admin/course-analytics", {
      headers: { Cookie: "studykarle_token=" + studentToken },
    });
    assert.equal(studentAdmin.status, 403);

    const adminToken = tokenService.signToken(1, 0);
    const okAdmin = await request(port, "GET", "/api/admin/course-analytics", {
      headers: { Cookie: "studykarle_token=" + adminToken },
    });
    assert.equal(okAdmin.status, 200);
    assert.equal(okAdmin.json.data.totals.visits, 10);
    assert.equal(okAdmin.json.data.totals.approvals, 1);
    assert.equal(okAdmin.json.data.totals.visitToApprovalRate, 10);
  } finally {
    server.close();
    publicCourseService._fetchPublications = origFetch;
    courseAnalyticsModel.record = origRecord;
    courseAnalyticsModel.summarizeByCourse = origSummarize;
    userModel.findById = origFindById;
  }
});
