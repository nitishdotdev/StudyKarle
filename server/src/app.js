const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const compression = require("compression");

const env = require("./config/env");
const routes = require("./routes/index"); // ← All routes: auth, notes, saved, search, admin, years
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const csrfProtection = require("./middleware/csrfProtection");
const proxyDiagnostics = require("./middleware/proxyDiagnostics");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://studykarle.me",
  "https://www.studykarle.me",
  "https://studykarle.vercel.app",
];
// Merge in the env-driven allowlist (avoids duplicating defaults).
env.corsOrigins.forEach(function (origin) {
  if (allowedOrigins.indexOf(origin) === -1) {
    allowedOrigins.push(origin);
  }
});

// Hop count is explicit and numeric (never `true`), so only the configured
// number of proxies are trusted for req.ip. See TRUST_PROXY_HOPS in env.js.
// Default remains 1 until production proxy-diag logs confirm the real chain.
app.set("trust proxy", env.trustProxyHops);

app.use(helmet());

// Single, strict CORS config shared by the global middleware and the
// OPTIONS preflight fallback so both respond identically. Credentialed
// requests (session cookie) require an exact origin match from the allowlist
// below — never "*".
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true, // REQUIRED for cookies
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  // Every header the StudyKarle client actually sends. X-Requested-With is the
  // CSRF marker added by the axios interceptor; omitting it breaks preflight.
  // Authorization is kept for any future bearer-token flow.
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  // Expose caching / range headers so pdf.js can do partial (page-by-page)
  // loading and the browser can cache PDF previews across origins.
  exposedHeaders: [
    "Content-Range",
    "Accept-Ranges",
    "Content-Length",
    "ETag",
    "Cache-Control",
    "Last-Modified",
  ],
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

// gzip/deflate all JSON API responses.
app.use(compression());

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (!env.isProduction) {
  app.use(morgan("dev"));
}

app.get("/api/health", function (req, res) {
  res.json({
    success: true,
    data: {
      status: "ok",
      env: env.nodeEnv,
      commit: (process.env.RENDER_GIT_COMMIT || "unknown").slice(0, 7),
    },
  });
});

app.use("/api/auth", proxyDiagnostics);
app.use("/api", csrfProtection); // CSRF: require X-Requested-With on non-GET /api requests
app.use("/api", routes); // ← Mounts ALL routes: /api/auth, /api/notes, /api/admin, etc.

app.use(notFound);
app.use(errorHandler);

module.exports = app;
