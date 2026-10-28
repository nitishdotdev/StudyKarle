// Login events in Admin → Overview → Recent Activity.
//
// No Postgres: the pdf_activity model is an in-memory double. Auth, CSRF,
// JWT cookies, admin authorization, and pdfActivityService run for real.
//
//   node --test test/login-activity.test.js

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.COOKIE_NAME = "studykarle_token";
process.env.RESEND_API_KEY = "re_dummy";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.AUTH_RATE_LIMIT_MAX = "1000";
process.env.AUTH_IP_RATE_LIMIT_MAX = "1000";
process.env.SENSITIVE_RATE_LIMIT_MAX = "1000";
process.env.OTP_REQUEST_RATE_LIMIT_MAX = "50";
process.env.OTP_IP_RATE_LIMIT_MAX = "50";
process.env.SESSION_RATE_LIMIT_MAX = "1000";
process.env.USER_RATE_LIMIT_MAX = "10000";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const http = require("http");
const bcrypt = require("bcryptjs");

function stubRel(rel, exports) {
  const full = require.resolve(path.join(__dirname, "..", "src", rel));
  require.cache[full] = { id: full, filename: full, loaded: true, exports };
}

stubRel("config/db.js", function () {
  throw new Error("database must not be touched in login-activity tests");
});

const users = new Map();
let nextUserId = 1;
const loginTickets = new Map();
let nextLoginTicketId = 1;
const activityRows = [];
let nextActivityId = 1;
let modelShouldThrow = false;

function resetState() {
  users.clear();
  nextUserId = 1;
  loginTickets.clear();
  nextLoginTicketId = 1;
  activityRows.length = 0;
  nextActivityId = 1;
  modelShouldThrow = false;
}

const userModel = {
  async create(data) {
    const email = String(data.email).toLowerCase();
    const row = {
      id: nextUserId++,
      name: data.name,
      email: email,
      password_hash: data.passwordHash || null,
      role: data.role || "student",
      google_sub: data.googleSub || null,
      avatar_url: data.avatarUrl || null,
      course: data.course || null,
      current_year: data.current_year || null,
      token_version: 0,
      created_at: new Date(),
    };
    users.set(email, row);
    users.set("id:" + row.id, row);
    if (row.google_sub) users.set("sub:" + row.google_sub, row);
    return row;
  },
  async findByEmail(email) {
    return users.get(String(email).toLowerCase()) || null;
  },
  async findById(id) {
    return users.get("id:" + id) || null;
  },
  async findPublicById(id) {
    return this.publicUser(users.get("id:" + id));
  },
  async count() {
    let n = 0;
    users.forEach(function (value, key) {
      if (String(key).indexOf("id:") === 0) n += 1;
    });
    return n;
  },
  publicUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      avatar_url: row.avatar_url,
      course: row.course,
      current_year: row.current_year,
      created_at: row.created_at,
      has_password: !!row.password_hash,
      google_linked: !!row.google_sub,
    };
  },
};

const ACTIVITY_TYPES = [
  "pdf_opened",
  "pdf_downloaded",
  "pdf_shared",
  "user_login",
];
const RESOURCE_TYPES = ["drive", "note"];
const DEFAULT_OPEN_DEDUP_WINDOW_MINUTES = 60;
const DEFAULT_LOGIN_DEDUP_WINDOW_MINUTES = 1;

const pdfActivityModel = {
  ACTIVITY_TYPES: ACTIVITY_TYPES.slice(),
  RESOURCE_TYPES: RESOURCE_TYPES.slice(),
  DEFAULT_OPEN_DEDUP_WINDOW_MINUTES: DEFAULT_OPEN_DEDUP_WINDOW_MINUTES,
  DEFAULT_LOGIN_DEDUP_WINDOW_MINUTES: DEFAULT_LOGIN_DEDUP_WINDOW_MINUTES,

  async record(data) {
    if (modelShouldThrow) throw new Error("db down");
    const activityType = String(data.activityType || "").toLowerCase();
    if (ACTIVITY_TYPES.indexOf(activityType) === -1) return false;
    if (!data.userId) return false;

    if (activityType === "user_login") {
      const rawWindow = data.dedupWindowMinutes;
      const windowMinutes =
        rawWindow === undefined || rawWindow === null
          ? DEFAULT_LOGIN_DEDUP_WINDOW_MINUTES
          : Number(rawWindow);
      const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
      const recentLogin = activityRows.find(function (row) {
        return (
          row.user_id === data.userId &&
          row.activity_type === "user_login" &&
          row.created_at > cutoff
        );
      });
      if (recentLogin) return false;
      activityRows.push({
        id: nextActivityId++,
        user_id: data.userId,
        activity_type: "user_login",
        resource_type: null,
        pdf_id: null,
        pdf_name: null,
        created_at: new Date(),
      });
      return true;
    }

    const resourceType = String(data.resourceType || "").toLowerCase();
    if (RESOURCE_TYPES.indexOf(resourceType) === -1) return false;
    if (!data.pdfId) return false;
    activityRows.push({
      id: nextActivityId++,
      user_id: data.userId,
      activity_type: activityType,
      resource_type: resourceType,
      pdf_id: String(data.pdfId),
      pdf_name: String(data.pdfName || "").slice(0, 255),
      created_at: new Date(),
    });
    return true;
  },

  async recent(limit) {
    const parsed = Number(limit);
    const rows = activityRows
      .slice()
      .sort(function (a, b) {
        return b.created_at.getTime() - a.created_at.getTime();
      });
    const sliced =
      Number.isFinite(parsed) && parsed > 0 ? rows.slice(0, parsed) : rows;
    return sliced.map(function (row) {
      const user = users.get("id:" + row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        userName: user ? user.name : null,
        userEmail: user ? user.email : null,
        activityType: row.activity_type,
        resourceType: row.resource_type,
        pdfId: row.pdf_id,
        pdfName: row.pdf_name,
        pdfExists: false,
        createdAt: row.created_at,
      };
    });
  },

  async clear() {
    const n = activityRows.length;
    activityRows.length = 0;
    return n;
  },
};

stubRel("models/userModel.js", userModel);
stubRel("models/pdfActivityModel.js", pdfActivityModel);
stubRel("models/oauthLoginTicketModel.js", {
  async create(data) {
    const row = {
      id: nextLoginTicketId++,
      user_id: data.userId,
      ticket_hash: data.ticketHash,
      expires_at: data.expiresAt,
      consumed_at: null,
    };
    loginTickets.set(row.id, row);
    return row;
  },
  async findValidByHash(hash) {
    for (const t of loginTickets.values()) {
      if (
        t.ticket_hash === hash &&
        !t.consumed_at &&
        new Date(t.expires_at).getTime() > Date.now()
      ) {
        return t;
      }
    }
    return null;
  },
  async consume(id) {
    const t = loginTickets.get(id);
    if (!t || t.consumed_at) return 0;
    t.consumed_at = new Date();
    return 1;
  },
});
stubRel("models/googleLinkChallengeModel.js", {
  create: async () => ({}),
  findValidByHash: async () => null,
  consume: async () => 1,
});
stubRel("models/passwordResetAuthorizationModel.js", {
  create: async () => ({}),
  findValidByHash: async () => null,
  consume: async () => 1,
  consumeAllForUser: async () => 1,
});
stubRel("models/otpVerificationModel.js", {});
stubRel("models/noteModel.js", {
  async countAll() {
    return 0;
  },
  async sumSizeBytes() {
    return 0;
  },
  async findRecent() {
    return [];
  },
});
stubRel("models/viewHistoryModel.js", {
  async totalViews() {
    return 0;
  },
});
stubRel("models/adminActivityModel.js", {
  async recent() {
    return [];
  },
});
stubRel("models/savedNoteModel.js", {});
stubRel("models/subjectModel.js", {});
stubRel("services/noteService.js", {
  parsePagination: function () {
    return { page: 1, limit: 12 };
  },
  buildMeta: function () {
    return {};
  },
});
stubRel("services/adminNoteService.js", {});
stubRel("services/emailService.js", {
  sendEmail: async function () {
    return { id: "em_test" };
  },
});

const pdfActivityService = require("../src/services/pdfActivityService");
const tokenService = require("../src/services/tokenService");
const { hmacSha256, randomToken } = require("../src/utils/cryptoHash");

const express = require("express");
const cookieParser = require("cookie-parser");
const authRoutes = require("../src/routes/authRoutes");
const adminRoutes = require("../src/routes/adminRoutes");
const csrf = require("../src/middleware/csrfProtection");
const errorHandler = require("../src/middleware/errorHandler");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.get("/api/csrf-token", csrf.issueToken);
app.use("/api", csrf);
app.use("/api/auth", authRoutes);
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

let ipCounter = 0;
function newIp() {
  ipCounter += 1;
  return "203.0.113." + ipCounter;
}

let csrfState = null;
function fetchCsrf() {
  if (csrfState) return Promise.resolve(csrfState);
  return sendRequest("GET", "/api/csrf-token", {}).then(function (res) {
    const cookies = (res.setCookie || [])
      .map(function (c) {
        return c.split(";")[0];
      })
      .join("; ");
    csrfState = {
      token: res.json && res.json.data ? res.json.data.csrfToken : null,
      cookie: cookies,
    };
    return csrfState;
  });
}

function sendRequest(method, urlPath, opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    const headers = {
      "content-type": "application/json",
      "x-forwarded-for": opts.ip || newIp(),
    };
    if (opts.xrw !== false) headers["x-requested-with"] = "XMLHttpRequest";
    const cookies = [];
    if (opts.cookie) cookies.push(opts.cookie);
    if (opts.csrfCookie) cookies.push(opts.csrfCookie);
    if (cookies.length) headers.cookie = cookies.join("; ");
    if (opts.csrfToken) headers["x-csrf-token"] = opts.csrfToken;
    const r = http.request(
      { port: port, method: method, path: urlPath, headers: headers },
      function (res) {
        let data = "";
        res.on("data", function (c) {
          data += c;
        });
        res.on("end", function () {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (e) {
            json = null;
          }
          resolve({
            status: res.statusCode,
            setCookie: res.headers["set-cookie"] || [],
            json: json,
          });
        });
      }
    );
    r.on("error", reject);
    if (opts.body) r.write(JSON.stringify(opts.body));
    r.end();
  });
}

function request(method, urlPath, opts) {
  opts = opts || {};
  const mutating =
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (!mutating) return sendRequest(method, urlPath, opts);
  return fetchCsrf().then(function (csrfInfo) {
    return sendRequest(
      method,
      urlPath,
      Object.assign({}, opts, {
        csrfCookie: csrfInfo.cookie,
        csrfToken: csrfInfo.token,
      })
    );
  });
}

function authCookie(user) {
  return "studykarle_token=" + tokenService.signToken(user.id, user.token_version || 0);
}

async function seedStudent(name, email, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  return userModel.create({
    name: name,
    email: email,
    passwordHash: passwordHash,
    role: "student",
  });
}

async function seedAdmin() {
  const passwordHash = await bcrypt.hash("AdminPass1", 10);
  return userModel.create({
    name: "Admin User",
    email: "admin@test.com",
    passwordHash: passwordHash,
    role: "admin",
  });
}

test.beforeEach(resetState);

test("recordLogin creates a user_login row with user id and timestamp", async function () {
  const student = await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  const inserted = await pdfActivityService.recordLogin(student.id);
  assert.equal(inserted, true);
  assert.equal(activityRows.length, 1);
  assert.equal(activityRows[0].activity_type, "user_login");
  assert.equal(activityRows[0].user_id, student.id);
  assert.equal(activityRows[0].resource_type, null);
  assert.ok(activityRows[0].created_at instanceof Date);
  assert.ok(Date.now() - activityRows[0].created_at.getTime() < 60 * 1000);
});

test("recordLogin within the dedup window does not create duplicates", async function () {
  const student = await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  await pdfActivityService.recordLogin(student.id);
  await pdfActivityService.recordLogin(student.id);
  await pdfActivityService.recordLogin(student.id);
  assert.equal(activityRows.length, 1);
});

test("recordLogin for a different user is recorded separately", async function () {
  const a = await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  const b = await seedStudent("Amit Kumar", "amit@example.com", "Secret123");
  await pdfActivityService.recordLogin(a.id);
  await pdfActivityService.recordLogin(b.id);
  assert.equal(activityRows.length, 2);
});

test("recordLogin without a user id is rejected", async function () {
  const inserted = await pdfActivityService.recordLogin(null);
  assert.equal(inserted, false);
  assert.equal(activityRows.length, 0);
});

test("recordLogin failures never reject", async function () {
  const student = await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  modelShouldThrow = true;
  const result = await pdfActivityService.recordLogin(student.id);
  assert.equal(result, false);
});

test("recent returns login events mixed with notes activity, newest first", async function () {
  const student = await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  await pdfActivityService.recordOpen(student.id, "drive", "file-1", "Engineering Mathematics notes");
  await new Promise(function (resolve) {
    setTimeout(resolve, 5);
  });
  await pdfActivityService.recordLogin(student.id);

  const rows = await pdfActivityService.recent(10);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].activityType, "user_login");
  assert.equal(rows[0].userName, "Rahul Sharma");
  assert.equal(rows[0].userEmail, "rahul@example.com");
  assert.equal(rows[1].activityType, "pdf_opened");
  assert.ok(new Date(rows[0].createdAt) >= new Date(rows[1].createdAt));
});

test("recent respects a result limit", async function () {
  const student = await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  await pdfActivityModel.record({
    userId: student.id,
    activityType: "user_login",
    dedupWindowMinutes: 0,
  });
  await pdfActivityService.recordOpen(student.id, "drive", "a", "A.pdf");
  await pdfActivityService.recordDownload(student.id, "drive", "a", "A.pdf");
  const rows = await pdfActivityService.recent(2);
  assert.equal(rows.length, 2);
});

test("POST /api/auth/login records exactly one user_login event", async function () {
  const student = await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  const res = await request("POST", "/api/auth/login", {
    body: { email: "rahul@example.com", password: "Secret123" },
  });
  assert.equal(res.status, 200);
  assert.equal(activityRows.length, 1);
  assert.equal(activityRows[0].activity_type, "user_login");
  assert.equal(activityRows[0].user_id, student.id);
});

test("invalid password does not record a login event", async function () {
  await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  const res = await request("POST", "/api/auth/login", {
    body: { email: "rahul@example.com", password: "WrongPass1" },
  });
  assert.equal(res.status, 401);
  assert.equal(activityRows.length, 0);
});

test("unknown email does not record a login event", async function () {
  const res = await request("POST", "/api/auth/login", {
    body: { email: "nobody@example.com", password: "Secret123" },
  });
  assert.equal(res.status, 401);
  assert.equal(activityRows.length, 0);
});

test("GET /api/auth/me does not record a login event", async function () {
  const student = await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  const res = await request("GET", "/api/auth/me", {
    cookie: authCookie(student),
  });
  assert.equal(res.status, 200);
  assert.equal(activityRows.length, 0);
});

test("POST /api/auth/google/complete records a login event after the ticket is consumed", async function () {
  const student = await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  const ticket = randomToken(32);
  const oauthLoginTicketModel = require("../src/models/oauthLoginTicketModel");
  await oauthLoginTicketModel.create({
    userId: student.id,
    ticketHash: hmacSha256("google:" + ticket),
    expiresAt: new Date(Date.now() + 2 * 60 * 1000),
  });
  const res = await request("POST", "/api/auth/google/complete", {
    body: { ticket: ticket },
  });
  assert.equal(res.status, 200);
  assert.equal(activityRows.length, 1);
  assert.equal(activityRows[0].activity_type, "user_login");
  assert.equal(activityRows[0].user_id, student.id);
});

test("expired google ticket does not record a login event", async function () {
  const res = await request("POST", "/api/auth/google/complete", {
    body: { ticket: "not-a-real-ticket" },
  });
  assert.equal(res.status, 401);
  assert.equal(activityRows.length, 0);
});

test("admin stats include login events; student cannot read them", async function () {
  const student = await seedStudent("Rahul Sharma", "rahul@example.com", "Secret123");
  const admin = await seedAdmin();
  await pdfActivityService.recordLogin(student.id);
  await pdfActivityService.recordOpen(student.id, "drive", "file-1", "Data Structures notes");

  const asAdmin = await request("GET", "/api/admin/stats", {
    cookie: authCookie(admin),
  });
  assert.equal(asAdmin.status, 200);
  assert.ok(Array.isArray(asAdmin.json.data.pdfActivity));
  const types = asAdmin.json.data.pdfActivity.map(function (row) {
    return row.activityType;
  });
  assert.ok(types.indexOf("user_login") !== -1);
  assert.ok(types.indexOf("pdf_opened") !== -1);
  const login = asAdmin.json.data.pdfActivity.find(function (row) {
    return row.activityType === "user_login";
  });
  assert.equal(login.userName, "Rahul Sharma");
  assert.equal(login.userEmail, "rahul@example.com");
  assert.ok(!login.password);
  assert.ok(!login.password_hash);
  assert.ok(!login.token);

  const asStudent = await request("GET", "/api/admin/stats", {
    cookie: authCookie(student),
  });
  assert.equal(asStudent.status, 403);

  const asStudentFeed = await request("GET", "/api/admin/pdf-activity", {
    cookie: authCookie(student),
  });
  assert.equal(asStudentFeed.status, 403);

  const anon = await request("GET", "/api/admin/pdf-activity", {});
  assert.equal(anon.status, 401);
});
