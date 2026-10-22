// HTTP-level tests for semester payment access.
// Stubs the database and Drive streaming; exercises real routes, CSRF, JWT.

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
const { URL } = require("url");

function stubRel(rel, exports) {
  const full = require.resolve(path.join(__dirname, "..", "src", rel));
  require.cache[full] = { id: full, filename: full, loaded: true, exports };
}

const users = new Map();
let nextUserId = 1;
const driveNodes = new Map();
const shares = new Map();
let nextShareId = 1;
const notes = new Map();
const paymentRequests = [];
let nextPaymentId = 1;
const entitlements = new Map();
let nextEntitlementId = 1;
const streamedFiles = [];
const savedFiles = new Map();

function resetState() {
  users.clear();
  nextUserId = 1;
  driveNodes.clear();
  shares.clear();
  nextShareId = 1;
  notes.clear();
  paymentRequests.length = 0;
  nextPaymentId = 1;
  entitlements.clear();
  nextEntitlementId = 1;
  streamedFiles.length = 0;
  savedFiles.clear();
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
  driveNodes.set("y1-pdf", {
    drive_id: "y1-pdf",
    parent_drive_id: "year1-physics",
    name: "kinematics.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 3,
    path: "Year 1/Physics/kinematics.pdf",
    size_bytes: 12000,
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
  driveNodes.set("y3-pdf", {
    drive_id: "y3-pdf",
    parent_drive_id: "year3",
    name: "networks.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 2,
    path: "Year 3/networks.pdf",
    size_bytes: 8000,
    modified_time: "2026-01-01T00:00:00.000Z",
  });
  driveNodes.set("misc-pdf", {
    drive_id: "misc-pdf",
    parent_drive_id: "root-folder",
    name: "Year 1 notes.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 1,
    path: "Year 1 notes.pdf",
    size_bytes: 4000,
    modified_time: "2026-01-01T00:00:00.000Z",
  });

  notes.set(11, {
    id: 11,
    title: "Year 1 Physics Notes",
    status: "published",
    drive_file_id: "note-y1",
    year_id: 1,
    year_label: "Year 1",
    subject_name: "Physics",
  });
  notes.set(33, {
    id: 33,
    title: "Year 3 COA Notes",
    status: "published",
    drive_file_id: "note-y3",
    year_id: 3,
    year_label: "Year 3",
    subject_name: "COA",
  });
}

async function ancestorsOf(nodeId) {
  const ancestors = [];
  const seen = new Set();
  let current = driveNodes.get(nodeId);
  while (current && current.parent_drive_id && !seen.has(current.parent_drive_id)) {
    seen.add(current.parent_drive_id);
    const parent = driveNodes.get(current.parent_drive_id);
    if (!parent) break;
    ancestors.unshift({ name: parent.name, nodeId: parent.drive_id });
    current = parent;
  }
  return ancestors;
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
};

const driveShareModel = {
  async create(data) {
    const row = {
      id: nextShareId++,
      drive_id: data.driveId,
      token: data.token,
      permission: data.permission || "download",
      created_by: data.createdBy,
      expires_at: data.expiresAt || null,
      revoked_at: null,
      created_at: new Date(),
    };
    shares.set(row.token, row);
    shares.set("id:" + row.id, row);
    return row;
  },
  async findByToken(token) {
    return shares.get(token) || null;
  },
  async findManageableByDriveId() {
    return [];
  },
  async findManageableByDriveIdAndId() {
    return null;
  },
};

const noteModel = {
  async findById(id) {
    return notes.get(Number(id)) || null;
  },
  async findRawById(id) {
    return notes.get(Number(id)) || null;
  },
  async search() {
    return Array.from(notes.values());
  },
  async countSearch() {
    return notes.size;
  },
};

const paymentRequestModel = {
  async create(data) {
    const row = Object.assign(
      {
        id: nextPaymentId++,
        created_at: new Date(),
        reviewed_at: null,
        reviewed_by: null,
        status: data.status || "pending",
      },
      data
    );
    paymentRequests.push(row);
    return row;
  },
  async findById(id) {
    return paymentRequests.find(function (r) {
      return r.id === Number(id);
    }) || null;
  },
  async findByReference(ref) {
    return paymentRequests.find(function (r) {
      return r.payment_reference === ref;
    }) || null;
  },
  async findLatestByUser(userId) {
    const rows = paymentRequests.filter(function (r) {
      return r.user_id === userId;
    });
    return rows.length ? rows[rows.length - 1] : null;
  },
  async findByUser(userId) {
    return paymentRequests.filter(function (r) {
      return r.user_id === userId;
    });
  },
  async list(filters) {
    let rows = paymentRequests.slice();
    if (filters && filters.status) {
      rows = rows.filter(function (r) {
        return r.status === filters.status;
      });
    }
    return rows.slice().reverse();
  },
  async update(id, patch) {
    const row = await this.findById(id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
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
    const paySnap = paymentRequests.map(function (row) {
      return Object.assign({}, row);
    });
    const entSnap = new Map();
    entitlements.forEach(function (row, userId) {
      entSnap.set(userId, Object.assign({}, row));
    });
    try {
      return await work({});
    } catch (err) {
      paymentRequests.length = 0;
      paySnap.forEach(function (row) {
        paymentRequests.push(row);
      });
      entitlements.clear();
      entSnap.forEach(function (row, userId) {
        entitlements.set(userId, row);
      });
      throw err;
    }
  },
});
stubRel("models/userModel.js", userModel);
stubRel("models/driveNodeModel.js", driveNodeModel);
stubRel("models/driveShareModel.js", driveShareModel);
stubRel("models/noteModel.js", noteModel);
stubRel("models/paymentRequestModel.js", paymentRequestModel);
stubRel("models/semesterAccessModel.js", semesterAccessModel);
stubRel("models/driveThumbnailModel.js", {
  async findByDriveId() {
    return null;
  },
  async upsert() {
    return null;
  },
});
stubRel("models/savedFileModel.js", {
  async exists(userId, nodeId) {
    return savedFiles.get(userId + ":" + nodeId) === true;
  },
  async create(userId, nodeId) {
    savedFiles.set(userId + ":" + nodeId, true);
  },
  async remove(userId, nodeId) {
    savedFiles.delete(userId + ":" + nodeId);
  },
  async findByUser(userId) {
    const out = [];
    for (const [key, val] of savedFiles.entries()) {
      if (!val) continue;
      const sep = key.indexOf(":");
      if (Number(key.slice(0, sep)) !== userId) continue;
      const nodeId = key.slice(sep + 1);
      const node = driveNodes.get(nodeId);
      if (!node) continue;
      out.push({
        driveId: node.drive_id,
        name: node.name,
        size_bytes: node.size_bytes,
        modified_time: node.modified_time,
      });
    }
    return out;
  },
});
stubRel("models/savedNoteModel.js", {
  async findByUser() {
    return Array.from(notes.values());
  },
  async create() {},
  async remove() {},
});
stubRel("models/viewHistoryModel.js", {
  async record() {},
});
stubRel("models/driveShareModel.js", driveShareModel);
stubRel("services/driveService.js", {
  async streamFile(driveFileId, res) {
    streamedFiles.push(driveFileId);
    res.setHeader("Content-Type", "application/pdf");
    res.end("%PDF-fake-" + driveFileId);
  },
  async getThumbnail() {
    return { mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) };
  },
});
stubRel("services/pdfActivityService.js", {
  async recordOpen() {},
  async recordDownload() {},
  async recordShare() {},
});
stubRel("services/driveShareService.js", {
  async createShare(opts) {
    const crypto = require("crypto");
    const token = crypto.randomBytes(16).toString("hex");
    return driveShareModel.create({
      driveId: opts.driveId,
      token: token,
      permission: opts.permission || "download",
      createdBy: opts.createdBy,
    });
  },
  async resolveActiveToken(token) {
    const share = await driveShareModel.findByToken(token);
    if (!share || share.revoked_at) {
      const ApiError = require("../src/utils/ApiError");
      throw ApiError.notFound("Share link is invalid or has expired");
    }
    return share;
  },
});
function toPublicNode(node, parentDriveId) {
  return {
    nodeId: node.drive_id,
    parentNodeId: parentDriveId || null,
    name: node.name,
    kind: node.kind,
    mimeType: node.mime_type,
    sizeBytes: node.size_bytes ? Number(node.size_bytes) : null,
    createdTime: node.created_time ? new Date(node.created_time) : null,
    modifiedTime: node.modified_time ? new Date(node.modified_time) : null,
    depth: node.depth,
    path: node.path,
  };
}

function childrenOf(parentId) {
  const folders = [];
  const files = [];
  Array.from(driveNodes.values()).forEach(function (row) {
    if (row.parent_drive_id !== parentId) return;
    const pub = toPublicNode(row, parentId);
    if (row.kind === "folder") folders.push(pub);
    else files.push(pub);
  });
  return { folders: folders, files: files };
}

stubRel("services/driveNodeService.js", {
  async listRoot() {
    const rootId = "root-folder";
    const children = childrenOf(rootId);
    return {
      node: {
        nodeId: rootId,
        parentNodeId: null,
        name: "Library",
        kind: "folder",
        mimeType: "application/vnd.google-apps.folder",
        sizeBytes: null,
        createdTime: null,
        modifiedTime: null,
        depth: 0,
        path: "Library",
      },
      parent: null,
      ancestors: [],
      folders: children.folders,
      files: children.files,
    };
  },
  async listFolder(nodeId) {
    const node = driveNodes.get(nodeId);
    if (!node || node.kind !== "folder") {
      const ApiError = require("../src/utils/ApiError");
      throw ApiError.notFound("Folder not found");
    }
    const children = childrenOf(nodeId);
    const parent = node.parent_drive_id ? driveNodes.get(node.parent_drive_id) : null;
    return {
      node: toPublicNode(node, node.parent_drive_id),
      parent: parent ? toPublicNode(parent, parent.parent_drive_id) : null,
      ancestors: await ancestorsOf(nodeId),
      folders: children.folders,
      files: children.files,
    };
  },
  async getFile(nodeId) {
    const node = driveNodes.get(nodeId);
    if (!node || node.kind !== "file") {
      const ApiError = require("../src/utils/ApiError");
      throw ApiError.notFound("File not found");
    }
    const parent = node.parent_drive_id ? driveNodes.get(node.parent_drive_id) : null;
    return {
      node: toPublicNode(node, node.parent_drive_id),
      parent: parent ? toPublicNode(parent, parent.parent_drive_id) : null,
      ancestors: await ancestorsOf(nodeId),
    };
  },
});

const express = require("express");
const cookieParser = require("cookie-parser");
const csrf = require("../src/middleware/csrfProtection");
const errorHandler = require("../src/middleware/errorHandler");
const driveRoutes = require("../src/routes/driveRoutes");
const noteRoutes = require("../src/routes/noteRoutes");
const adminRoutes = require("../src/routes/adminRoutes");
const paymentRoutes = require("../src/routes/paymentRoutes");
const searchRoutes = require("../src/routes/searchRoutes");
const savedRoutes = require("../src/routes/savedRoutes");
const tokenService = require("../src/services/tokenService");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.get("/api/csrf-token", csrf.issueToken);
app.use("/api", csrf);
app.use("/api", driveRoutes);
app.use("/api", noteRoutes);
app.use("/api", paymentRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/saved", savedRoutes);
app.use("/api/admin", adminRoutes);
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
  process.env.PAYMENT_UPI_ID = "studykarle@oksbi";
  process.env.PAYMENT_PAYEE_NAME = "StudyKarle";
  process.env.PAYMENT_ACCESS_ENDS_AT = "2099-12-31T18:30:00.000Z";
});

let ipCounter = 0;
function newIp() {
  ipCounter += 1;
  return "198.51.100." + ipCounter;
}

function sendRequest(method, urlPath, opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    const headers = Object.assign(
      {
        "x-forwarded-for": opts.ip || newIp(),
      },
      opts.headers || {}
    );
    if (opts.xrw !== false) headers["x-requested-with"] = "XMLHttpRequest";
    if (opts.json !== false && !headers["content-type"] && opts.body && !opts.rawBody) {
      headers["content-type"] = "application/json";
    }
    const cookies = [];
    if (opts.cookie) cookies.push(opts.cookie);
    if (opts.csrfCookie) cookies.push(opts.csrfCookie);
    if (cookies.length) headers.cookie = cookies.join("; ");
    if (opts.csrfToken) headers["x-csrf-token"] = opts.csrfToken;
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
            buffer: buf,
            json: json,
          });
        });
      }
    );
    r.on("error", reject);
    if (opts.rawBody) r.write(opts.rawBody);
    else if (opts.body) r.write(JSON.stringify(opts.body));
    r.end();
  });
}

function fetchCsrf() {
  return sendRequest("GET", "/api/csrf-token", {}).then(function (res) {
    const cookies = (res.headers["set-cookie"] || [])
      .map(function (c) {
        return c.split(";")[0];
      })
      .join("; ");
    return {
      token: res.json && res.json.data ? res.json.data.csrfToken : null,
      cookie: cookies,
    };
  });
}

async function authCookieFor(user) {
  return "studykarle_token=" + tokenService.signToken(user.id, user.token_version || 0);
}

async function createStudent(name) {
  return userModel.create({
    name: name || "Student",
    email: (name || "student") + Date.now() + Math.random() + "@college.edu",
    role: "student",
  });
}

async function createAdmin() {
  return userModel.create({
    name: "Admin",
    email: "admin" + Date.now() + Math.random() + "@college.edu",
    role: "admin",
  });
}

async function mutating(user, method, urlPath, body) {
  const csrfTok = await fetchCsrf();
  const cookie = await authCookieFor(user);
  return sendRequest(method, urlPath, {
    cookie: cookie,
    csrfCookie: csrfTok.cookie,
    csrfToken: csrfTok.token,
    body: body,
  });
}

async function authedGet(user, urlPath) {
  const cookie = await authCookieFor(user);
  return sendRequest("GET", urlPath, { cookie: cookie });
}

test("unpaid student cannot preview a protected Drive file", async function () {
  const student = await createStudent("Unpaid");
  const res = await authedGet(student, "/api/drive/files/y1-pdf/preview");
  assert.equal(res.status, 402);
  assert.equal(res.json.success, false);
  assert.equal(res.json.details.code, "PAYMENT_REQUIRED");
  assert.equal(streamedFiles.length, 0);
});

test("unpaid student cannot download a protected Drive file", async function () {
  const student = await createStudent("UnpaidDl");
  const res = await authedGet(student, "/api/drive/files/y1-pdf/download");
  assert.equal(res.status, 402);
  assert.equal(streamedFiles.length, 0);
});

test("pending payment does not unlock protected preview", async function () {
  const student = await createStudent("Pending");
  await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-PENDING1",
    amount_rupees: 9,
    status: "pending",
  });
  const res = await authedGet(student, "/api/drive/files/y1-pdf/preview");
  assert.equal(res.status, 402);
  assert.equal(res.json.details.code, "PAYMENT_PENDING");
  assert.equal(streamedFiles.length, 0);
});

test("rejected payment does not unlock protected preview", async function () {
  const student = await createStudent("Rejected");
  await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-REJECT1",
    amount_rupees: 9,
    status: "rejected",
  });
  const res = await authedGet(student, "/api/drive/files/y1-pdf/preview");
  assert.equal(res.status, 402);
  assert.equal(res.json.details.code, "PAYMENT_REJECTED");
});

test("approved unexpired student can preview protected material", async function () {
  const student = await createStudent("Approved");
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-OK1",
    amount_rupees: 9,
    status: "approved",
  });
  await semesterAccessModel.upsertForUser(student.id, {
    payment_request_id: pay.id,
    ends_at: new Date("2099-12-31T18:30:00.000Z"),
  });
  const res = await authedGet(student, "/api/drive/files/y1-pdf/preview");
  assert.equal(res.status, 200);
  assert.match(res.body, /%PDF/);
  assert.equal(streamedFiles[0], "y1-pdf");
});

test("approved student still cannot download protected material", async function () {
  const student = await createStudent("ApprovedDl");
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-OK2",
    amount_rupees: 9,
    status: "approved",
  });
  await semesterAccessModel.upsertForUser(student.id, {
    payment_request_id: pay.id,
    ends_at: new Date("2099-12-31T18:30:00.000Z"),
  });
  const res = await authedGet(student, "/api/drive/files/y1-pdf/download");
  assert.equal(res.status, 403);
  assert.equal(streamedFiles.length, 0);
});

test("expired entitlement cannot preview protected material", async function () {
  const student = await createStudent("Expired");
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-OLD",
    amount_rupees: 9,
    status: "approved",
  });
  await semesterAccessModel.upsertForUser(student.id, {
    payment_request_id: pay.id,
    ends_at: new Date("2020-01-01T00:00:00.000Z"),
  });
  const res = await authedGet(student, "/api/drive/files/y1-pdf/preview");
  assert.equal(res.status, 402);
  assert.equal(res.json.details.code, "PAYMENT_EXPIRED");
  assert.equal(streamedFiles.length, 0);
});

test("admin can preview and download protected material without paying", async function () {
  const admin = await createAdmin();
  const preview = await authedGet(admin, "/api/drive/files/y1-pdf/preview");
  assert.equal(preview.status, 200);
  const download = await authedGet(admin, "/api/drive/files/y1-pdf/download");
  assert.equal(download.status, 200);
  assert.equal(streamedFiles.length, 2);
});

test("unprotected Drive files remain previewable but not downloadable for unpaid students", async function () {
  const student = await createStudent("FreeFile");
  const preview = await authedGet(student, "/api/drive/files/y3-pdf/preview");
  assert.equal(preview.status, 200);
  const download = await authedGet(student, "/api/drive/files/y3-pdf/download");
  assert.equal(download.status, 403);
  assert.equal(streamedFiles.length, 1);
  const misnamed = await authedGet(student, "/api/drive/files/misc-pdf/preview");
  assert.equal(misnamed.status, 200);
});

test("unpaid student cannot download an unprotected Drive file", async function () {
  const student = await createStudent("Year3Dl");
  const res = await authedGet(student, "/api/drive/files/y3-pdf/download");
  assert.equal(res.status, 403);
  assert.equal(streamedFiles.length, 0);
});

test("pending student cannot download unprotected material", async function () {
  const student = await createStudent("PendingDl");
  await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-PENDDL",
    amount_rupees: 9,
    status: "pending",
  });
  const res = await authedGet(student, "/api/drive/files/y3-pdf/download");
  assert.equal(res.status, 403);
  assert.equal(streamedFiles.length, 0);
});

test("rejected student cannot download unprotected material", async function () {
  const student = await createStudent("RejectDl");
  await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-REJDL",
    amount_rupees: 9,
    status: "rejected",
  });
  const res = await authedGet(student, "/api/drive/files/y3-pdf/download");
  assert.equal(res.status, 403);
  assert.equal(streamedFiles.length, 0);
});

test("expired student cannot download unprotected material", async function () {
  const student = await createStudent("ExpiredDl");
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-OLDDL",
    amount_rupees: 9,
    status: "approved",
  });
  await semesterAccessModel.upsertForUser(student.id, {
    payment_request_id: pay.id,
    ends_at: new Date("2020-01-01T00:00:00.000Z"),
  });
  const res = await authedGet(student, "/api/drive/files/y3-pdf/download");
  assert.equal(res.status, 403);
  assert.equal(streamedFiles.length, 0);
});

test("approved student cannot download unprotected material", async function () {
  const student = await createStudent("ApprovedFreeDl");
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-OKFREE",
    amount_rupees: 9,
    status: "approved",
  });
  await semesterAccessModel.upsertForUser(student.id, {
    payment_request_id: pay.id,
    ends_at: new Date("2099-12-31T18:30:00.000Z"),
  });
  const res = await authedGet(student, "/api/drive/files/y3-pdf/download");
  assert.equal(res.status, 403);
  assert.equal(streamedFiles.length, 0);
});

test("admin can download unprotected material", async function () {
  const admin = await createAdmin();
  const res = await authedGet(admin, "/api/drive/files/y3-pdf/download");
  assert.equal(res.status, 200);
  assert.equal(streamedFiles[0], "y3-pdf");
});

test("students cannot download protected or unprotected notes", async function () {
  const student = await createStudent("NoteDl");
  const protectedDl = await authedGet(student, "/api/notes/11/download");
  assert.equal(protectedDl.status, 402);
  const freeDl = await authedGet(student, "/api/notes/33/download");
  assert.equal(freeDl.status, 403);
  assert.equal(streamedFiles.length, 0);
});

test("admin can download unprotected notes", async function () {
  const admin = await createAdmin();
  const res = await authedGet(admin, "/api/notes/33/download");
  assert.equal(res.status, 200);
  assert.equal(streamedFiles[0], "note-y3");
});

test("unpaid student cannot preview a protected legacy note", async function () {
  const student = await createStudent("NoteUnpaid");
  const res = await authedGet(student, "/api/notes/11/preview");
  assert.equal(res.status, 402);
  assert.equal(streamedFiles.length, 0);
});

test("unpaid student can still preview an unprotected legacy note", async function () {
  const student = await createStudent("NoteFree");
  const res = await authedGet(student, "/api/notes/33/preview");
  assert.equal(res.status, 200);
});

test("share URLs cannot bypass the protected-material paywall", async function () {
  const admin = await createAdmin();
  const created = await mutating(admin, "POST", "/api/drive/files/y1-pdf/share", {
    permission: "download",
  });
  // Admin may be forbidden from creating a public bypass, or the token
  // itself must not stream the file. Either outcome is acceptable as long
  // as the PDF is never returned without entitlement.
  if (created.status === 201) {
    const token = created.json.data.token;
    const preview = await sendRequest("GET", "/api/drive/shares/" + token + "/preview", {});
    assert.notEqual(preview.status, 200);
    assert.equal(streamedFiles.indexOf("y1-pdf"), -1);
    const download = await sendRequest("GET", "/api/drive/shares/" + token + "/download", {});
    assert.notEqual(download.status, 200);
  } else {
    assert.ok(created.status === 403 || created.status === 402);
  }
});

test("students cannot create share links for protected files", async function () {
  const student = await createStudent("Sharer");
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-SHARE",
    amount_rupees: 9,
    status: "approved",
  });
  await semesterAccessModel.upsertForUser(student.id, {
    payment_request_id: pay.id,
    ends_at: new Date("2099-12-31T18:30:00.000Z"),
  });
  const res = await mutating(student, "POST", "/api/drive/files/y1-pdf/share", {
    permission: "download",
  });
  assert.ok(res.status === 403 || res.status === 402);
});

test("checkout fails closed when UPI configuration is missing", async function () {
  process.env.PAYMENT_UPI_ID = "";
  const student = await createStudent("NoUpi");
  const res = await mutating(student, "POST", "/api/payments/checkout", {});
  assert.equal(res.status, 503);
  assert.equal(entitlements.size, 0);
});

test("checkout fails closed when semester end date is invalid", async function () {
  process.env.PAYMENT_ACCESS_ENDS_AT = "bogus";
  const student = await createStudent("BadDate");
  const res = await mutating(student, "POST", "/api/payments/checkout", {});
  assert.equal(res.status, 503);
});

test("checkout returns a unique reference, ₹9 amount, and server UPI details", async function () {
  const student = await createStudent("Checkout");
  const res = await mutating(student, "POST", "/api/payments/checkout", {
    amount: 1,
    accessEndsAt: "2099-01-01",
  });
  assert.equal(res.status, 201);
  const data = res.json.data;
  assert.equal(data.amountRupees, 9);
  assert.equal(data.upiId, "studykarle@oksbi");
  assert.ok(data.paymentReference);
  assert.ok(data.upiUri.indexOf("am=9.00") !== -1);
  assert.ok(data.upiUri.indexOf(data.paymentReference) !== -1);
  assert.ok(data.upiUri.indexOf("studykarle@oksbi") !== -1);
});

test("students can only read their own payment records", async function () {
  const a = await createStudent("Alice");
  const b = await createStudent("Bob");
  await paymentRequestModel.create({
    user_id: a.id,
    payment_reference: "SK-ALICE",
    amount_rupees: 9,
    status: "pending",
  });
  const own = await authedGet(a, "/api/payments/me");
  assert.equal(own.status, 200);
  assert.equal(own.json.data.payments.length, 1);
  assert.equal(own.json.data.payments[0].paymentReference, "SK-ALICE");

  const other = await authedGet(b, "/api/payments/" + (paymentRequests[0].id));
  assert.ok(other.status === 403 || other.status === 404);

  const spoof = await authedGet(b, "/api/payments/me?userId=" + a.id);
  assert.equal(spoof.status, 200);
  assert.equal(spoof.json.data.payments.length, 0);
});

test("students cannot approve payments", async function () {
  const student = await createStudent("Sneaky");
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-SNEAK",
    amount_rupees: 9,
    status: "pending",
  });
  const res = await mutating(student, "POST", "/api/admin/payments/" + pay.id + "/approve", {
    status: "approved",
    endsAt: "2099-12-31",
  });
  assert.equal(res.status, 403);
  const row = await paymentRequestModel.findById(pay.id);
  assert.equal(row.status, "pending");
});

test("admin can list pending payments and approve using server expiry", async function () {
  const student = await createStudent("Waiter");
  const admin = await createAdmin();
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-WAIT",
    amount_rupees: 9,
    status: "pending",
    proof_bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    proof_mime_type: "image/jpeg",
    proof_size_bytes: 4,
    submitted_at: new Date(),
  });
  const list = await authedGet(admin, "/api/admin/payments?status=pending");
  assert.equal(list.status, 200);
  assert.equal(list.json.data.payments.length, 1);

  const approve = await mutating(admin, "POST", "/api/admin/payments/" + pay.id + "/approve", {
    endsAt: "2001-01-01T00:00:00.000Z",
  });
  assert.equal(approve.status, 200);
  const row = await paymentRequestModel.findById(pay.id);
  assert.equal(row.status, "approved");
  assert.equal(row.reviewed_by, admin.id);
  const ent = await semesterAccessModel.findByUserId(student.id);
  assert.ok(ent);
  assert.equal(new Date(ent.ends_at).getUTCFullYear(), 2099);

  const shot = await authedGet(admin, "/api/admin/payments/" + pay.id + "/screenshot");
  assert.equal(shot.status, 200);
  assert.match(String(shot.headers["content-type"]), /image/);
});

test("students cannot fetch another student's payment screenshot", async function () {
  const student = await createStudent("Nosy");
  const other = await createStudent("Owner");
  const pay = await paymentRequestModel.create({
    user_id: other.id,
    payment_reference: "SK-SHOT",
    amount_rupees: 9,
    status: "pending",
    proof_bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    proof_mime_type: "image/jpeg",
  });
  const res = await authedGet(student, "/api/admin/payments/" + pay.id + "/screenshot");
  assert.equal(res.status, 403);
});

test("repeated checkout while pending reuses the same payment reference", async function () {
  const student = await createStudent("Repeat");
  const first = await mutating(student, "POST", "/api/payments/checkout", {});
  const second = await mutating(student, "POST", "/api/payments/checkout", {});
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(first.json.data.paymentReference, second.json.data.paymentReference);
  const pending = paymentRequests.filter(function (r) {
    return r.user_id === student.id && r.status === "pending";
  });
  assert.equal(pending.length, 1);
});

test("thumbnail endpoint returns an image, not the original PDF", async function () {
  const student = await createStudent("Thumbs");
  const res = await authedGet(student, "/api/drive/files/y1-pdf/thumbnail");
  assert.equal(res.status, 200);
  assert.match(String(res.headers["content-type"]), /image/);
  assert.equal(res.body.indexOf("%PDF"), -1);
});

test("Drive listing marks Year 1 files as locked for unpaid students", async function () {
  const student = await createStudent("Catalog");
  const y1Res = await authedGet(student, "/api/drive/nodes/year1-physics");
  assert.equal(y1Res.status, 200);
  const y1 = (y1Res.json.data.files || []).find(function (f) {
    return f.nodeId === "y1-pdf";
  });
  assert.equal(y1 && y1.protected, true);
  assert.equal(y1 && y1.canPreview, false);
  assert.equal(y1 && y1.canDownload, false);

  const y3Res = await authedGet(student, "/api/drive/nodes/year3");
  assert.equal(y3Res.status, 200);
  const y3 = (y3Res.json.data.files || []).find(function (f) {
    return f.nodeId === "y3-pdf";
  });
  assert.equal(y3 && y3.protected, false);
  assert.equal(y3 && y3.canPreview, true);
  assert.equal(y3 && y3.canDownload, false);

  const root = await authedGet(student, "/api/drive");
  assert.equal(root.status, 200);
  const misc = (root.json.data.files || []).find(function (f) {
    return f.nodeId === "misc-pdf";
  });
  assert.equal(misc && misc.protected, false);
  assert.equal(misc && misc.canPreview, true);
  assert.equal(misc && misc.canDownload, false);
});

test("search results include access flags for unpaid students", async function () {
  const student = await createStudent("SearchPay");
  const res = await authedGet(student, "/api/search?q=Year");
  assert.equal(res.status, 200);
  const rows = res.json.data || [];
  const y1 = rows.find(function (n) {
    return n.id === 11;
  });
  const y3 = rows.find(function (n) {
    return n.id === 33;
  });
  assert.equal(y1 && y1.protected, true);
  assert.equal(y1 && y1.canPreview, false);
  assert.equal(y1 && y1.canDownload, false);
  assert.equal(y3 && y3.protected, false);
  assert.equal(y3 && y3.canPreview, true);
  assert.equal(y3 && y3.canDownload, false);
});

test("saved listings include access flags for unpaid students", async function () {
  const student = await createStudent("SavedPay");
  savedFiles.set(student.id + ":y1-pdf", true);
  savedFiles.set(student.id + ":y3-pdf", true);
  const res = await authedGet(student, "/api/saved");
  assert.equal(res.status, 200);
  const notesRows = (res.json.data && res.json.data.notes) || [];
  const filesRows = (res.json.data && res.json.data.files) || [];
  const y1Note = notesRows.find(function (n) {
    return n.id === 11;
  });
  const y1File = filesRows.find(function (f) {
    return f.driveId === "y1-pdf";
  });
  const y3File = filesRows.find(function (f) {
    return f.driveId === "y3-pdf";
  });
  assert.equal(y1Note && y1Note.protected, true);
  assert.equal(y1Note && y1Note.canPreview, false);
  assert.equal(y1Note && y1Note.canDownload, false);
  assert.equal(y1File && y1File.protected, true);
  assert.equal(y1File && y1File.canPreview, false);
  assert.equal(y1File && y1File.canDownload, false);
  assert.equal(y3File && y3File.protected, false);
  assert.equal(y3File && y3File.canPreview, true);
  assert.equal(y3File && y3File.canDownload, false);
});

test("admins cannot start student checkout", async function () {
  const admin = await createAdmin();
  const res = await mutating(admin, "POST", "/api/payments/checkout", {});
  assert.equal(res.status, 403);
  assert.equal(paymentRequests.length, 0);
});

test("admins cannot submit payment proof", async function () {
  const admin = await createAdmin();
  const res = await mutating(admin, "POST", "/api/payments/submit", { utr: "ABC123" });
  assert.equal(res.status, 403);
});

test("admin cannot approve a pending payment that has no screenshot", async function () {
  const student = await createStudent("NoProof");
  const admin = await createAdmin();
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-NOPROOF",
    amount_rupees: 9,
    status: "pending",
  });
  const approve = await mutating(admin, "POST", "/api/admin/payments/" + pay.id + "/approve", {});
  assert.equal(approve.status, 400);
  const row = await paymentRequestModel.findById(pay.id);
  assert.equal(row.status, "pending");
  assert.equal(await semesterAccessModel.findByUserId(student.id), null);
});

test("repeat approval of an already approved payment is safe", async function () {
  const student = await createStudent("RepeatOk");
  const admin = await createAdmin();
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-REPEATOK",
    amount_rupees: 9,
    status: "pending",
    proof_bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    proof_mime_type: "image/jpeg",
    proof_size_bytes: 4,
    submitted_at: new Date(),
  });
  const first = await mutating(admin, "POST", "/api/admin/payments/" + pay.id + "/approve", {});
  assert.equal(first.status, 200);
  const ent = await semesterAccessModel.findByUserId(student.id);
  assert.ok(ent);
  const endsAt = ent.ends_at;
  const second = await mutating(admin, "POST", "/api/admin/payments/" + pay.id + "/approve", {});
  assert.equal(second.status, 200);
  const row = await paymentRequestModel.findById(pay.id);
  assert.equal(row.status, "approved");
  const again = await semesterAccessModel.findByUserId(student.id);
  assert.equal(again.id, ent.id);
  assert.equal(String(again.ends_at), String(endsAt));
  assert.equal(again.payment_request_id, pay.id);
});

test("approval does not persist when entitlement write fails", async function () {
  const student = await createStudent("TxnFail");
  const admin = await createAdmin();
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-TXNFAIL",
    amount_rupees: 9,
    status: "pending",
    proof_bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    proof_mime_type: "image/jpeg",
    proof_size_bytes: 4,
    submitted_at: new Date(),
  });
  const originalUpsert = semesterAccessModel.upsertForUser;
  semesterAccessModel.upsertForUser = async function () {
    throw new Error("entitlement write failed");
  };
  try {
    const approve = await mutating(admin, "POST", "/api/admin/payments/" + pay.id + "/approve", {});
    assert.ok(approve.status >= 500);
    const row = await paymentRequestModel.findById(pay.id);
    assert.equal(row.status, "pending");
    assert.equal(row.reviewed_by, null);
    assert.equal(await semesterAccessModel.findByUserId(student.id), null);
  } finally {
    semesterAccessModel.upsertForUser = originalUpsert;
  }
});

test("students cannot create downloadable share links that bypass the download ban", async function () {
  const student = await createStudent("ShareBypass");
  const created = await mutating(student, "POST", "/api/drive/files/y3-pdf/share", {
    permission: "download",
  });
  if (created.status === 201) {
    const token = created.json.data.token;
    const download = await sendRequest("GET", "/api/drive/shares/" + token + "/download", {});
    assert.notEqual(download.status, 200);
    assert.equal(streamedFiles.length, 0);
  } else {
    assert.ok(created.status === 403 || created.status === 402);
  }
});

test("access status for an approved student reports active entitlement", async function () {
  const student = await createStudent("Active");
  const pay = await paymentRequestModel.create({
    user_id: student.id,
    payment_reference: "SK-ACT",
    amount_rupees: 9,
    status: "approved",
  });
  await semesterAccessModel.upsertForUser(student.id, {
    payment_request_id: pay.id,
    ends_at: new Date("2099-12-31T18:30:00.000Z"),
  });
  const res = await authedGet(student, "/api/payments/access");
  assert.equal(res.status, 200);
  assert.equal(res.json.data.hasAccess, true);
  assert.equal(res.json.data.status, "approved");
});
