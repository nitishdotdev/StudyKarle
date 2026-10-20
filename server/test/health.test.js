process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.RESEND_API_KEY = "re_dummy";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const path = require("path");

function stub(rel, exports) {
  const full = require.resolve(path.join(__dirname, "..", "src", rel));
  require.cache[full] = {
    id: full,
    filename: full,
    loaded: true,
    exports: exports,
  };
}

stub("config/db.js", {
  raw: async function () {
    return { rows: [{ "?column?": 1 }] };
  },
});

const app = require("../src/app");

let server;
let port;

test.before(
  () =>
    new Promise(function (resolve) {
      server = app.listen(0, function () {
        port = server.address().port;
        resolve();
      });
    })
);

test.after(
  () =>
    new Promise(function (resolve) {
      server.close(resolve);
    })
);

function request(method, pathname, headers, body) {
  return new Promise(function (resolve, reject) {
    const req = http.request(
      { port: port, method: method, path: pathname, headers: headers || {} },
      function (res) {
        let data = "";
        res.on("data", function (chunk) {
          data += chunk;
        });
        res.on("end", function () {
          let bodyJson = data;
          try {
            bodyJson = JSON.parse(data);
          } catch (err) {
            bodyJson = data;
          }
          resolve({
            status: res.statusCode,
            body: bodyJson,
            headers: res.headers,
            keys:
              bodyJson && bodyJson.data ? Object.keys(bodyJson.data).sort() : [],
          });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function get(pathname) {
  return request("GET", pathname);
}

test("GET /health returns 200 with minimal payload on the real app", async () => {
  const res = await get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, "ok");
  assert.deepEqual(res.keys, ["status"]);
});

test("GET /api/health matches GET /health", async () => {
  const res = await get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, "ok");
  assert.deepEqual(res.keys, ["status"]);
});

test("GET /health does not require authentication", async () => {
  const res = await get("/health");
  assert.equal(res.status, 200);
  assert.notEqual(res.status, 401);
});

test("POST /api without X-Requested-With is rejected as CSRF", async () => {
  const res = await request(
    "POST",
    "/api/auth/login",
    { "content-type": "application/json" },
    "{}"
  );
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});

test("POST /api with X-Requested-With but no CSRF token is rejected", async () => {
  const res = await request(
    "POST",
    "/api/auth/login",
    {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
    "{}"
  );
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});

test("GET /api/csrf-token issues a token and a CSRF cookie", async () => {
  const res = await get("/api/csrf-token");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(typeof res.body.data.csrfToken, "string");
  assert.ok(res.body.data.csrfToken.length > 8);
  const setCookie = res.headers["set-cookie"] || [];
  assert.ok(
    setCookie.some(function (c) {
      return /csrf/i.test(c);
    }),
    "expected a CSRF cookie"
  );
});

test("POST /api with a mismatched CSRF cookie and header is rejected", async () => {
  const issued = await get("/api/csrf-token");
  const cookies = (issued.headers["set-cookie"] || [])
    .map(function (c) {
      return c.split(";")[0];
    })
    .join("; ");
  const res = await request(
    "POST",
    "/api/auth/login",
    {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
      "x-csrf-token": "not-the-issued-token",
      cookie: cookies,
    },
    "{}"
  );
  assert.equal(res.status, 403);
});

test("POST /api with a valid CSRF token is not a CSRF rejection", async () => {
  const issued = await get("/api/csrf-token");
  const token = issued.body.data.csrfToken;
  const cookies = (issued.headers["set-cookie"] || [])
    .map(function (c) {
      return c.split(";")[0];
    })
    .join("; ");
  const res = await request(
    "POST",
    "/api/auth/login",
    {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
      "x-csrf-token": token,
      cookie: cookies,
    },
    "{}"
  );
  assert.notEqual(res.status, 403);
  assert.equal(res.status, 400);
});

test("CORS preflight from an untrusted origin is rejected", async () => {
  const res = await request("OPTIONS", "/api/auth/login", {
    Origin: "https://evil.example",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers":
      "content-type,x-requested-with,x-csrf-token",
  });
  assert.ok(res.status >= 400);
  assert.notEqual(
    res.headers["access-control-allow-origin"],
    "https://evil.example"
  );
});

test("CORS preflight from a trusted origin is allowed", async () => {
  const res = await request("OPTIONS", "/api/auth/login", {
    Origin: "http://localhost:5173",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers":
      "content-type,x-requested-with,x-csrf-token",
  });
  assert.ok(res.status < 400);
  assert.equal(
    res.headers["access-control-allow-origin"],
    "http://localhost:5173"
  );
});
