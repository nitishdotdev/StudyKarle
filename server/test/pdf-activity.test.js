// Integration tests for the PDF user-activity feature that powers
// Admin → Overview → Recent Activity.
//
// Run against a dedicated local database (see README of this folder):
//
//   DB_HOST=127.0.0.1 DB_NAME=studykarle_test DB_USER=postgres \
//   DB_PASSWORD=postgres node --test test/pdf-activity.test.js
//
// The tests boot the real Express app on an ephemeral port, sign real JWTs,
// seed real rows, and stub only `driveService.streamFile` (Google Drive is not
// available in CI). Everything else — auth middleware, admin authorization,
// the activity model/service, CSRF on DELETE — runs against the real code.

process.env.NODE_ENV = "development";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "5432";
process.env.DB_NAME = "studykarle_test";
process.env.DB_USER = "postgres";
process.env.DB_PASSWORD = "postgres";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.COOKIE_NAME = "studykarle_token";
process.env.DRIVE_SYNC_ON_START = "false";
process.env.USER_RATE_LIMIT_MAX = "10000";
// emailService constructs `new Resend(...)` at module load, so a dummy key
// (never sent to) keeps the auth router requireable in tests.
process.env.RESEND_API_KEY = "re_test_dummy_key";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../src/config/db");
const userModel = require("../src/models/userModel");
const pdfActivityModel = require("../src/models/pdfActivityModel");
const pdfActivityService = require("../src/services/pdfActivityService");
const adminActivityModel = require("../src/models/adminActivityModel");
const viewHistoryModel = require("../src/models/viewHistoryModel");
const tokenService = require("../src/services/tokenService");
const driveService = require("../src/services/driveService");
const app = require("../src/app");

let server;
let port;
let admin;
let student;
let driveFileId;
let noteId;
let orphanPdfId; // drive id with no row in drive_nodes (simulates a deleted PDF)

const EMPTY_STREAM = { status: 200, headers: {}, data: null };

async function resetTables() {
  await db("pdf_activity").del();
  await db("view_history").del();
  await db("drive_shares").del();
  await db("notes").del();
  await db("drive_nodes").del();
  await db("admin_activity").del();
  await db("users").del();
  await db("subjects").del();
  await db("semesters").del();
  await db("years").del();
}

async function seedData() {
  const year = (await db("years").insert({ label: "Year 1", order_index: 1 }).returning("id"))[0];
  const sem = (
    await db("semesters")
      .insert({ year_id: year.id, label: "Semester 1", order_index: 1 })
      .returning("id")
  )[0];
  const subject = (
    await db("subjects")
      .insert({ semester_id: sem.id, name: "DBMS" })
      .returning("id")
  )[0];

  const adminUser = await userModel.create({
    name: "Admin User",
    email: "admin@test.com",
    passwordHash: "x",
    role: "admin",
  });
  const studentUser = await userModel.create({
    name: "Nitish Singh",
    email: "nitish@test.com",
    passwordHash: "x",
    role: "student",
  });

  driveFileId = "drive_file_" + Math.random().toString(36).slice(2);
  orphanPdfId = "deleted_drive_file_xyz";

  await db("drive_nodes").insert({
    drive_id: driveFileId,
    parent_drive_id: null,
    name: "DBMS Unit 1 Notes.pdf",
    mime_type: "application/pdf",
    kind: "file",
    depth: 1,
    path: "DBMS Unit 1 Notes.pdf",
  });

  const note = (
    await db("notes")
      .insert({
        subject_id: subject.id,
        title: "Operating Systems Notes.pdf",
        drive_file_id: "note_drive_placeholder",
        file_type: "pdf",
        status: "published",
        uploaded_by: adminUser.id,
      })
      .returning("id")
  )[0];
  noteId = note.id;

  return { adminUser, studentUser };
}

function authCookie(user) {
  return "studykarle_token=" + tokenService.signToken(user.id);
}

let csrfState = null;

async function fetchCsrf() {
  if (csrfState) return csrfState;
  const res = await fetch("http://127.0.0.1:" + port + "/api/csrf-token");
  const json = await res.json();
  const raw = res.headers.get("set-cookie") || "";
  const cookies = raw
    .split(/,(?=\s*[A-Za-z0-9_\-]+=)/)
    .map(function (c) {
      return c.split(";")[0].trim();
    })
    .filter(Boolean)
    .join("; ");
  csrfState = {
    token: json && json.data ? json.data.csrfToken : null,
    cookie: cookies,
  };
  return csrfState;
}

async function api(method, path, { user, body, headers } = {}) {
  const mutating =
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const csrfInfo = mutating ? await fetchCsrf() : null;
  const cookies = [];
  if (user) cookies.push(authCookie(user));
  if (csrfInfo && csrfInfo.cookie) cookies.push(csrfInfo.cookie);
  const requestHeaders = Object.assign(
    {
      Cookie: cookies.join("; "),
    },
    headers || {}
  );
  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }
  if (csrfInfo && csrfInfo.token && !requestHeaders["X-CSRF-Token"]) {
    requestHeaders["X-CSRF-Token"] = csrfInfo.token;
  }
  const res = await fetch("http://127.0.0.1:" + port + path, {
    method: method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    // non-JSON response (e.g. streaming PDF) — fine
  }
  return { status: res.status, body: json };
}

function streamFileStub(resolves) {
  driveService.streamFile = resolves
    ? async function (driveFileId, res) {
        // Real streamFile pipes Drive bytes into `res`, ending it; the stub
        // must end the response too or the client request hangs.
        res.end();
        return EMPTY_STREAM;
      }
    : async function () {
        throw new Error("drive stream failed");
      };
}

// Controllers record activity AFTER the PDF stream has ended, so the client
// can observe a completed response a few ms before the INSERT commits. Poll
// briefly for the expected rows instead of asserting on a single snapshot.
async function waitForActivityRows(expected, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 2000);
  let got = [];
  while (Date.now() < deadline) {
    const rows = await db("pdf_activity")
      .select("activity_type", "resource_type", "pdf_id")
      .orderBy("id");
    got = rows.map(function (r) {
      return { type: r.activity_type, resource: r.resource_type, pdf: r.pdf_id };
    });
    if (JSON.stringify(got) === JSON.stringify(expected)) {
      return got;
    }
    await new Promise(function (resolve) {
      setTimeout(resolve, 25);
    });
  }
  return got;
}

before(async function () {
  await resetTables();
  const seeded = await seedData();
  admin = seeded.adminUser;
  student = seeded.studentUser;

  await new Promise(function (resolve) {
    server = app.listen(0, "127.0.0.1", function () {
      port = server.address().port;
      resolve();
    });
  });
});

after(async function () {
  if (server) {
    await new Promise(function (resolve) {
      server.close(resolve);
    });
  }
  await db.destroy();
});

beforeEach(async function () {
  await db("pdf_activity").del();
  await db("view_history").del();
  await db("drive_shares").del();
});

// ------------------------------------------------------------------
// Model / service: recording
// ------------------------------------------------------------------

test("recordOpen creates a pdf_opened row with correct user, pdf and timestamp", async function () {
  const inserted = await pdfActivityService.recordOpen(
    student.id,
    "drive",
    driveFileId,
    "DBMS Unit 1 Notes.pdf"
  );
  assert.equal(inserted, true);

  const rows = await db("pdf_activity")
    .where({ activity_type: "pdf_opened" })
    .select("*");
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.user_id, student.id);
  assert.equal(row.resource_type, "drive");
  assert.equal(row.pdf_id, driveFileId);
  assert.equal(row.pdf_name, "DBMS Unit 1 Notes.pdf");
  assert.ok(row.created_at instanceof Date);
  assert.ok(Date.now() - row.created_at.getTime() < 60 * 1000);
});

test("recordOpen within the dedup window does not create duplicates", async function () {
  await pdfActivityService.recordOpen(student.id, "drive", driveFileId, "A.pdf");
  // Simulates React re-renders / remounts / pdf.js Range requests.
  await pdfActivityService.recordOpen(student.id, "drive", driveFileId, "A.pdf");
  await pdfActivityService.recordOpen(student.id, "drive", driveFileId, "A.pdf");

  const rows = await db("pdf_activity")
    .where({
      user_id: student.id,
      resource_type: "drive",
      pdf_id: driveFileId,
      activity_type: "pdf_opened",
    })
    .select("*");
  assert.equal(rows.length, 1);
});

test("reopening a PDF after the dedup window records a new event", async function () {
  // A zero-width window means the previous open is already outside the window,
  // modelling a genuine later re-open of the same PDF.
  const first = await pdfActivityModel.record({
    userId: student.id,
    resourceType: "drive",
    pdfId: driveFileId,
    pdfName: "A.pdf",
    activityType: "pdf_opened",
    dedupWindowMinutes: 60,
  });
  assert.equal(first, true);

  const second = await pdfActivityModel.record({
    userId: student.id,
    resourceType: "drive",
    pdfId: driveFileId,
    pdfName: "A.pdf",
    activityType: "pdf_opened",
    dedupWindowMinutes: 0,
  });
  assert.equal(second, true);

  const rows = await db("pdf_activity")
    .where({ user_id: student.id, pdf_id: driveFileId, activity_type: "pdf_opened" })
    .select("*");
  assert.equal(rows.length, 2);
});

test("recordDownload and recordShare create their own rows", async function () {
  await pdfActivityService.recordDownload(student.id, "drive", driveFileId, "B.pdf");
  await pdfActivityService.recordShare(student.id, "drive", driveFileId, "B.pdf");

  const types = await db("pdf_activity").select("activity_type").orderBy("id");
  assert.deepEqual(
    types.map(function (r) {
      return r.activity_type;
    }),
    ["pdf_downloaded", "pdf_shared"]
  );
});

test("invalid activity type and missing user are rejected", async function () {
  const invalid = await pdfActivityModel.record({
    userId: student.id,
    resourceType: "drive",
    pdfId: driveFileId,
    pdfName: "X.pdf",
    activityType: "pdf_hacked",
  });
  assert.equal(invalid, false);

  const noUser = await pdfActivityModel.record({
    userId: null,
    resourceType: "drive",
    pdfId: driveFileId,
    pdfName: "X.pdf",
    activityType: "pdf_downloaded",
  });
  assert.equal(noUser, false);

  const count = await db("pdf_activity").count("id as c").first();
  assert.equal(Number(count.c), 0);
});

test("activity failures never reject (secondary concern)", async function () {
  // Permanently break the table; service must swallow and return false.
  await db.schema.alterTable("pdf_activity", function (t) {
    t.dropColumn("pdf_name");
  });
  const result = await pdfActivityService.recordDownload(student.id, "drive", driveFileId, "C.pdf");
  assert.equal(result, false);
  await db.schema.alterTable("pdf_activity", function (t) {
    t.string("pdf_name", 255).notNullable().defaultTo("");
  });
});

// ------------------------------------------------------------------
// Model / service: recent + clear
// ------------------------------------------------------------------

test("recent returns newest-first rows joined with user name", async function () {
  await pdfActivityService.recordOpen(student.id, "drive", driveFileId, "DBMS Unit 1 Notes.pdf");
  await pdfActivityService.recordDownload(student.id, "note", String(noteId), "Operating Systems Notes.pdf");
  await pdfActivityService.recordOpen(admin.id, "drive", driveFileId, "DBMS Unit 1 Notes.pdf");

  const rows = await pdfActivityService.recent(10);
  assert.equal(rows.length, 3);

  // Newest first.
  for (let i = 1; i < rows.length; i++) {
    assert.ok(new Date(rows[i - 1].createdAt) >= new Date(rows[i].createdAt));
  }

  const openByStudent = rows.find(function (r) {
    return r.userName === "Nitish Singh" && r.activityType === "pdf_opened";
  });
  assert.ok(openByStudent);
  assert.equal(openByStudent.pdfId, driveFileId);
  assert.equal(openByStudent.pdfName, "DBMS Unit 1 Notes.pdf");
  assert.equal(openByStudent.pdfExists, true);

  const noteDownload = rows.find(function (r) {
    return r.activityType === "pdf_downloaded";
  });
  assert.equal(noteDownload.resourceType, "note");
  assert.equal(noteDownload.pdfId, String(noteId));
  assert.equal(noteDownload.pdfExists, true);
});

test("recent handles deleted users and deleted PDFs without crashing", async function () {
  // Throwaway user so the shared `student`/`admin` fixtures stay valid for
  // later authorization tests.
  const ghost = await userModel.create({
    name: "Ghost User",
    email: "ghost@test.com",
    passwordHash: "x",
    role: "student",
  });
  await pdfActivityService.recordOpen(ghost.id, "drive", orphanPdfId, "Deleted File.pdf");

  // Delete the user (ON DELETE SET NULL) and re-query.
  await db("users").where({ id: ghost.id }).del();
  const rows = await pdfActivityService.recent(10);
  const orphan = rows.find(function (r) {
    return r.pdfId === orphanPdfId;
  });
  assert.ok(orphan);
  assert.equal(orphan.userName, null);
  assert.equal(orphan.pdfName, "Deleted File.pdf");
  assert.equal(orphan.pdfExists, false);
});

test("clear removes only pdf_activity rows", async function () {
  await pdfActivityService.recordOpen(student.id, "drive", driveFileId, "A.pdf");
  await adminActivityModel.log(admin.id, "note.create", "note", 1, {});
  await viewHistoryModel.record(student.id, noteId);

  const cleared = await pdfActivityService.clear();
  assert.ok(cleared >= 1);

  const remainingActivity = await db("pdf_activity").count("id as c").first();
  assert.equal(Number(remainingActivity.c), 0);

  const adminActivityCount = await db("admin_activity").count("id as c").first();
  assert.ok(Number(adminActivityCount.c) >= 1);
  const viewHistoryCount = await db("view_history").count("id as c").first();
  assert.ok(Number(viewHistoryCount.c) >= 1);

  // New activity can still be recorded after clearing.
  const after = await pdfActivityService.recordOpen(student.id, "drive", driveFileId, "Post-clear.pdf");
  assert.equal(after, true);
  const postClear = await db("pdf_activity").count("id as c").first();
  assert.equal(Number(postClear.c), 1);
});

// ------------------------------------------------------------------
// API: tracking wired into preview / download / share
// ------------------------------------------------------------------

test("drive preview and download record activity only on success", async function () {
  streamFileStub(true);
  // Hit the preview endpoint several times (simulating pdf.js Range requests /
  // React re-renders / remounts). Dedup must collapse them into one open.
  const preview1 = await api("GET", "/api/drive/files/" + driveFileId + "/preview", {
    user: student,
  });
  const preview2 = await api("GET", "/api/drive/files/" + driveFileId + "/preview", {
    user: student,
  });
  const preview3 = await api("GET", "/api/drive/files/" + driveFileId + "/preview", {
    user: student,
  });
  assert.equal(preview1.status, 200);
  assert.equal(preview2.status, 200);
  assert.equal(preview3.status, 200);

  const download = await api("GET", "/api/drive/files/" + driveFileId + "/download", {
    user: student,
  });
  assert.equal(download.status, 200);

  const got = await waitForActivityRows([
    { type: "pdf_opened", resource: "drive", pdf: driveFileId },
    { type: "pdf_downloaded", resource: "drive", pdf: driveFileId },
  ]);
  assert.deepEqual(got, [
    { type: "pdf_opened", resource: "drive", pdf: driveFileId },
    { type: "pdf_downloaded", resource: "drive", pdf: driveFileId },
  ]);
});

test("failed preview does not create a false open event", async function () {
  streamFileStub(false);
  const res = await api("GET", "/api/drive/files/" + driveFileId + "/preview", {
    user: student,
  });
  assert.equal(res.status, 500);

  const rows = await db("pdf_activity")
    .where({ activity_type: "pdf_opened" })
    .select("*");
  assert.equal(rows.length, 0);
});

test("failed download does not create a false download event", async function () {
  streamFileStub(false);
  const res = await api("GET", "/api/drive/files/" + driveFileId + "/download", {
    user: student,
  });
  assert.equal(res.status, 500);

  const rows = await db("pdf_activity")
    .where({ activity_type: "pdf_downloaded" })
    .select("*");
  assert.equal(rows.length, 0);
});

test("legacy note preview and download record activity", async function () {
  streamFileStub(true);
  const preview = await api("GET", "/api/notes/" + noteId + "/preview", { user: student });
  assert.equal(preview.status, 200);
  const download = await api("GET", "/api/notes/" + noteId + "/download", { user: student });
  assert.equal(download.status, 200);

  const got = await waitForActivityRows([
    { type: "pdf_opened", resource: "note", pdf: String(noteId) },
    { type: "pdf_downloaded", resource: "note", pdf: String(noteId) },
  ]);
  assert.deepEqual(got, [
    { type: "pdf_opened", resource: "note", pdf: String(noteId) },
    { type: "pdf_downloaded", resource: "note", pdf: String(noteId) },
  ]);
});

test("creating a share link records pdf_shared; mere listing does not", async function () {
  streamFileStub(true);

  // Listing shares / viewing the file must NOT create a share event.
  await api("GET", "/api/drive/files/" + driveFileId + "/share", { user: student });
  let count = await db("pdf_activity").where({ activity_type: "pdf_shared" }).count("id as c").first();
  assert.equal(Number(count.c), 0);

  const created = await api(
    "POST",
    "/api/drive/files/" + driveFileId + "/share",
    { user: student, body: { permission: "download" }, headers: { "X-Requested-With": "XMLHttpRequest" } }
  );
  assert.equal(created.status, 201);

  count = await db("pdf_activity")
    .where({ activity_type: "pdf_shared", user_id: student.id, pdf_id: driveFileId })
    .count("id as c")
    .first();
  assert.equal(Number(count.c), 1);
});

// ------------------------------------------------------------------
// API: admin-only authorization
// ------------------------------------------------------------------

test("admin can retrieve activity; student gets 403; anonymous gets 401", async function () {
  await pdfActivityService.recordOpen(student.id, "drive", driveFileId, "DBMS Unit 1 Notes.pdf");

  const asAdmin = await api("GET", "/api/admin/pdf-activity", { user: admin });
  assert.equal(asAdmin.status, 200);
  assert.ok(Array.isArray(asAdmin.body.data));
  assert.equal(asAdmin.body.data.length, 1);
  assert.equal(asAdmin.body.data[0].userName, "Nitish Singh");

  const asStudent = await api("GET", "/api/admin/pdf-activity", { user: student });
  assert.equal(asStudent.status, 403);

  const anon = await api("GET", "/api/admin/pdf-activity", {});
  assert.equal(anon.status, 401);
});

test("admin stats include pdfActivity; normal user cannot access stats", async function () {
  await pdfActivityService.recordOpen(student.id, "drive", driveFileId, "DBMS Unit 1 Notes.pdf");

  const asAdmin = await api("GET", "/api/admin/stats", { user: admin });
  assert.equal(asAdmin.status, 200);
  assert.ok(Array.isArray(asAdmin.body.data.pdfActivity));
  assert.equal(asAdmin.body.data.pdfActivity[0].pdfName, "DBMS Unit 1 Notes.pdf");

  const asStudent = await api("GET", "/api/admin/stats", { user: student });
  assert.equal(asStudent.status, 403);
});

test("admin can clear activity; student cannot; clear needs CSRF header", async function () {
  await pdfActivityService.recordOpen(student.id, "drive", driveFileId, "A.pdf");

  // Student clear → 403, rows untouched.
  const studentClear = await api(
    "DELETE",
    "/api/admin/pdf-activity",
    { user: student, headers: { "X-Requested-With": "XMLHttpRequest" } }
  );
  assert.equal(studentClear.status, 403);

  // Missing CSRF header → 403 (CSRF middleware), rows untouched.
  const noCsrf = await api("DELETE", "/api/admin/pdf-activity", { user: admin });
  assert.equal(noCsrf.status, 403);
  let count = await db("pdf_activity").count("id as c").first();
  assert.equal(Number(count.c), 1);

  // Admin clear → 200, rows gone.
  const adminClear = await api(
    "DELETE",
    "/api/admin/pdf-activity",
    { user: admin, headers: { "X-Requested-With": "XMLHttpRequest" } }
  );
  assert.equal(adminClear.status, 200);
  assert.equal(adminClear.body.data.cleared, true);
  count = await db("pdf_activity").count("id as c").first();
  assert.equal(Number(count.c), 0);
});

test("admin activity endpoint (admin_activity) is unaffected", async function () {
  await adminActivityModel.log(admin.id, "note.create", "note", 1, {});
  const res = await api("GET", "/api/admin/activity", { user: admin });
  assert.equal(res.status, 200);
  const actions = res.body.data.map(function (r) {
    return r.action;
  });
  assert.ok(actions.indexOf("note.create") !== -1);
});
