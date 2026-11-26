const crypto = require("crypto");
const db = require("../config/db");
const yearScope = require("./yearScopeService");
const paymentConfig = require("../config/paymentConfig");

const SITE_URL = "https://www.studykarle.me";
const CACHE_TTL_MS = 60 * 1000;

let catalogCache = {
  expiresAt: 0,
  courses: null,
};

function invalidateCache() {
  catalogCache = { expiresAt: 0, courses: null };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function stripExtension(name) {
  return String(name || "")
    .replace(/\.(pdf|docx?|pptx?|xlsx?|txt|png|jpe?g|webp)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectFileType(name, mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  const lower = String(name || "").toLowerCase();
  if (mime.includes("pdf") || lower.endsWith(".pdf")) return "PDF";
  if (mime.includes("presentation") || /\.(ppt|pptx)$/.test(lower)) return "PPT";
  if (mime.includes("word") || /\.(doc|docx)$/.test(lower)) return "DOC";
  if (mime.includes("image") || /\.(png|jpe?g|webp)$/.test(lower)) return "IMG";
  return "FILE";
}

function classifyMaterial(name, relativeFolder) {
  const combined = (String(relativeFolder || "") + " " + String(name || "")).toLowerCase();
  const isPyq =
    /\b(pyq|pyqs|previous[\s_-]*year|mid[\s_-]*sem|end[\s_-]*sem|question[\s_-]*paper|exam[\s_-]*paper|qp|sessional|put|ct[\s_-]*\d)\b/i.test(
      combined
    );
  const isSolution =
    /\b(solution|solutions|solved|soln|answer[\s_-]*key|answers)\b/i.test(combined);

  let category = "notes";
  if (isPyq && isSolution) category = "pyq_solution";
  else if (isPyq) category = "pyqs";
  else if (isSolution) category = "solutions";

  return {
    category: category,
    isPyq: isPyq,
    isSolution: isSolution,
    isNote: !isPyq && !isSolution,
  };
}

function extractYearNumber(segment) {
  const direct = yearScope.classifyYearFolder(segment);
  if (direct !== null) return direct;
  const n = yearScope.normalizeName(segment);
  if (/^(year\s*3|3rd\s*year|third\s*year|y3)$/.test(n)) return 3;
  if (/^(year\s*4|4th\s*year|fourth\s*year|y4)$/.test(n)) return 4;
  return null;
}

function formatYearLabel(yearNumber) {
  if (!yearNumber) return "Engineering";
  return "Year " + yearNumber;
}

function opaqueItemKey(courseSlug, index, title) {
  return crypto
    .createHash("sha256")
    .update(courseSlug + ":" + index + ":" + title)
    .digest("hex")
    .slice(0, 12);
}

/**
 * Derive public course catalog strictly from `drive_nodes` rows.
 * Returned objects NEVER contain `drive_id`, `parent_drive_id`, internal URLs,
 * or raw file bytes.
 */
function buildCatalogFromNodes(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const courseMap = new Map();

  list.forEach(function (node) {
    if (!node || !node.path) return;
    const parts = String(node.path).split("/").filter(Boolean);
    if (parts.length === 0) return;

    const firstYear = extractYearNumber(parts[0]);
    let yearNumber = firstYear;
    let courseName = null;
    let courseFolderParts = null;

    if (firstYear !== null) {
      if (parts.length < 2) return;
      courseName = parts[1];
      courseFolderParts = parts.slice(0, 2);
    } else {
      courseName = parts[0];
      courseFolderParts = parts.slice(0, 1);
    }

    const baseSlug = slugify(courseName);
    if (!baseSlug) return;

    const groupKey = (yearNumber || 0) + "::" + baseSlug;
    if (!courseMap.has(groupKey)) {
      courseMap.set(groupKey, {
        baseSlug: baseSlug,
        title: courseName.trim(),
        yearNumber: yearNumber,
        yearLabel: formatYearLabel(yearNumber),
        locked: yearNumber === 1 || yearNumber === 2,
        notesCount: 0,
        solutionsCount: 0,
        pyqsCount: 0,
        totalCount: 0,
        updatedAt: null,
        items: [],
      });
    }

    const course = courseMap.get(groupKey);
    const modifiedAt = node.modified_time || node.created_time || null;
    if (
      modifiedAt &&
      (!course.updatedAt || new Date(modifiedAt).getTime() > new Date(course.updatedAt).getTime())
    ) {
      course.updatedAt = new Date(modifiedAt).toISOString();
    }

    if (node.kind !== "file") return;

    const relativeParts = parts.slice(courseFolderParts.length);
    const relativeFolder =
      relativeParts.length > 1 ? relativeParts.slice(0, -1).join(" / ") : null;
    const displayTitle = stripExtension(node.name) || node.name;
    const cls = classifyMaterial(node.name, relativeFolder);
    const isProtected = yearScope.isProtectedNode({
      kind: "file",
      name: node.name,
      path: node.path,
    });

    if (cls.isPyq) course.pyqsCount += 1;
    if (cls.isSolution) course.solutionsCount += 1;
    if (cls.isNote) course.notesCount += 1;
    course.totalCount += 1;
    if (isProtected) course.locked = true;

    course.items.push({
      title: displayTitle,
      category: cls.category,
      isPyq: cls.isPyq,
      isSolution: cls.isSolution,
      unitLabel: relativeFolder,
      fileType: detectFileType(node.name, node.mime_type),
      locked: isProtected,
      updatedAt: modifiedAt ? new Date(modifiedAt).toISOString() : null,
    });
  });

  // Resolve duplicate slugs across years cleanly (e.g., append -year-2 only on collision).
  const slugCounts = new Map();
  courseMap.forEach(function (course) {
    slugCounts.set(course.baseSlug, (slugCounts.get(course.baseSlug) || 0) + 1);
  });

  const cfg = paymentConfig.getPaymentConfig();
  const courses = [];

  courseMap.forEach(function (course) {
    if (course.totalCount === 0) return;

    const hasCollision = (slugCounts.get(course.baseSlug) || 0) > 1;
    const slug =
      hasCollision && course.yearNumber
        ? course.baseSlug + "-year-" + course.yearNumber
        : course.baseSlug;

    const sortedItems = course.items
      .slice()
      .sort(function (a, b) {
        const order = { pyq_solution: 0, pyqs: 1, solutions: 2, notes: 3 };
        const diff = (order[a.category] || 3) - (order[b.category] || 3);
        if (diff !== 0) return diff;
        return a.title.localeCompare(b.title);
      })
      .map(function (item, idx) {
        return {
          itemKey: opaqueItemKey(slug, idx, item.title),
          title: item.title,
          category: item.category,
          unitLabel: item.unitLabel,
          fileType: item.fileType,
          locked: !!item.locked,
          updatedAt: item.updatedAt,
        };
      });

    const canonicalUrl = SITE_URL + "/courses/" + slug;
    const seoTitle =
      course.title +
      " Notes, PYQ Solutions & Question Papers (" +
      course.yearLabel +
      ") | StudyKarle";
    const seoDescription =
      "Browse " +
      course.title +
      " (" +
      course.yearLabel +
      ") on StudyKarle: " +
      course.notesCount +
      " notes, " +
      course.pyqsCount +
      " previous-year question papers (PYQs), and " +
      course.solutionsCount +
      " solutions. Unlock full semester access for " +
      cfg.amountFormatted +
      ".";

    courses.push({
      slug: slug,
      title: course.title,
      yearNumber: course.yearNumber,
      yearLabel: course.yearLabel,
      locked: !!course.locked,
      priceRupees: cfg.amountRupees,
      priceFormatted: cfg.amountFormatted,
      counts: {
        notes: course.notesCount,
        solutions: course.solutionsCount,
        pyqs: course.pyqsCount,
        total: course.totalCount,
      },
      updatedAt: course.updatedAt,
      seo: {
        title: seoTitle,
        description: seoDescription,
        canonicalUrl: canonicalUrl,
        keywords: [
          course.title + " notes",
          course.title + " PYQ",
          course.title + " PYQ solutions",
          course.title + " previous year papers",
          "StudyKarle " + course.yearLabel,
        ],
      },
      items: sortedItems,
    });
  });

  courses.sort(function (a, b) {
    const ya = a.yearNumber || 99;
    const yb = b.yearNumber || 99;
    if (ya !== yb) return ya - yb;
    return a.title.localeCompare(b.title);
  });

  return courses;
}

function serializeCourseSummary(course) {
  return {
    slug: course.slug,
    title: course.title,
    yearNumber: course.yearNumber,
    yearLabel: course.yearLabel,
    locked: !!course.locked,
    priceRupees: course.priceRupees,
    priceFormatted: course.priceFormatted,
    counts: {
      notes: course.counts.notes,
      solutions: course.counts.solutions,
      pyqs: course.counts.pyqs,
      total: course.counts.total,
    },
    updatedAt: course.updatedAt,
    canonicalUrl: course.seo.canonicalUrl,
  };
}

function serializeCourseDetail(course) {
  return {
    slug: course.slug,
    title: course.title,
    yearNumber: course.yearNumber,
    yearLabel: course.yearLabel,
    locked: !!course.locked,
    priceRupees: course.priceRupees,
    priceFormatted: course.priceFormatted,
    counts: {
      notes: course.counts.notes,
      solutions: course.counts.solutions,
      pyqs: course.counts.pyqs,
      total: course.counts.total,
    },
    updatedAt: course.updatedAt,
    seo: {
      title: course.seo.title,
      description: course.seo.description,
      canonicalUrl: course.seo.canonicalUrl,
      keywords: course.seo.keywords.slice(),
    },
    unlockSteps: [
      "Create or sign in to your StudyKarle account",
      "Pay " + course.priceFormatted + " once via UPI for full semester access",
      "Upload your screenshot for quick admin approval and unlock all locked notes & PYQs",
    ],
    items: course.items.map(function (item) {
      return {
        itemKey: item.itemKey,
        title: item.title,
        category: item.category,
        unitLabel: item.unitLabel,
        fileType: item.fileType,
        locked: !!item.locked,
        updatedAt: item.updatedAt,
      };
    }),
  };
}

async function fetchDriveNodesForCatalog() {
  return db("drive_nodes")
    .select("name", "mime_type", "kind", "path", "created_time", "modified_time")
    .orderBy("path", "asc");
}

async function loadCatalog(options) {
  const bypassCache = options && options.bypassCache;
  if (!bypassCache && catalogCache.courses && Date.now() < catalogCache.expiresAt) {
    return catalogCache.courses;
  }
  const rows = await module.exports._fetchDriveNodesForCatalog();
  const courses = buildCatalogFromNodes(rows);
  catalogCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    courses: courses,
  };
  return courses;
}

async function listPublicCourses(options) {
  const courses = await loadCatalog(options);
  return courses.map(serializeCourseSummary);
}

async function getPublicCourseBySlug(slug, options) {
  const normalized = slugify(slug);
  if (!normalized) return null;
  const courses = await loadCatalog(options);
  const found = courses.find(function (course) {
    return course.slug === normalized;
  });
  return found ? serializeCourseDetail(found) : null;
}

module.exports = {
  SITE_URL,
  slugify,
  classifyMaterial,
  buildCatalogFromNodes,
  serializeCourseSummary,
  serializeCourseDetail,
  listPublicCourses,
  getPublicCourseBySlug,
  invalidateCache,
  _fetchDriveNodesForCatalog: fetchDriveNodesForCatalog,
};
