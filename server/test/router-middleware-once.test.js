process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");

// Counters reset before each request to assert exact middleware execution counts.
let authCalls = 0;
let limiterCalls = 0;

// Stub userModel so real `authenticate` can verify JWTs without a live PostgreSQL instance.
const userModel = require("../src/models/userModel");
const usersById = {
  1: { id: 1, name: "Student", email: "student@example.com", role: "student", token_version: 0 },
  2: { id: 2, name: "Admin", email: "admin@example.com", role: "admin", token_version: 0 },
};
userModel.findById = async (id) => usersById[id] || null;
userModel.findPublicById = async (id) => usersById[id] || null;

// Wrap the real `authenticate` middleware in require.cache before loading routes.
const authPath = require.resolve("../src/middleware/authenticate");
const realAuthenticate = require(authPath);
require.cache[authPath].exports = function instrumentedAuthenticate(req, res, next) {
  authCalls += 1;
  return realAuthenticate(req, res, next);
};

// Wrap `authenticatedActionLimiter` in require.cache before loading routes.
const limiterPath = require.resolve("../src/middleware/rateLimiter");
const realLimiters = require(limiterPath);
const realAuthLimiter = realLimiters.authenticatedActionLimiter;
require.cache[limiterPath].exports = Object.assign({}, realLimiters, {
  authenticatedActionLimiter: function instrumentedAuthLimiter(req, res, next) {
    limiterCalls += 1;
    return realAuthLimiter(req, res, next);
  },
});

// Stub controllers to return 200 JSON without touching DB/Drive.
function stubController(relPath, methods) {
  const ctrl = require(relPath);
  for (const name of methods) {
    ctrl[name] = (req, res) => res.status(200).json({ ok: true, handler: name });
  }
}

stubController("../src/controllers/adminController", ["stats"]);
stubController("../src/controllers/savedController", ["list"]);
stubController("../src/controllers/searchController", ["search"]);
stubController("../src/controllers/noteController", ["getById"]);
stubController("../src/controllers/yearController", ["listYears", "getSubjectUnits"]);
stubController("../src/controllers/paymentController", ["offer"]);
stubController("../src/controllers/driveController", ["listRoot", "getSharedFile"]);
stubController("../src/controllers/userController", ["getMe"]);

const routes = require("../src/routes/index");
const errorHandler = require("../src/middleware/errorHandler");
const tokenService = require("../src/services/tokenService");

const studentCookie = "studykarle_token=" + tokenService.signToken(1, 0);
const adminCookie = "studykarle_token=" + tokenService.signToken(2, 0);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api", routes);
app.use((req, res) => res.status(404).json({ success: false, message: "Not found" }));
app.use(errorHandler);

let server;
let baseUrl;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function hit(path, cookie) {
  authCalls = 0;
  limiterCalls = 0;
  const headers = cookie ? { Cookie: cookie } : {};
  const res = await fetch(`${baseUrl}${path}`, { headers });
  return {
    status: res.status,
    authCalls,
    limiterCalls,
  };
}

test("authenticated endpoints execute authenticate and authenticatedActionLimiter exactly once", async () => {
  const cases = [
    { path: "/api/admin/stats", cookie: adminCookie },
    { path: "/api/saved", cookie: studentCookie },
    { path: "/api/search?q=physics", cookie: studentCookie },
    { path: "/api/notes/1", cookie: studentCookie },
    { path: "/api/years", cookie: studentCookie },
    { path: "/api/subjects/1/units", cookie: studentCookie },
    { path: "/api/payments/offer", cookie: studentCookie },
    { path: "/api/drive", cookie: studentCookie },
    { path: "/api/users/me", cookie: studentCookie },
  ];

  for (const c of cases) {
    const result = await hit(c.path, c.cookie);
    assert.equal(result.status, 200, `${c.path} should return 200`);
    assert.equal(result.authCalls, 1, `${c.path} should run authenticate once`);
    assert.equal(
      result.limiterCalls,
      1,
      `${c.path} should run authenticatedActionLimiter once`
    );
  }
});

test("unauthenticated requests to protected routes run authenticate once and return 401", async () => {
  const protectedPaths = [
    "/api/admin/stats",
    "/api/saved",
    "/api/search?q=physics",
    "/api/notes/1",
    "/api/years",
    "/api/subjects/1/units",
    "/api/payments/offer",
    "/api/drive",
    "/api/users/me",
  ];

  for (const p of protectedPaths) {
    const result = await hit(p, null);
    assert.equal(result.status, 401, `${p} should return 401 without cookie`);
    assert.equal(result.authCalls, 1, `${p} should run authenticate once`);
    assert.equal(result.limiterCalls, 0, `${p} should not consume limiter on 401`);
  }
});

test("non-admin student on /api/admin/stats runs authenticate once and returns 403", async () => {
  const result = await hit("/api/admin/stats", studentCookie);
  assert.equal(result.status, 403);
  assert.equal(result.authCalls, 1);
  assert.equal(result.limiterCalls, 0);
});

test("public drive share endpoint bypasses authenticate and authenticatedActionLimiter", async () => {
  const result = await hit("/api/drive/shares/public-token-123", null);
  assert.equal(result.status, 200);
  assert.equal(result.authCalls, 0);
  assert.equal(result.limiterCalls, 0);
});

test("unknown /api path falls through to 404 without triggering auth or rate limiters", async () => {
  const result = await hit("/api/nonexistent-endpoint", null);
  assert.equal(result.status, 404);
  assert.equal(result.authCalls, 0);
  assert.equal(result.limiterCalls, 0);
});
