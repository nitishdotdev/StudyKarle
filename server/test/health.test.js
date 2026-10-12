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

function get(pathname) {
  return new Promise(function (resolve, reject) {
    const req = http.request(
      { port: port, method: "GET", path: pathname },
      function (res) {
        let data = "";
        res.on("data", function (chunk) {
          data += chunk;
        });
        res.on("end", function () {
          let body = data;
          try {
            body = JSON.parse(data);
          } catch (err) {
            body = data;
          }
          resolve({
            status: res.statusCode,
            body: body,
            keys: body && body.data ? Object.keys(body.data).sort() : [],
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
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
