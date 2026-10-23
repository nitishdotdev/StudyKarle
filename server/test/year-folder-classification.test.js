// Unit tests for Year 1 / Year 2 folder classification.
// Classification must use folder ancestry, not the file name alone.

const test = require("node:test");
const assert = require("node:assert/strict");

const yearScope = require("../src/services/yearScopeService");

test("matches Year 1 folder name variations", function () {
  const names = [
    "Year 1",
    "year 1",
    "YEAR 1",
    "Year1",
    "Year-1",
    "Year_1",
    "1st Year",
    "1st year",
    "1st-Year",
    "First Year",
    "first year",
    "Y1",
    "y1",
  ];
  names.forEach(function (name) {
    assert.equal(
      yearScope.isYearOneOrTwoFolderName(name),
      true,
      "expected protected: " + name
    );
    assert.equal(yearScope.classifyYearFolder(name), 1, name);
  });
});

test("matches Year 2 folder name variations", function () {
  const names = [
    "Year 2",
    "year 2",
    "YEAR 2",
    "Year2",
    "Year-2",
    "Year_2",
    "2nd Year",
    "2nd year",
    "2nd-Year",
    "Second Year",
    "second year",
    "Y2",
    "y2",
  ];
  names.forEach(function (name) {
    assert.equal(
      yearScope.isYearOneOrTwoFolderName(name),
      true,
      "expected protected: " + name
    );
    assert.equal(yearScope.classifyYearFolder(name), 2, name);
  });
});

test("does not match Year 3, Year 4, or unrelated folders", function () {
  const names = [
    "Year 3",
    "Year 4",
    "Year 10",
    "Year 11",
    "Year 12",
    "Year 21",
    "3rd Year",
    "Third Year",
    "4th Year",
    "Physics",
    "Library",
    "Misc",
    "Y3",
    "Year",
    "1",
    "2",
    "Year 1 Assignment Bank",
    "Notes for Year 1 students",
  ];
  names.forEach(function (name) {
    assert.equal(
      yearScope.isYearOneOrTwoFolderName(name),
      false,
      "expected unprotected: " + name
    );
    assert.equal(yearScope.classifyYearFolder(name), null, name);
  });
});

test("protects descendants of Year 1 and Year 2 via ancestry", function () {
  assert.equal(
    yearScope.isProtectedByAncestry([
      { name: "Library" },
      { name: "Year 1" },
      { name: "Physics" },
    ]),
    true
  );
  assert.equal(
    yearScope.isProtectedByAncestry([
      { name: "Year 2" },
      { name: "Maths" },
      { name: "Unit 3" },
    ]),
    true
  );
  assert.equal(
    yearScope.isProtectedByAncestry([{ name: "1st Year" }]),
    true
  );
});

test("does not protect files merely named after Year 1 under unrelated folders", function () {
  assert.equal(
    yearScope.isProtectedNode({
      name: "Year 1 notes.pdf",
      kind: "file",
      path: "Misc/Year 1 notes.pdf",
      ancestors: [{ name: "Library" }, { name: "Misc" }],
    }),
    false
  );
});

test("protects a file under a Year 1 path even when the filename is generic", function () {
  assert.equal(
    yearScope.isProtectedNode({
      name: "kinematics.pdf",
      kind: "file",
      path: "Year 1/Physics/Unit 1/kinematics.pdf",
      ancestors: [
        { name: "Library" },
        { name: "Year 1" },
        { name: "Physics" },
        { name: "Unit 1" },
      ],
    }),
    true
  );
});

test("protects nested folders inside Year 2", function () {
  assert.equal(
    yearScope.isProtectedNode({
      name: "Question Papers",
      kind: "folder",
      path: "Year 2/Electrical/Question Papers",
      ancestors: [
        { name: "Library" },
        { name: "Year 2" },
        { name: "Electrical" },
      ],
    }),
    true
  );
});

test("does not protect Year 3 descendants", function () {
  assert.equal(
    yearScope.isProtectedNode({
      name: "networks.pdf",
      kind: "file",
      path: "Year 3/COA/networks.pdf",
      ancestors: [{ name: "Library" }, { name: "Year 3" }, { name: "COA" }],
    }),
    false
  );
});

test("treats the Year 1 folder itself as protected scope", function () {
  assert.equal(
    yearScope.isProtectedNode({
      name: "Year 1",
      kind: "folder",
      path: "Year 1",
      ancestors: [{ name: "Library" }],
    }),
    true
  );
});

test("classifies from a stored path when ancestors are missing", function () {
  assert.equal(
    yearScope.isProtectedNode({
      name: "worksheet.pdf",
      kind: "file",
      path: "Year 1/Maths-1/worksheet.pdf",
      ancestors: [],
    }),
    true
  );
  assert.equal(
    yearScope.isProtectedNode({
      name: "worksheet.pdf",
      kind: "file",
      path: "Misc/worksheet.pdf",
      ancestors: [],
    }),
    false
  );
});
