process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.COOKIE_NAME = "studykarle_token";
process.env.GOOGLE_DRIVE_FOLDER_ID = "root-folder";
process.env.PAYMENT_UPI_ID = "studykarle@oksbi";
process.env.PAYMENT_PAYEE_NAME = "StudyKarle";
process.env.PAYMENT_ACCESS_ENDS_AT = "2099-12-31T18:30:00.000Z";
process.env.SESSION_RATE_LIMIT_MAX = "1000";
process.env.AUTH_RATE_LIMIT_MAX = "1000";
process.env.AUTH_IP_RATE_LIMIT_MAX = "1000";
process.env.SENSITIVE_RATE_LIMIT_MAX = "1000";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const http = require("http");

function stubRel(rel, exports) {
  const full = require.resolve(path.join(__dirname, "..", "src", rel));
  require.cache[full] = { id: full, filename: full, loaded: true, exports };
}

const users = new Map();
let nextUserId = 1;
const driveNodes = new Map();
const notes = new Map();
const entitlements = new Map();
let nextEntitlementId = 1;

function resetState() {
  users.clear();
  nextUserId = 1;
  driveNodes.clear();
  notes.clear();
  entitlements.clear();
  nextEntitlementId = 1;
  seedLibrary();
}

function seedLibrary() {
  driveNodes.set("year1", {
    drive_id: "year1",
    parent_drive_id: "root-folder",
    name: "Year 1",
    mime_type: "application/vnd.google-apps.folder",
    kind: "folder",
    depth: 1,
    path: "Year 1",
    size_bytes: null,
    modified_time: null,
  });
  driveNodes.set("year1-physics", {
    drive_id: "year1-physics",
    parent_drive_id: "year1",
    name: "Physics",
    mime_type: "application/vnd.google-apps.folder",
    kind: "folder",
    depth: 2,
    path: "Year 1/Physics",
    size_bytes: null,
    modified_time: null,
  });
  driveNodes.set("binary-tree", {
    drive_id: "binary-tree",
    parent_drive_id: "year1-physics",
    name: "Binary Tree.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 3,
    path: "Year 1/Physics/Binary Tree.pdf",
    size_bytes: 2048,
    modified_time: "2026-01-01T00:00:00.000Z",
  });
  driveNodes.set("binary-tree-notes", {
    drive_id: "binary-tree-notes",
    parent_drive_id: "year1-physics",
    name: "Binary Tree Notes.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 3,
    path: "Year 1/Physics/Binary Tree Notes.pdf",
    size_bytes: 4096,
    modified_time: "2026-01-02T00:00:00.000Z",
  });
  driveNodes.set("year3", {
    drive_id: "year3",
    parent_drive_id: "root-folder",
    name: "Year 3",
    mime_type: "application/vnd.google-apps.folder",
    kind: "folder",
    depth: 1,
    path: "Year 3",
    size_bytes: null,
    modified_time: null,
  });
  driveNodes.set("os-folder", {
    drive_id: "os-folder",
    parent_drive_id: "year3",
    name: "Operating Systems",
    mime_type: "application/vnd.google-apps.folder",
    kind: "folder",
    depth: 2,
    path: "Year 3/Operating Systems",
    size_bytes: null,
    modified_time: null,
  });
  driveNodes.set("os-pdf", {
    drive_id: "os-pdf",
    parent_drive_id: "os-folder",
    name: "OS.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 3,
    path: "Year 3/Operating Systems/OS.pdf",
    size_bytes: 1024,
    modified_time: "2026-02-01T00:00:00.000Z",
  });
  driveNodes.set("thermo", {
    drive_id: "thermo",
    parent_drive_id: "year3",
    name: "Thermodynamics.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 2,
    path: "Year 3/Thermodynamics.pdf",
    size_bytes: 8000,
    modified_time: "2026-03-01T00:00:00.000Z",
  });
  driveNodes.set("gdoc", {
    drive_id: "gdoc",
    parent_drive_id: "year3",
    name: "Lecture notes",
    mime_type: "application/vnd.google-apps.document",
    kind: "file",
    depth: 2,
    path: "Year 3/Lecture notes",
    size_bytes: 512,
    modified_time: "2026-03-02T00:00:00.000Z",
  });

  notes.set(11, {
    id: 11,
    title: "Year 1 Physics Lab",
    description: "Lab manual",
    file_type: "pdf",
    page_count: 12,
    size_bytes: 1000,
    status: "published",
    subject_id: 1,
    subject_name: "Physics",
    year_label: "Year 1",
    drive_file_id: "missing-from-drive",
    created_at: new Date("2026-01-01"),
  });
  notes.set(22, {
    id: 22,
    title: "OS.pdf",
    description: "Duplicate of Drive OS.pdf",
    file_type: "pdf",
    page_count: 40,
    size_bytes: 1024,
    status: "published",
    subject_id: 2,
    subject_name: "Operating Systems",
    year_label: "Year 3",
    drive_file_id: "os-pdf",
    created_at: new Date("2026-02-01"),
  });
  notes.set(33, {
    id: 33,
    title: "Handwritten OS",
    description: "Legacy-only notes",
    file_type: "pdf",
    page_count: 8,
    size_bytes: 500,
    status: "published",
    subject_id: 2,
    subject_name: "Operating Systems",
    year_label: "Year 3",
    drive_file_id: null,
    created_at: new Date("2026-02-02"),
  });
  notes.set(44, {
    id: 44,
    title: "Draft OS",
    description: "unpublished",
    file_type: "pdf",
    page_count: 1,
    size_bytes: 10,
    status: "draft",
    subject_id: 2,
    subject_name: "Operating Systems",
    year_label: "Year 3",
    drive_file_id: null,
    created_at: new Date("2026-02-03"),
  });
}

function ancestorsOf(id) {
  const out = [];
  const seen = new Set();
  let current = driveNodes.get(id);
  while (current && current.parent_drive_id && !seen.has(current.parent_drive_id)) {
    seen.add(current.parent_drive_id);
    const parent = driveNodes.get(current.parent_drive_id);
    if (!parent) break;
    out.unshift({ nodeId: parent.drive_id, name: parent.name });
    current = parent;
  }
  return out;
}

const userModel = {
  async create(data) {
    const row = {
      id: nextUserId++,
      name: data.name,
      email: String(data.email).toLowerCase(),
      password_hash: data.passwordHash || null,
      role: data.role || "student",
      token_version: 0,
    };
    users.set(row.id, row);
    return row;
  },
  async findById(id) {
    return users.get(id) || null;
  },
  publicUser(row) {
    if (!row) return null;
    return { id: row.id, name: row.name, email: row.email, role: row.role };
  },
};

function matchesQuery(haystack, query) {
  return String(haystack || "")
    .toLowerCase()
    .indexOf(String(query || "").toLowerCase()) !== -1;
}

const driveNodeModel = {
  async findById(id) {
    return driveNodes.get(id) || null;
  },
  async findFolderById(id) {
    const n = driveNodes.get(id);
    return n && n.kind === "folder" ? n : null;
  },
  async findFileById(id) {
    const n = driveNodes.get(id);
    return n && n.kind === "file" ? n : null;
  },
  async findChildren(parentId) {
    return Array.from(driveNodes.values()).filter(function (n) {
      return n.parent_drive_id === parentId;
    });
  },
  async findAncestors(id) {
    return ancestorsOf(id);
  },
  async search(query) {
    return Array.from(driveNodes.values()).filter(function (n) {
      return matchesQuery(n.name, query) || matchesQuery(n.path, query);
    });
  },
};

const noteModel = {
  async findById(id) {
    return notes.get(Number(id)) || null;
  },
  async findRawById(id) {
    return notes.get(Number(id)) || null;
  },
  async search(query) {
    return Array.from(notes.values()).filter(function (n) {
      if (n.status !== "published") return false;
      return (
        matchesQuery(n.title, query) ||
        matchesQuery(n.description, query) ||
        matchesQuery(n.subject_name, query)
      );
    });
  },
  async countSearch(query) {
    const rows = await this.search(query);
    return rows.length;
  },
};

const semesterAccessModel = {
  async findByUserId(userId) {
    return entitlements.get(userId) || null;
  },
  async upsertForUser(userId, data) {
    const row = Object.assign(
      { id: nextEntitlementId++, user_id: userId, created_at: new Date() },
      entitlements.get(userId) || {},
      data
    );
    entitlements.set(userId, row);
    return row;
  },
};

stubRel("config/db.js", {
  async transaction(work) {
    return work({});
  },
});
stubRel("models/userModel.js", userModel);
stubRel("models/driveNodeModel.js", driveNodeModel);
stubRel("models/noteModel.js", noteModel);
stubRel("models/semesterAccessModel.js", semesterAccessModel);
stubRel("models/paymentRequestModel.js", {
  async findLatestByUser() {
    return null;
  },
});
stubRel("services/pdfActivityService.js", {
  async recordOpen() {},
  async recordDownload() {},
  async recordShare() {},
  async recordLogin() {},
  async recent() {
    return [];
  },
});

const express = require("express");
const cookieParser = require("cookie-parser");
const csrf = require("../src/middleware/csrfProtection");
const errorHandler = require("../src/middleware/errorHandler");
const searchRoutes = require("../src/routes/searchRoutes");
const tokenService = require("../src/services/tokenService");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.get("/api/csrf-token", csrf.issueToken);
app.use("/api", csrf);
app.use("/api/search", searchRoutes);
app.use(errorHandler);

let server;
let port;
test.before(function () {
  return new Promise(function (resolve) {
    server = app.listen(0, function () {
      port = server.address().port;
      resolve();
    });
  });
});
test.after(function () {
  return new Promise(function (resolve) {
    server.close(resolve);
  });
});
test.beforeEach(function () {
  resetState();
});

let ipCounter = 0;
function newIp() {
  ipCounter += 1;
  return "203.0.113." + ipCounter;
}

function sendRequest(method, urlPath, opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    const headers = Object.assign(
      { "x-forwarded-for": opts.ip || newIp() },
      opts.headers || {}
    );
    if (opts.xrw !== false) headers["x-requested-with"] = "XMLHttpRequest";
    const cookies = [];
    if (opts.cookie) cookies.push(opts.cookie);
    if (cookies.length) headers.cookie = cookies.join("; ");
    const r = http.request(
      { port: port, method: method, path: urlPath, headers: headers },
      function (res) {
        const chunks = [];
        res.on("data", function (c) {
          chunks.push(c);
        });
        res.on("end", function () {
          const buf = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buf.toString("utf8"));
          } catch (e) {
            json = null;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: buf.toString("utf8"),
            json: json,
          });
        });
      }
    );
    r.on("error", reject);
    r.end();
  });
}

async function createStudent(name) {
  return userModel.create({
    name: name || "Student",
    email: (name || "student") + Date.now() + Math.random() + "@college.edu",
    role: "student",
  });
}

async function authedGet(user, urlPath) {
  const cookie = "studykarle_token=" + tokenService.signToken(user.id, user.token_version || 0);
  return sendRequest("GET", urlPath, { cookie: cookie });
}

function resultItems(res) {
  return (res.json && res.json.data) || [];
}

test("unauthenticated search is 401, not 403 or 402", async function () {
  const res = await sendRequest("GET", "/api/search?q=os");
  assert.equal(res.status, 401);
  assert.equal(res.json.success, false);
});

test("empty search query is rejected", async function () {
  const student = await createStudent("EmptyQ");
  const res = await authedGet(student, "/api/search?q=");
  assert.equal(res.status, 400);
});

test("search finds Drive files by name", async function () {
  const student = await createStudent("FileName");
  const res = await authedGet(student, "/api/search?q=" + encodeURIComponent("Binary Tree"));
  assert.equal(res.status, 200);
  const items = resultItems(res);
  const hit = items.find(function (row) {
    return row.nodeId === "binary-tree";
  });
  assert.ok(hit, "expected Drive file Binary Tree.pdf");
  assert.equal(hit.source, "drive");
  assert.equal(hit.kind, "file");
  assert.equal(hit.title, "Binary Tree.pdf");
  assert.equal(hit.href, "/drive/file/binary-tree");
  assert.ok(Array.isArray(hit.ancestors));
  assert.equal(hit.mimeType, "application/pdf");
  assert.equal(hit.sizeBytes, 2048);
});

test("search finds Drive folders by name", async function () {
  const student = await createStudent("FolderName");
  const res = await authedGet(student, "/api/search?q=" + encodeURIComponent("Operating Systems"));
  assert.equal(res.status, 200);
  const folder = resultItems(res).find(function (row) {
    return row.nodeId === "os-folder";
  });
  assert.ok(folder, "expected Operating Systems folder");
  assert.equal(folder.kind, "folder");
  assert.equal(folder.href, "/drive/folder/os-folder");
});

test("partial name matches still return the resource", async function () {
  const student = await createStudent("Partial");
  const res = await authedGet(student, "/api/search?q=thermo");
  assert.equal(res.status, 200);
  const hit = resultItems(res).find(function (row) {
    return row.nodeId === "thermo";
  });
  assert.ok(hit);
});

test("exact title ranks above a title that only contains the query", async function () {
  const student = await createStudent("Rank");
  const res = await authedGet(student, "/api/search?q=" + encodeURIComponent("Binary Tree"));
  assert.equal(res.status, 200);
  const items = resultItems(res);
  const exact = items.findIndex(function (row) {
    return row.nodeId === "binary-tree";
  });
  const contains = items.findIndex(function (row) {
    return row.nodeId === "binary-tree-notes";
  });
  assert.ok(exact !== -1 && contains !== -1);
  assert.ok(exact < contains);
});

test("search paginates Drive results", async function () {
  const student = await createStudent("Pages");
  const page1 = await authedGet(student, "/api/search?q=pdf&page=1&limit=2");
  assert.equal(page1.status, 200);
  assert.equal(resultItems(page1).length, 2);
  assert.ok(page1.json.meta.total >= 3);
  assert.ok(page1.json.meta.totalPages >= 2);
  assert.equal(page1.json.meta.page, 1);
  assert.equal(page1.json.meta.limit, 2);
  const page2 = await authedGet(student, "/api/search?q=pdf&page=2&limit=2");
  assert.equal(page2.status, 200);
  assert.ok(resultItems(page2).length >= 1);
  const ids1 = resultItems(page1).map(function (row) {
    return row.nodeId || row.id;
  });
  const ids2 = resultItems(page2).map(function (row) {
    return row.nodeId || row.id;
  });
  ids2.forEach(function (id) {
    assert.equal(ids1.indexOf(id), -1);
  });
});

test("kind=folder filter returns only folders and keeps the query", async function () {
  const student = await createStudent("FilterKind");
  const res = await authedGet(
    student,
    "/api/search?q=" + encodeURIComponent("Operating Systems") + "&kind=folder"
  );
  assert.equal(res.status, 200);
  const items = resultItems(res);
  assert.ok(items.length >= 1);
  items.forEach(function (row) {
    assert.equal(row.kind, "folder");
  });
  assert.equal(res.json.meta.query, "Operating Systems");
});

test("year=1 filter keeps Year 1 Drive hits and drops Year 3", async function () {
  const student = await createStudent("FilterYear");
  const res = await authedGet(student, "/api/search?q=pdf&year=1");
  assert.equal(res.status, 200);
  const items = resultItems(res);
  assert.ok(items.length >= 1);
  items.forEach(function (row) {
    assert.equal(row.academicYear, 1);
    assert.ok(String(row.path || "").indexOf("Year 1") !== -1);
  });
  const y3 = items.find(function (row) {
    return row.nodeId === "thermo" || row.nodeId === "os-pdf";
  });
  assert.equal(y3, undefined);
});

test("duplicate Drive file is not also returned as a legacy note", async function () {
  const student = await createStudent("Dedupe");
  const res = await authedGet(student, "/api/search?q=OS");
  assert.equal(res.status, 200);
  const items = resultItems(res);
  const driveHit = items.filter(function (row) {
    return row.nodeId === "os-pdf";
  });
  const noteDup = items.filter(function (row) {
    return row.id === 22;
  });
  assert.equal(driveHit.length, 1);
  assert.equal(noteDup.length, 0);
});

test("legacy-only published notes remain searchable", async function () {
  const student = await createStudent("Legacy");
  const res = await authedGet(student, "/api/search?q=" + encodeURIComponent("Handwritten OS"));
  assert.equal(res.status, 200);
  const hit = resultItems(res).find(function (row) {
    return row.id === 33;
  });
  assert.ok(hit);
  assert.equal(hit.source, "note");
  assert.equal(hit.href, "/notes/33");
});

test("draft notes are not returned", async function () {
  const student = await createStudent("Draft");
  const res = await authedGet(student, "/api/search?q=" + encodeURIComponent("Draft OS"));
  assert.equal(res.status, 200);
  const hit = resultItems(res).find(function (row) {
    return row.id === 44;
  });
  assert.equal(hit, undefined);
});

test("deleted Drive nodes are not returned", async function () {
  const student = await createStudent("Deleted");
  driveNodes.delete("thermo");
  const res = await authedGet(student, "/api/search?q=thermo");
  assert.equal(res.status, 200);
  const hit = resultItems(res).find(function (row) {
    return row.nodeId === "thermo";
  });
  assert.equal(hit, undefined);
});

test("protected Drive hits keep 402 flags and never leak file contents", async function () {
  const student = await createStudent("Paywall");
  const res = await authedGet(student, "/api/search?q=" + encodeURIComponent("Binary Tree"));
  assert.equal(res.status, 200);
  const hit = resultItems(res).find(function (row) {
    return row.nodeId === "binary-tree";
  });
  assert.ok(hit);
  assert.equal(hit.protected, true);
  assert.equal(hit.canPreview, false);
  assert.equal(hit.canDownload, false);
  assert.equal(hit.accessCode, "PAYMENT_REQUIRED");
  assert.equal(hit.snippet, undefined);
  assert.equal(hit.content, undefined);
});

test("unprotected Drive hits remain previewable without paying", async function () {
  const student = await createStudent("Open");
  const res = await authedGet(student, "/api/search?q=thermo");
  assert.equal(res.status, 200);
  const hit = resultItems(res).find(function (row) {
    return row.nodeId === "thermo";
  });
  assert.ok(hit);
  assert.equal(hit.protected, false);
  assert.equal(hit.canPreview, true);
  assert.equal(hit.canDownload, false);
});

test("search is case-insensitive", async function () {
  const student = await createStudent("Case");
  const res = await authedGet(student, "/api/search?q=" + encodeURIComponent("BINARY TREE"));
  assert.equal(res.status, 200);
  const hit = resultItems(res).find(function (row) {
    return row.nodeId === "binary-tree";
  });
  assert.ok(hit);
});

test("multi-word queries still match the title", async function () {
  const student = await createStudent("Words");
  const res = await authedGet(student, "/api/search?q=" + encodeURIComponent("binary tree"));
  assert.equal(res.status, 200);
  const hit = resultItems(res).find(function (row) {
    return row.nodeId === "binary-tree";
  });
  assert.ok(hit);
});

test("unrelated queries return empty results", async function () {
  const student = await createStudent("Empty");
  const res = await authedGet(student, "/api/search?q=zzzznotalibrarytopic");
  assert.equal(res.status, 200);
  assert.equal(resultItems(res).length, 0);
  assert.equal(res.json.meta.total, 0);
  assert.equal(res.json.meta.suggestion, null);
});

test("type=pdf filter excludes folders and non-PDF files", async function () {
  const student = await createStudent("PdfType");
  const res = await authedGet(student, "/api/search?q=Lecture&type=pdf");
  assert.equal(res.status, 200);
  resultItems(res).forEach(function (row) {
    assert.equal(row.kind, "file");
    assert.notEqual(row.nodeId, "gdoc");
  });
});

test("invalid year filter is rejected with 400, not guessed", async function () {
  const student = await createStudent("BadYear");
  const res = await authedGet(student, "/api/search?q=pdf&year=3");
  assert.equal(res.status, 400);
});

test("year filter plus pagination stays inside Year 1", async function () {
  const student = await createStudent("YearPage");
  const res = await authedGet(student, "/api/search?q=pdf&year=1&page=1&limit=1");
  assert.equal(res.status, 200);
  assert.ok(resultItems(res).length <= 1);
  resultItems(res).forEach(function (row) {
    assert.equal(row.academicYear, 1);
  });
  assert.ok(res.json.meta.total >= 1);
});

test("unpaid search stays 200 with access flags, never 403", async function () {
  const student = await createStudent("No403");
  const res = await authedGet(student, "/api/search?q=" + encodeURIComponent("Binary Tree"));
  assert.equal(res.status, 200);
  assert.notEqual(res.status, 403);
  const hit = resultItems(res).find(function (row) {
    return row.nodeId === "binary-tree";
  });
  assert.equal(hit.protected, true);
  assert.equal(hit.canPreview, false);
});

test("Year 3 hits are not labeled as Year 1 or Year 2", async function () {
  const student = await createStudent("Year3");
  const res = await authedGet(student, "/api/search?q=thermo");
  assert.equal(res.status, 200);
  const hit = resultItems(res).find(function (row) {
    return row.nodeId === "thermo";
  });
  assert.ok(hit);
  assert.equal(hit.academicYear, null);
});
