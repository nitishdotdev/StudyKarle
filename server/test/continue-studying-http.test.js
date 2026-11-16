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
process.env.USER_RATE_LIMIT_MAX = "10000";

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
const paymentRequests = new Map();
const activityRows = [];
let nextActivityId = 1;
let nextEntitlementId = 1;

function resetState() {
  users.clear();
  nextUserId = 1;
  driveNodes.clear();
  notes.clear();
  entitlements.clear();
  paymentRequests.clear();
  activityRows.length = 0;
  nextActivityId = 1;
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
  driveNodes.set("ds-folder", {
    drive_id: "ds-folder",
    parent_drive_id: "year1",
    name: "Data Structures",
    mime_type: "application/vnd.google-apps.folder",
    kind: "folder",
    depth: 2,
    path: "Year 1/Data Structures",
    size_bytes: null,
    modified_time: null,
  });
  driveNodes.set("trees", {
    drive_id: "trees",
    parent_drive_id: "ds-folder",
    name: "Trees and Graphs.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 3,
    path: "Year 1/Data Structures/Trees and Graphs.pdf",
    size_bytes: 2048,
    modified_time: "2026-01-01T00:00:00.000Z",
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
    name: "Computer Science",
    mime_type: "application/vnd.google-apps.folder",
    kind: "folder",
    depth: 2,
    path: "Year 3/Computer Science",
    size_bytes: null,
    modified_time: null,
  });
  driveNodes.set("os-pdf", {
    drive_id: "os-pdf",
    parent_drive_id: "os-folder",
    name: "Operating Systems.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 3,
    path: "Year 3/Computer Science/Operating Systems.pdf",
    size_bytes: 1024,
    modified_time: "2026-02-01T00:00:00.000Z",
  });
  driveNodes.set("renamed", {
    drive_id: "renamed",
    parent_drive_id: "os-folder",
    name: "Current Networks.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 3,
    path: "Year 3/Computer Science/Current Networks.pdf",
    size_bytes: 512,
    modified_time: "2026-03-01T00:00:00.000Z",
  });
  driveNodes.set("slides", {
    drive_id: "slides",
    parent_drive_id: "os-folder",
    name: "Lecture Deck",
    mime_type: "application/vnd.google-apps.presentation",
    kind: "file",
    depth: 3,
    path: "Year 3/Computer Science/Lecture Deck",
    size_bytes: 256,
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
    year_id: 1,
    drive_file_id: null,
    created_at: new Date("2026-01-01"),
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
    year_id: 3,
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
    year_id: 3,
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
  async findPublicById(id) {
    return this.publicUser(users.get(id));
  },
  publicUser(row) {
    if (!row) return null;
    return { id: row.id, name: row.name, email: row.email, role: row.role };
  },
};

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
  async findFilesByIds(ids) {
    const list = Array.isArray(ids) ? ids : [];
    return list
      .map(function (id) {
        return driveNodes.get(id);
      })
      .filter(function (n) {
        return n && n.kind === "file";
      });
  },
  async findAncestors(id) {
    return ancestorsOf(id);
  },
};

const noteModel = {
  async findById(id) {
    return notes.get(Number(id)) || null;
  },
  async findRawById(id) {
    return notes.get(Number(id)) || null;
  },
  async findPublishedByIds(ids) {
    const list = Array.isArray(ids) ? ids : [];
    return list
      .map(function (id) {
        return notes.get(Number(id));
      })
      .filter(function (n) {
        return n && n.status === "published";
      });
  },
};

const semesterAccessModel = {
  async findByUserId(userId) {
    return entitlements.get(userId) || null;
  },
};

const paymentRequestModel = {
  async findLatestByUser(userId) {
    return paymentRequests.get(userId) || null;
  },
};

const ACTIVITY_TYPES = ["pdf_opened", "pdf_downloaded", "pdf_shared", "user_login"];
const RESOURCE_TYPES = ["drive", "note"];

const pdfActivityModel = {
  ACTIVITY_TYPES: ACTIVITY_TYPES.slice(),
  RESOURCE_TYPES: RESOURCE_TYPES.slice(),
  DEFAULT_OPEN_DEDUP_WINDOW_MINUTES: 60,
  DEFAULT_LOGIN_DEDUP_WINDOW_MINUTES: 1,

  async record(data) {
    const activityType = String(data.activityType || "").toLowerCase();
    if (ACTIVITY_TYPES.indexOf(activityType) === -1) return false;
    if (!data.userId) return false;
    const resourceType =
      activityType === "user_login" ? null : String(data.resourceType || "").toLowerCase();
    activityRows.push({
      id: nextActivityId++,
      user_id: data.userId,
      activity_type: activityType,
      resource_type: resourceType,
      pdf_id: data.pdfId ? String(data.pdfId) : null,
      pdf_name: data.pdfName ? String(data.pdfName).slice(0, 255) : null,
      created_at: data.createdAt ? new Date(data.createdAt) : new Date(),
    });
    return true;
  },

  async recentOpenedByUser(userId, limit) {
    const parsed = Number(limit);
    const rows = activityRows
      .filter(function (row) {
        return row.user_id === userId && row.activity_type === "pdf_opened";
      })
      .slice()
      .sort(function (a, b) {
        return b.created_at.getTime() - a.created_at.getTime();
      });
    const sliced = Number.isFinite(parsed) && parsed > 0 ? rows.slice(0, parsed) : rows;
    return sliced.map(function (row) {
      return {
        id: row.id,
        userId: row.user_id,
        activityType: row.activity_type,
        resourceType: row.resource_type,
        pdfId: row.pdf_id,
        pdfName: row.pdf_name,
        createdAt: row.created_at,
      };
    });
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
stubRel("models/paymentRequestModel.js", paymentRequestModel);
stubRel("models/pdfActivityModel.js", pdfActivityModel);
stubRel("models/savedNoteModel.js", {
  async countByUser() {
    return 0;
  },
});
stubRel("models/savedFileModel.js", {
  async countByUser() {
    return 0;
  },
});
stubRel("models/viewHistoryModel.js", {
  async findByUser() {
    return [];
  },
});

const express = require("express");
const cookieParser = require("cookie-parser");
const csrf = require("../src/middleware/csrfProtection");
const errorHandler = require("../src/middleware/errorHandler");
const notFound = require("../src/middleware/notFound");
const userRoutes = require("../src/routes/userRoutes");
const tokenService = require("../src/services/tokenService");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.get("/api/csrf-token", csrf.issueToken);
app.use("/api", csrf);
app.use("/api/users", userRoutes);
app.use(notFound);
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

async function createUser(role, name) {
  return userModel.create({
    name: name || role,
    email: (name || role) + Date.now() + Math.random() + "@college.edu",
    role: role,
  });
}

async function authedGet(user, urlPath) {
  const cookie = "studykarle_token=" + tokenService.signToken(user.id, user.token_version || 0);
  return sendRequest("GET", urlPath, { cookie: cookie });
}

function addActivity(data) {
  activityRows.push({
    id: nextActivityId++,
    user_id: data.userId,
    activity_type: data.activityType,
    resource_type: data.resourceType || null,
    pdf_id: data.pdfId ? String(data.pdfId) : null,
    pdf_name: data.pdfName || null,
    created_at: new Date(data.createdAt),
  });
}

function itemsOf(res) {
  return (res.json && res.json.data && res.json.data.items) || [];
}

test("unauthenticated continue-studying is 401, not 403 or 402", async function () {
  const res = await sendRequest("GET", "/api/users/me/continue-studying");
  assert.equal(res.status, 401);
  assert.equal(res.json.success, false);
});

test("admins cannot read student continue-studying", async function () {
  const admin = await createUser("admin", "Admin");
  addActivity({
    userId: admin.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "os-pdf",
    pdfName: "Operating Systems.pdf",
    createdAt: "2026-11-05T10:00:00.000Z",
  });
  const res = await authedGet(admin, "/api/users/me/continue-studying");
  assert.equal(res.status, 403);
});

test("student continue-studying is scoped to the authenticated user", async function () {
  const a = await createUser("student", "Alice");
  const b = await createUser("student", "Bob");
  addActivity({
    userId: a.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "os-pdf",
    pdfName: "Operating Systems.pdf",
    createdAt: "2026-11-05T12:00:00.000Z",
  });
  addActivity({
    userId: b.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "trees",
    pdfName: "Trees and Graphs.pdf",
    createdAt: "2026-11-05T13:00:00.000Z",
  });
  const res = await authedGet(a, "/api/users/me/continue-studying");
  assert.equal(res.status, 200);
  const items = itemsOf(res);
  assert.equal(items.length, 1);
  assert.equal(items[0].resourceId, "os-pdf");
});

test("returns the latest two unique opened resources", async function () {
  const student = await createUser("student", "Nitish");
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "os-pdf",
    pdfName: "Operating Systems.pdf",
    createdAt: "2026-11-05T09:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "note",
    pdfId: "33",
    pdfName: "Handwritten OS",
    createdAt: "2026-11-05T10:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "renamed",
    pdfName: "Old Networks.pdf",
    createdAt: "2026-11-05T11:00:00.000Z",
  });
  const res = await authedGet(student, "/api/users/me/continue-studying");
  assert.equal(res.status, 200);
  const items = itemsOf(res);
  assert.equal(items.length, 2);
  assert.equal(items[0].resourceId, "renamed");
  assert.equal(items[1].resourceId, "33");
});

test("duplicate opens collapse to the latest unique resource", async function () {
  const student = await createUser("student", "Dupes");
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "os-pdf",
    pdfName: "Operating Systems.pdf",
    createdAt: "2026-11-05T08:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "note",
    pdfId: "33",
    pdfName: "Handwritten OS",
    createdAt: "2026-11-05T09:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "os-pdf",
    pdfName: "Operating Systems.pdf",
    createdAt: "2026-11-05T12:00:00.000Z",
  });
  const res = await authedGet(student, "/api/users/me/continue-studying");
  const items = itemsOf(res);
  assert.equal(items.length, 2);
  assert.equal(items[0].resourceType, "drive");
  assert.equal(items[0].resourceId, "os-pdf");
  assert.equal(items[1].resourceType, "note");
  assert.equal(items[1].resourceId, "33");
});

test("login download and share events are excluded", async function () {
  const student = await createUser("student", "Noise");
  addActivity({
    userId: student.id,
    activityType: "user_login",
    createdAt: "2026-11-05T12:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_downloaded",
    resourceType: "drive",
    pdfId: "os-pdf",
    pdfName: "Operating Systems.pdf",
    createdAt: "2026-11-05T11:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_shared",
    resourceType: "drive",
    pdfId: "renamed",
    pdfName: "Current Networks.pdf",
    createdAt: "2026-11-05T10:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "note",
    pdfId: "33",
    pdfName: "Handwritten OS",
    createdAt: "2026-11-05T09:00:00.000Z",
  });
  const res = await authedGet(student, "/api/users/me/continue-studying");
  const items = itemsOf(res);
  assert.equal(items.length, 1);
  assert.equal(items[0].resourceType, "note");
  assert.equal(items[0].resourceId, "33");
});

test("deleted Drive files and unpublished notes are excluded", async function () {
  const student = await createUser("student", "Gone");
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "missing-file",
    pdfName: "Deleted.pdf",
    createdAt: "2026-11-05T12:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "note",
    pdfId: "44",
    pdfName: "Draft OS",
    createdAt: "2026-11-05T11:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "os-pdf",
    pdfName: "Operating Systems.pdf",
    createdAt: "2026-11-05T10:00:00.000Z",
  });
  const res = await authedGet(student, "/api/users/me/continue-studying");
  const items = itemsOf(res);
  assert.equal(items.length, 1);
  assert.equal(items[0].resourceId, "os-pdf");
});

test("Drive and legacy note items include current metadata and navigation hrefs", async function () {
  const student = await createUser("student", "Nav");
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "renamed",
    pdfName: "Old Networks.pdf",
    createdAt: "2026-11-05T12:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "note",
    pdfId: "33",
    pdfName: "Stale Title",
    createdAt: "2026-11-05T11:00:00.000Z",
  });
  const res = await authedGet(student, "/api/users/me/continue-studying");
  const items = itemsOf(res);
  assert.equal(items[0].resourceType, "drive");
  assert.equal(items[0].title, "Current Networks.pdf");
  assert.equal(items[0].context, "Computer Science");
  assert.equal(items[0].href, "/drive/file/renamed");
  assert.equal(items[0].canPreview, true);
  assert.equal(items[1].resourceType, "note");
  assert.equal(items[1].title, "Handwritten OS");
  assert.equal(items[1].context, "Operating Systems");
  assert.equal(items[1].href, "/notes/33");
});

test("locked Year 1 resources keep access flags without exposing file bytes", async function () {
  const student = await createUser("student", "Locked");
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "drive",
    pdfId: "trees",
    pdfName: "Trees and Graphs.pdf",
    createdAt: "2026-11-05T12:00:00.000Z",
  });
  addActivity({
    userId: student.id,
    activityType: "pdf_opened",
    resourceType: "note",
    pdfId: "11",
    pdfName: "Year 1 Physics Lab",
    createdAt: "2026-11-05T11:00:00.000Z",
  });
  const res = await authedGet(student, "/api/users/me/continue-studying");
  assert.equal(res.status, 200);
  const items = itemsOf(res);
  assert.equal(items.length, 2);
  items.forEach(function (item) {
    assert.equal(item.canPreview, false);
    assert.equal(item.protected, true);
    assert.equal(item.accessCode, "PAYMENT_REQUIRED");
    assert.equal(item.previewUrl, undefined);
    assert.equal(item.bytes, undefined);
  });
});

test("empty history returns an empty items list, not an error", async function () {
  const student = await createUser("student", "Empty");
  const res = await authedGet(student, "/api/users/me/continue-studying");
  assert.equal(res.status, 200);
  assert.deepEqual(itemsOf(res), []);
});
