const crypto = require("crypto");
const db = require("../config/db");
const yearScope = require("./yearScopeService");
const ApiError = require("../utils/ApiError");
const paymentConfig = require("../config/paymentConfig");

const SITE_URL = "https://www.studykarle.me";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validSlug(value) {
  return typeof value === "string" && value.length <= 160 && SLUG_PATTERN.test(value);
}

function slugify(value) {
  // Collapse runs of separators into one dash, then remove boundary dashes.
  return String(value || "").slice(0, 120).toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 120)
    .replace(/^-|-$/g, "");
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
  const combined = (String(relativeFolder || "") + " " + String(name || "")).replace(/_/g, " ").toLowerCase();
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

function buildCatalogFromPublications(rows) {
  const bySlug = new Map();
  for (const row of rows) {
    const yearNumber = courseYear(row);
    if (yearNumber === undefined) continue;

    if (!bySlug.has(row.slug)) {
      bySlug.set(row.slug, {
        slug: row.slug,
        title: row.course_title,
        yearNumber,
        yearLabel: formatYearLabel(yearNumber),
        locked: false,
        notesCount: 0,
        solutionsCount: 0,
        pyqsCount: 0,
        totalCount: 0,
        updatedAt: new Date(row.approved_at).toISOString(),
        items: [],
      });
    }
    const course = bySlug.get(row.slug);
    if (!row.item_key) continue;

    const locked = yearScope.isProtectedNode({ kind: "file", name: row.file_name, path: row.file_path });
    if (row.category === "pyqs" || row.category === "pyq_solution") course.pyqsCount += 1;
    if (row.category === "solutions" || row.category === "pyq_solution") course.solutionsCount += 1;
    if (row.category === "notes") course.notesCount += 1;
    course.totalCount += 1;
    course.locked = course.locked || locked;
    course.items.push({
      itemKey: row.item_key,
      title: row.item_title,
      category: row.category,
      unitLabel: row.unit_label,
      fileType: row.file_type,
      locked,
      updatedAt: course.updatedAt,
    });
  }

  const cfg = paymentConfig.getPaymentConfig();
  const order = { pyq_solution: 0, pyqs: 1, solutions: 2, notes: 3 };
  const courses = [];
  for (const course of bySlug.values()) {
    const { slug } = course;
    const sortedItems = course.items.sort(function (a, b) {
      return order[a.category] - order[b.category] || a.title.localeCompare(b.title);
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
      " solutions." +
      (course.locked ? " Unlock full semester access for " + cfg.amountFormatted + "." : "");

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
  }

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
    unlockSteps: course.locked ? [
      "Create or sign in to your StudyKarle account",
      "Pay " + course.priceFormatted + " once via UPI for full semester access",
      "Upload your screenshot for quick admin approval and unlock all locked notes & PYQs",
    ] : [],
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

// Year folders themselves and files at the year root are never courses.
function courseYear(folder) {
  const year = extractYearNumber(folder.parent_name);
  if (folder.depth === 2 && year !== null) return year;
  if (folder.depth === 1 && extractYearNumber(folder.folder_name) === null) return null;
  return undefined;
}

function courseFolders(connection) {
  return connection("drive_nodes as folder")
    .leftJoin("drive_nodes as parent", "parent.drive_id", "folder.parent_drive_id")
    .select("folder.id", "folder.depth", "folder.name as folder_name", "parent.name as parent_name")
    .where("folder.kind", "folder")
    .whereIn("folder.depth", [1, 2]);
}

function descendants(connection, roots) {
  return connection.withRecursive("course_tree", ["folder_id", "node_id", "drive_id", "kind"], function (query) {
    query.from(roots.as("roots"))
      .select("roots.id", "roots.id", "roots.drive_id", "roots.kind")
      .union(function () {
        this.from("course_tree as tree")
          .join("drive_nodes as child", "child.parent_drive_id", "tree.drive_id")
          .where("tree.kind", "folder")
          .select("tree.folder_id", "child.id", "child.drive_id", "child.kind");
      });
  });
}

async function fetchPublications(slug, itemKey) {
  const roots = db("drive_nodes as root")
    .join("course_publications as published", "published.folder_id", "root.id")
    .where("published.published", true)
    .select("root.id", "root.drive_id", "root.kind");
  if (slug) roots.where("published.slug", slug);

  const items = db("course_publication_items as item")
    .join("course_tree as tree", function () {
      this.on("tree.folder_id", "item.folder_id").andOn("tree.node_id", "item.file_id");
    })
    .join("drive_nodes as file", "file.id", "item.file_id")
    .where("file.kind", "file")
    .select("item.*", "file.path as file_path", "file.name as file_name", "file.drive_id");
  if (itemKey) items.where("item.item_key", itemKey);

  return descendants(db, roots)
    .from(courseFolders(db).as("folder"))
    .join("course_publications as course", "course.folder_id", "folder.id")
    .leftJoin(items.as("item"), "item.folder_id", "course.folder_id")
    .where("course.published", true)
    .modify(function (query) {
      if (slug) query.where("course.slug", slug);
    })
    .select(
      "folder.depth", "folder.folder_name", "folder.parent_name",
      "course.slug", "course.title as course_title", "course.approved_at",
      "item.file_id", "item.item_key", "item.title as item_title", "item.unit_label",
      "item.category", "item.file_type", "item.file_path", "item.file_name", "item.drive_id"
    );
}

async function listPublicCourses() {
  const rows = await module.exports._fetchPublications();
  return buildCatalogFromPublications(rows).map(serializeCourseSummary);
}

async function getPublicCourseBySlug(slug) {
  if (!validSlug(slug)) return null;
  const rows = await module.exports._fetchPublications(slug);
  const [course] = buildCatalogFromPublications(rows);
  return course ? serializeCourseDetail(course) : null;
}

async function resolvePublishedItem(slug, itemKey) {
  if (!validSlug(slug) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(itemKey || "")) return null;
  const rows = await module.exports._fetchPublications(slug, itemKey);
  const item = rows.find(function (row) {
    return row.item_key === itemKey && courseYear(row) !== undefined;
  });
  return item ? item.drive_id : null;
}

async function listManageableCourses() {
  const folders = await courseFolders(db)
    .leftJoin("course_publications as publication", "publication.folder_id", "folder.id")
    .select("publication.slug", "publication.published", "folder.path")
    .orderBy("folder.path");
  return folders.filter(function (folder) {
    return courseYear(folder) !== undefined;
  });
}

async function manageableCourse(connection, folderId) {
  const folder = await courseFolders(connection).where("folder.id", folderId).select("folder.path").first();
  if (!folder || courseYear(folder) === undefined) return null;

  const roots = connection("drive_nodes").where("id", folderId).select("id", "drive_id", "kind");
  const files = await descendants(connection, roots)
    .from("course_tree as tree")
    .join("drive_nodes as file", "file.id", "tree.node_id")
    .leftJoin("course_publication_items as item", function () {
      this.on("item.file_id", "file.id").andOn("item.folder_id", "tree.folder_id");
    })
    .where("file.kind", "file")
    .select("file.id", "file.name", "file.path", "file.mime_type", "item.item_key")
    .orderBy("file.path");
  const publication = await connection("course_publications").where("folder_id", folderId).first();
  return { folder, files, publication };
}

async function savePublication(folderId, published, fileIds) {
  return db.transaction(async function (trx) {
    const locked = await trx("drive_nodes").where("id", folderId).forUpdate().first("id");
    if (!locked) return null;
    const course = await manageableCourse(trx, folderId);
    if (!course) return null;
    const filesById = new Map(course.files.map(function (file) { return [file.id, file]; }));
    if (fileIds.some(function (id) { return !filesById.has(id); })) {
      throw ApiError.badRequest("Every selected item must belong to this course");
    }

    const title = course.folder.folder_name;
    const slug = course.publication?.slug || (slugify(title) || "course") + "-" + crypto.randomUUID();
    const publication = { folder_id: folderId, slug, title, published, approved_at: new Date() };
    await trx("course_publications").insert(publication).onConflict("folder_id").merge();
    await trx("course_publication_items").where("folder_id", folderId).whereNotIn("file_id", fileIds).del();

    if (fileIds.length) {
      const items = fileIds.map(function (id) {
        const file = filesById.get(id);
        const relativePath = file.path.slice(course.folder.path.length + 1);
        const unitLabel = relativePath.split("/").slice(0, -1).join(" / ") || null;
        return {
          folder_id: folderId,
          file_id: id,
          item_key: file.item_key || crypto.randomUUID(),
          title: stripExtension(file.name) || file.name,
          unit_label: unitLabel,
          category: classifyMaterial(file.name, unitLabel).category,
          file_type: detectFileType(file.name, file.mime_type),
        };
      });
      await trx("course_publication_items").insert(items).onConflict(["folder_id", "file_id"]).merge();
    }
    return publication;
  });
}

module.exports = {
  SITE_URL,
  classifyMaterial,
  listPublicCourses,
  getPublicCourseBySlug,
  resolvePublishedItem,
  listManageableCourses,
  getManageableCourse: function (folderId) { return manageableCourse(db, folderId); },
  savePublication,
  _fetchPublications: fetchPublications,
};
