const test = require("node:test");
const assert = require("node:assert/strict");

const ranking = require("../src/services/searchRanking");

test("normalizeSearchText folds case, punctuation, and extra whitespace", function () {
  assert.equal(ranking.normalizeSearchText("  Binary-Tree!! "), "binary tree");
  assert.equal(ranking.normalizeSearchText("OS_Notes"), "os notes");
});

test("scoreSearchHit ranks exact title above prefix, contains, path, and fuzzy", function () {
  const query = "binary tree";
  const exact = ranking.scoreSearchHit(query, { title: "Binary Tree", kind: "file", path: "Year 3/DSA/Binary Tree" });
  const folderExact = ranking.scoreSearchHit(query, { title: "Binary Tree", kind: "folder", path: "Year 3/Binary Tree" });
  const prefix = ranking.scoreSearchHit(query, { title: "Binary Tree Notes", kind: "file", path: "Year 3/DSA/Binary Tree Notes" });
  const contains = ranking.scoreSearchHit(query, { title: "Intro to Binary Tree", kind: "file", path: "Year 3/DSA/Intro to Binary Tree" });
  const pathHit = ranking.scoreSearchHit(query, { title: "Lecture 4.pdf", kind: "file", path: "Year 3/DSA/Binary Tree/Lecture 4.pdf" });
  const fuzzy = ranking.scoreSearchHit("binry tree", { title: "Binary Tree", kind: "file", path: "Year 3/DSA/Binary Tree" });
  const unrelated = ranking.scoreSearchHit(query, { title: "Thermodynamics", kind: "file", path: "Year 3/ME/Thermodynamics" });

  assert.ok(exact.rank > prefix.rank);
  assert.ok(prefix.rank > contains.rank);
  assert.ok(contains.rank > pathHit.rank);
  assert.ok(pathHit.rank > 0);
  assert.ok(fuzzy.rank > 0);
  assert.equal(unrelated.rank, 0);
  assert.ok(folderExact.rank >= exact.rank);
});

test("sortSearchHits orders by rank then shorter title", function () {
  const hits = [
    { title: "OS Lab Manual", kind: "file", path: "Year 3/OS Lab Manual" },
    { title: "OS", kind: "folder", path: "Year 3/OS" },
    { title: "Operating Systems", kind: "file", path: "Year 3/Operating Systems" },
  ];
  const sorted = ranking.sortSearchHits(hits, "os").map(function (hit) {
    return hit.title;
  });
  assert.deepEqual(sorted, ["OS", "OS Lab Manual", "Operating Systems"]);
});

test("dedupeSearchHits drops a legacy note when the Drive file is already present", function () {
  const driveHits = [
    { source: "drive", nodeId: "drive-os", title: "OS.pdf", kind: "file" },
  ];
  const noteHits = [
    { source: "note", id: 9, title: "OS.pdf", driveFileId: "drive-os" },
    { source: "note", id: 10, title: "Handwritten OS", driveFileId: null },
  ];
  const merged = ranking.dedupeSearchHits(driveHits, noteHits);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].source, "drive");
  assert.equal(merged[1].id, 10);
});

test("academicYearFromPath only maps reliable Year 1 / Year 2 folder names", function () {
  assert.equal(ranking.academicYearFromPath("Year 1/Physics/Notes.pdf", "file"), 1);
  assert.equal(ranking.academicYearFromPath("Year 2", "folder", "Year 2"), 2);
  assert.equal(ranking.academicYearFromPath("Year 3/Physics/Notes.pdf", "file"), null);
  assert.equal(ranking.academicYearFromPath("Random/Year1Notes.pdf", "file"), null);
});

test("applySearchFilters keeps kind, year, and file-type combinations", function () {
  const hits = [
    { title: "Physics", kind: "folder", path: "Year 1/Physics", mimeType: "application/vnd.google-apps.folder" },
    { title: "Notes.pdf", kind: "file", path: "Year 1/Physics/Notes.pdf", mimeType: "application/pdf" },
    { title: "Misc.pdf", kind: "file", path: "Library/Misc.pdf", mimeType: "application/pdf" },
  ];
  const folders = ranking.applySearchFilters(hits, { kind: "folder" });
  assert.equal(folders.length, 1);
  assert.equal(folders[0].title, "Physics");

  const year1 = ranking.applySearchFilters(hits, { year: "1" });
  assert.equal(year1.length, 2);

  const pdfs = ranking.applySearchFilters(hits, { type: "pdf" });
  assert.equal(pdfs.length, 2);
  pdfs.forEach(function (hit) {
    assert.equal(hit.kind, "file");
  });
});

test("paginateSearchHits slices after ranking and reports totals", function () {
  const hits = [];
  for (let i = 0; i < 5; i++) {
    hits.push({ title: "Item " + i });
  }
  const page1 = ranking.paginateSearchHits(hits, { page: 1, limit: 2 });
  assert.equal(page1.items.length, 2);
  assert.equal(page1.total, 5);
  assert.equal(page1.totalPages, 3);
  assert.equal(page1.items[0].title, "Item 0");
  const page3 = ranking.paginateSearchHits(hits, { page: 3, limit: 2 });
  assert.equal(page3.items.length, 1);
  assert.equal(page3.items[0].title, "Item 4");
});

test("suggestCorrection offers a close library title without rewriting short queries", function () {
  assert.equal(
    ranking.suggestCorrection("binry tree", ["Binary Tree", "Operating Systems"]),
    "Binary Tree"
  );
  assert.equal(ranking.suggestCorrection("os", ["Operating Systems"]), null);
  assert.equal(ranking.suggestCorrection("binary tree", ["Binary Tree"]), null);
  assert.equal(ranking.suggestCorrection("quantum homework", ["Binary Tree"]), null);
});

test("fuzzy ranking stays bounded for long titles and queries", function () {
  const longTitle = "Binary Tree " + "notes ".repeat(80);
  const longQuery = "binry tree " + "notes ".repeat(40);
  const scored = ranking.scoreSearchHit(longQuery, {
    title: longTitle,
    kind: "file",
    path: "Year 3/DSA/" + longTitle,
  });
  assert.equal(typeof scored.rank, "number");
  assert.ok(scored.rank >= 0);
});

test("applySearchFilters type=pdf keeps PDFs and drops folders", function () {
  const hits = [
    { title: "Physics", kind: "folder", path: "Year 1/Physics", mimeType: "application/vnd.google-apps.folder" },
    { title: "Notes.pdf", kind: "file", path: "Year 1/Physics/Notes.pdf", mimeType: "application/pdf" },
    { title: "Lecture", kind: "file", path: "Year 3/Lecture", mimeType: "application/vnd.google-apps.document" },
  ];
  const pdfs = ranking.applySearchFilters(hits, { type: "pdf" });
  assert.equal(pdfs.length, 1);
  assert.equal(pdfs[0].title, "Notes.pdf");
});
