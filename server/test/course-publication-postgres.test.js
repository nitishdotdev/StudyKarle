const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const test = require("node:test");

if (process.env.DATABASE_URL || !/^studykarle_course_test_[a-z0-9_]+$/i.test(process.env.DB_NAME || "")) {
  throw new Error("Run this integration test against a dedicated studykarle_course_test_ database");
}

const db = require("../src/config/db");
const courses = require("../src/services/publicCourseService");

test("PostgreSQL course publication preserves identity and exposes only approved metadata", async function () {
  const prefix = "course-test-" + randomUUID();
  const node = function (suffix, parent, depth, name, path, kind = "folder") {
    return {
      drive_id: prefix + "-" + suffix,
      parent_drive_id: prefix + "-" + parent,
      depth,
      name,
      path,
      kind,
      mime_type: kind === "folder" ? "application/vnd.google-apps.folder" : "application/pdf",
    };
  };
  const fixtures = [
    node("year1", "root", 1, "Year 1", "Year 1"),
    node("year3", "root", 1, "Year 3", "Year 3"),
    node("alpha", "year1", 2, "Data Science", "Year 1/Data Science"),
    node("beta", "year1", 2, "Data-Science", "Year 1/Data-Science"),
    node("gamma", "year3", 2, "Data Science", "Year 3/Data Science"),
    node("approved", "alpha", 3, "2024_PYQ_Solutions.pdf", "Year 1/Data Science/2024_PYQ_Solutions.pdf", "file"),
    node("private", "alpha", 3, "Private notes.pdf", "Year 1/Data Science/Private notes.pdf", "file"),
    node("standalone", "year1", 2, "Standalone.pdf", "Year 1/Standalone.pdf", "file"),
  ];
  let ids;
  try {
    const inserted = await db("drive_nodes").insert(fixtures).returning(["id", "drive_id"]);
    ids = Object.fromEntries(inserted.map((row) => [row.drive_id.slice(prefix.length + 1), row.id]));
    const candidates = await courses.listManageableCourses();
    const ownCandidates = candidates.filter((folder) => Object.values(ids).includes(folder.id));
    assert.deepEqual(new Set(ownCandidates.map((folder) => folder.id)), new Set([ids.alpha, ids.beta, ids.gamma]));
    assert.deepEqual(await courses.listPublicCourses(), []);

    await assert.rejects(courses.savePublication(ids.alpha, true, [ids.standalone]), /must belong/);
    const alpha = await courses.savePublication(ids.alpha, true, [ids.approved]);
    const beta = await courses.savePublication(ids.beta, true, []);
    const gamma = await courses.savePublication(ids.gamma, true, []);
    assert.equal(new Set([alpha.slug, beta.slug, gamma.slug]).size, 3);

    await db("drive_nodes").where("id", ids.alpha).update({ name: "Renamed subject" });
    await db("drive_nodes").where("id", ids.approved).update({ name: "Unreviewed new title.pdf" });
    const before = await courses.getPublicCourseBySlug(alpha.slug);
    assert.equal(before.title, "Data Science");
    assert.deepEqual(before.items.map((item) => [item.title, item.category, item.locked]), [
      ["2024 PYQ Solutions", "pyq_solution", true],
    ]);
    assert.doesNotMatch(JSON.stringify(before), /drive_id|Private notes|Unreviewed new title/);

    const key = before.items[0].itemKey;
    await db("drive_nodes").where("id", ids.approved).update({ parent_drive_id: prefix + "-beta" });
    assert.equal(await courses.resolvePublishedItem(alpha.slug, key), null);
    await db("drive_nodes").where("id", ids.approved).update({ parent_drive_id: prefix + "-alpha" });
    assert.equal(await courses.resolvePublishedItem(alpha.slug, key), prefix + "-approved");

    await courses.savePublication(ids.alpha, false, [ids.approved]);
    assert.equal(await courses.getPublicCourseBySlug(alpha.slug), null);
    assert.equal(await courses.resolvePublishedItem(alpha.slug, key), null);
    assert.ok(!(await courses.listPublicCourses()).some((course) => course.slug === alpha.slug));
    const republished = await courses.savePublication(ids.alpha, true, [ids.approved]);
    assert.equal(republished.slug, alpha.slug);
    assert.equal((await courses.getPublicCourseBySlug(alpha.slug)).items[0].itemKey, key);
  } finally {
    if (ids) await db("drive_nodes").whereIn("id", Object.values(ids)).del();
    await db.destroy();
  }
});
