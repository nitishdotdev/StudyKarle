// Regression tests for the production HTTP 429 auth incident.
// No database or email provider needed: the controller and user model are
// stubbed, everything else (validators, limiters, authenticate, JWT) is real.
//
//   node --test test/auth-rate-limits.test.js

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_change_me";
process.env.RESEND_API_KEY = "re_dummy";
process.env.AUTH_RATE_LIMIT_MAX = "3";
process.env.AUTH_IP_RATE_LIMIT_MAX = "6";
process.env.OTP_REQUEST_RATE_LIMIT_MAX = "3";
process.env.OTP_IP_RATE_LIMIT_MAX = "5";
process.env.SESSION_RATE_LIMIT_MAX = "30";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const http = require("http");

function stub(rel, exports) {
  const full = require.resolve(path.join(__dirname, "..", "src", rel));
  require.cache[full] = {
    id: full,
    filename: full,
    loaded: true,
    exports: exports,
  };
}

const ok = (res) => res.status(200).json({ success: true, data: {} });
stub("controllers/authController.js", {
  login: (req, res) => {
    if (req.body.password === "DbDown123") {
      return res.status(500).json({ success: false });
    }
    if (req.body.password === "Correct123") return ok(res);
    return res
      .status(401)
      .json({ success: false, message: "Invalid email or password" });
  },
  signup: (req, res) => ok(res),
  requestOtp: (req, res) =>
    req.body.name === "DbDown"
      ? res.status(500).json({ success: false })
      : ok(res),
  verifyOtp: (req, res) => ok(res),
  resendOtp: (req, res) => ok(res),
  logout: (req, res) => ok(res),
  me: (req, res) => res.status(200).json({ success: true, data: req.user }),
});
stub("models/userModel.js", {
  findById: async (id) =>
    id === "u1"
      ? { id: "u1", name: "T", email: "t@x.com", role: "student" }
      : null,
});

const express = require("express");
const cookieParser = require("cookie-parser");
const authRoutes = require("../src/routes/authRoutes");
const csrf = require("../src/middleware/csrfProtection");
const errorHandler = require("../src/middleware/errorHandler");
const tokenService = require("../src/services/tokenService");
const env = require("../src/config/env");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use("/api", csrf);
app.use("/api/auth", authRoutes);
app.use(errorHandler);

let server;
let port;
test.before(
  () =>
    new Promise((r) => {
      server = app.listen(0, () => {
        port = server.address().port;
        r();
      });
    })
);
test.after(() => new Promise((r) => server.close(r)));

let ipCounter = 0;
function newIp() {
  ipCounter += 1;
  return "198.51.100." + ipCounter;
}

function call(method, url, ip, body, cookie) {
  return new Promise((resolve, reject) => {
    const headers = {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
      "x-forwarded-for": ip,
    };
    if (cookie) headers.cookie = cookie;
    const r = http.request(
      { port, method, path: "/api/auth" + url, headers },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            remaining: res.headers["x-ratelimit-remaining"],
            body: d,
          })
        );
      }
    );
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}
const login = (ip, email, password) =>
  call("POST", "/login", ip, { email, password });
const otp = (ip, email, name) =>
  call("POST", "/request-otp", ip, {
    name: name || "Test User",
    email,
    password: "Password1",
  });

test("5xx failures (DB outage) do not consume the login budget", async () => {
  const ip = newIp();
  for (let i = 0; i < 12; i++) {
    const res = await login(ip, "a@x.com", "DbDown123");
    assert.strictEqual(res.status, 500);
  }
  const after = await login(ip, "a@x.com", "Wrong1234");
  assert.strictEqual(after.status, 401);
  assert.notStrictEqual(after.status, 429);
  // Refund is proven by remaining quota: AUTH_RATE_LIMIT_MAX=3, one 401 spent,
  // twelve 500s refunded, so remaining is 2 — not 429 and not 0.
  assert.strictEqual(Number(after.remaining), 2);
  assert.strictEqual((await login(ip, "a@x.com", "Correct123")).status, 200);
});

test("5xx on request-otp does not consume the OTP budget", async () => {
  const ip = newIp();
  for (let i = 0; i < 10; i++) {
    assert.strictEqual((await otp(ip, "b@x.com", "DbDown")).status, 500);
  }
  const sent = await otp(ip, "b@x.com");
  assert.strictEqual(sent.status, 200);
  // OTP_REQUEST_RATE_LIMIT_MAX=3; ten 500s refunded; this success counts once.
  assert.strictEqual(Number(sent.remaining), 2);
});

test("repeated invalid credentials for one account are still blocked", async () => {
  const ip = newIp();
  for (let i = 0; i < 3; i++) {
    assert.strictEqual((await login(ip, "c@x.com", "Wrong1234")).status, 401);
  }
  const blocked = await login(ip, "c@x.com", "Wrong1234");
  assert.strictEqual(blocked.status, 429);
  assert.strictEqual(JSON.parse(blocked.body).success, false);
  assert.strictEqual((await login(ip, "c@x.com", "Correct123")).status, 429);
});

test("successful logins do not count toward the failure budget", async () => {
  const ip = newIp();
  for (let i = 0; i < 10; i++) {
    assert.strictEqual((await login(ip, "d@x.com", "Correct123")).status, 200);
  }
});

test("rotating email addresses from one IP hits the per-IP limit", async () => {
  const ip = newIp();
  for (let i = 0; i < 6; i++) {
    assert.strictEqual(
      (await login(ip, "rot" + i + "@x.com", "Wrong1234")).status,
      401
    );
  }
  assert.strictEqual((await login(ip, "rot-new@x.com", "Wrong1234")).status, 429);
});

test("lockout of one client IP does not affect another client IP", async () => {
  const bad = newIp();
  const good = newIp();
  for (let i = 0; i < 7; i++) await login(bad, "e@x.com", "Wrong1234");
  assert.strictEqual((await login(bad, "e@x.com", "Wrong1234")).status, 429);
  assert.strictEqual((await login(good, "e@x.com", "Wrong1234")).status, 401);
});

test("OTP: successful sends count per account and per IP", async () => {
  const ip = newIp();
  for (let i = 0; i < 3; i++) {
    assert.strictEqual((await otp(ip, "f@x.com")).status, 200);
  }
  assert.strictEqual((await otp(ip, "f@x.com")).status, 429);

  const ip2 = newIp();
  for (let i = 0; i < 5; i++) {
    assert.strictEqual((await otp(ip2, "g" + i + "@x.com")).status, 200);
  }
  assert.strictEqual((await otp(ip2, "g-new@x.com")).status, 429);
});

test("login lockout does not spend the OTP request budget", async () => {
  const ip = newIp();
  for (let i = 0; i < 3; i++) {
    assert.strictEqual((await login(ip, "split@x.com", "Wrong1234")).status, 401);
  }
  assert.strictEqual((await login(ip, "split@x.com", "Wrong1234")).status, 429);
  assert.strictEqual((await otp(ip, "split@x.com")).status, 200);
});

test("missing email still consumes the per-IP login budget", async () => {
  const ip = newIp();
  for (let i = 0; i < 6; i++) {
    const res = await call("POST", "/login", ip, { password: "Wrong1234" });
    assert.ok(res.status === 400 || res.status === 401 || res.status === 429);
  }
  const blocked = await login(ip, "fresh-missing@x.com", "Wrong1234");
  assert.strictEqual(blocked.status, 429);
});

test("normal session checks work repeatedly (valid and missing cookie)", async () => {
  const ip = newIp();
  const cookie = env.cookieName + "=" + tokenService.signToken("u1");
  for (let i = 0; i < 25; i++) {
    assert.strictEqual((await call("GET", "/me", ip, null, cookie)).status, 200);
  }
  const ip2 = newIp();
  for (let i = 0; i < 25; i++) {
    assert.strictEqual((await call("GET", "/me", ip2)).status, 401);
  }
});

test("login lockout does not block /me for the same IP", async () => {
  const ip = newIp();
  const cookie = env.cookieName + "=" + tokenService.signToken("u1");
  for (let i = 0; i < 8; i++) await login(ip, "h@x.com", "Wrong1234");
  assert.strictEqual((await login(ip, "h@x.com", "Wrong1234")).status, 429);
  assert.strictEqual((await call("GET", "/me", ip, null, cookie)).status, 200);
});

test("/me is limited per session so abuse is bounded, others unaffected", async () => {
  const ip = newIp();
  const cookie = env.cookieName + "=" + tokenService.signToken("u1");
  let last;
  for (let i = 0; i < 31; i++) last = await call("GET", "/me", ip, null, cookie);
  assert.strictEqual(last.status, 429);
  const other = env.cookieName + "=" + tokenService.signToken("someone-else");
  assert.strictEqual((await call("GET", "/me", ip, null, other)).status, 401);
});

test("expired/invalid session returns 401, not a rate-limit error", async () => {
  const r = await call("GET", "/me", newIp(), null, env.cookieName + "=not.a.jwt");
  assert.strictEqual(r.status, 401);
});

test("invalid credentials decrement remaining; 5xx does not", async () => {
  const ip = newIp();
  const first401 = await login(ip, "quota@x.com", "Wrong1234");
  assert.strictEqual(first401.status, 401);
  assert.strictEqual(Number(first401.remaining), 2);
  const five = await login(ip, "quota@x.com", "DbDown123");
  assert.strictEqual(five.status, 500);
  const second401 = await login(ip, "quota@x.com", "Wrong1234");
  assert.strictEqual(second401.status, 401);
  assert.strictEqual(Number(second401.remaining), 1);
});

test("trust proxy 1 uses the last XFF hop, not a spoofed leftmost client", async () => {
  const spoofed = await call("POST", "/login", "8.8.8.8, 198.51.100.200", {
    email: "spoof@x.com",
    password: "Wrong1234",
  });
  assert.strictEqual(spoofed.status, 401);
  const sameLastHop = await call("POST", "/login", "1.2.3.4, 198.51.100.200", {
    email: "spoof@x.com",
    password: "Wrong1234",
  });
  assert.strictEqual(sameLastHop.status, 401);
  assert.strictEqual(Number(sameLastHop.remaining), 1);
  const otherLastHop = await call("POST", "/login", "198.51.100.201", {
    email: "spoof@x.com",
    password: "Wrong1234",
  });
  assert.strictEqual(otherLastHop.status, 401);
  assert.strictEqual(Number(otherLastHop.remaining), 2);
});

test("TRUST_PROXY_HOPS: defaults to 1, rejects junk, accepts 0-5", () => {
  const envPath = require.resolve("../src/config/env");
  const load = (v) => {
    if (v === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = v;
    delete require.cache[envPath];
    return require("../src/config/env").trustProxyHops;
  };
  assert.strictEqual(load(undefined), 1);
  assert.strictEqual(load("2"), 2);
  assert.strictEqual(load("0"), 0);
  assert.strictEqual(load("true"), 1);
  assert.strictEqual(load("-1"), 1);
  assert.strictEqual(load("99"), 1);
  assert.strictEqual(load("1.5"), 1);
  load(undefined);
});
