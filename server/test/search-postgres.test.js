const assert = require("node:assert/strict");
const test = require("node:test");

if (process.env.DATABASE_URL || !/^studykarle_course_test_[a-z0-9_]+$/i.test(process.env.DB_NAME || "")) {
  throw new Error("Run against a dedicated studykarle_course_test_ database");
}

const db = require("../src/config/db");
const { searchLibrary } = require("../src/services/searchService");

test("Year 4 PDF results survive two batches of nonmatching candidates", async () => {
  const prefix = "search-fixture-" + require("node:crypto").randomUUID();
  const query = prefix.slice(-12);
  const student = { id: 2147483646, role: "student" };
  const folder = (id, name) => ({
    drive_id: prefix + id, parent_drive_id: prefix + "-root", depth: 1,
    name, path: name, kind: "folder", mime_type: "application/vnd.google-apps.folder",
  });
  const files = Array.from({length: 410}, (_, index) => {
    const earlierYear = index < 205;
    const name = "A " + String(index).padStart(3, "0") + " " + query + (earlierYear ? ".pdf" : ".txt");
    return {
      drive_id: prefix + index, parent_drive_id: prefix + (earlierYear ? "-year2" : "-year4"),
      depth: 2, name, path: (earlierYear ? "Year 2/" : "Fourth Year/") + name,
      kind: "file", mime_type: earlierYear ? "application/pdf" : "text/plain",
    };
  });
  for (let i = 0; i < 4; i++) {
    const name = "Z Year Four " + i + " " + query + ".pdf";
    files.push({
      drive_id: prefix + "-match-" + i, parent_drive_id: prefix + "-year4",
      depth: 2, name, path: "Fourth Year/" + name, kind: "file", mime_type: "application/pdf",
    });
  }

  try {
    await db.batchInsert("drive_nodes", [
      folder("-year2", "Year 2"), folder("-year4", "Fourth Year"), ...files,
    ], 100);
    const queries = [];
    const record = ({sql}) => queries.push(sql);
    db.on("query", record);
    try {
      const { items, meta } = await searchLibrary(student, query, {year: "4", type: "pdf", page: 2, limit: 2});
      assert.equal(meta.total, 4);
      assert.equal(items.length, 2);
      assert.ok(items.every((item) => item.academicYear === 4 && item.canPreview && !item.protected));
      assert.ok(items.every((item) => item.ancestors.length === 1 && item.ancestors[0].name === "Fourth Year"));
      assert.equal(queries.filter((sql) => /"semester_access"/.test(sql)).length, 1);
      assert.equal(queries.filter((sql) => /"payment_requests"/.test(sql)).length, 1);
      assert.equal(queries.filter((sql) => /"drive_id" in/.test(sql)).length, 2);
    } finally {
      db.off("query", record);
    }
  } finally {
    await db("drive_nodes").where("drive_id", "like", prefix + "%").del();
    await db.destroy();
  }
});
