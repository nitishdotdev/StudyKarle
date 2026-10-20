import axios from "axios";

// Vite exposes only env vars prefixed with VITE_ to the client. Default to a
// relative /api so the Vite dev/preview server's reverse proxy (see
// vite.config.js) forwards requests to the backend — the preview environment
// exposes a single port. VITE_API_URL overrides this in production.
const API_URL = import.meta.env.VITE_API_URL || "/api";

const axiosClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ------------------------------------------------------------------
// In-memory response cache (GET only)
// ----------------------------------------------------------------
// Speeds up repeat navigation and prefetches without changing any API
// shapes. Cache is scoped to the currently signed-in user and is cleared
// whenever a non-GET mutation happens (login, logout, save, upload, ...),
// so cross-user data can never leak and fresh data always wins.
// ------------------------------------------------------------------
const DEFAULT_TTL = 45 * 1000; // 45s
const cacheStore = new Map();
let cacheOwnerId = null;

function buildCacheKey(config) {
  const params = config.params || {};
  const sorted = Object.keys(params)
    .sort()
    .map(function (k) {
      return k + "=" + String(params[k]);
    })
    .join("&");
  return (config.method || "get").toUpperCase() + ":" + (config.url || "") + (sorted ? "?" + sorted : "");
}

function isCacheable(config) {
  if ((config.method || "get").toUpperCase() !== "GET") return false;
  if (config.skipCache) return false;
  const responseType = config.responseType || "json";
  if (responseType !== "json") return false; // never cache binary (PDFs, etc.)
  const url = config.url || "";
  // Skip highly dynamic / per-request endpoints.
  if (
    url.indexOf("/auth/") !== -1 ||
    url.indexOf("/csrf-token") !== -1 ||
    url.indexOf("/admin/stats") !== -1 ||
    url.indexOf("/admin/activity") !== -1 ||
    url.indexOf("/admin/view-history") !== -1
  ) {
    return false;
  }
  return true;
}

function getCached(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > entry.ttl) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, response, ttl) {
  cacheStore.set(key, { at: Date.now(), ttl: ttl || DEFAULT_TTL, value: response });
}

export function invalidateCache(prefix) {
  if (prefix) {
    for (const key of cacheStore.keys()) {
      if (key.indexOf(prefix) !== -1) cacheStore.delete(key);
    }
  } else {
    cacheStore.clear();
  }
}

function isUserScoped(url) {
  return (
    url.indexOf("/auth/me") !== -1 ||
    url.indexOf("/saved") !== -1 ||
    url.indexOf("/users/me") !== -1
  );
}

let csrfToken = null;
let csrfTokenPromise = null;

function isMutating(config) {
  const method = (config.method || "get").toUpperCase();
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function fetchCsrfToken() {
  if (csrfToken) return Promise.resolve(csrfToken);
  if (csrfTokenPromise) return csrfTokenPromise;
  csrfTokenPromise = axiosClient
    .get("/csrf-token", { skipCache: true })
    .then(function (res) {
      csrfToken =
        res.data && res.data.data ? res.data.data.csrfToken : null;
      csrfTokenPromise = null;
      return csrfToken;
    })
    .catch(function (err) {
      csrfTokenPromise = null;
      return Promise.reject(err);
    });
  return csrfTokenPromise;
}

axiosClient.interceptors.request.use(function (config) {
  config.headers = config.headers || {};
  config.headers["X-Requested-With"] = "XMLHttpRequest";

  if (isCacheable(config)) {
    const key = buildCacheKey(config);
    const cached = getCached(key);
    if (cached) {
      config.adapter = function () {
        return Promise.resolve(cached);
      };
    }
  }

  if (
    isMutating(config) &&
    !config.headers["X-CSRF-Token"] &&
    !config.headers["x-csrf-token"]
  ) {
    return fetchCsrfToken().then(function (token) {
      if (token) config.headers["X-CSRF-Token"] = token;
      return config;
    });
  }
  return config;
});

axiosClient.interceptors.response.use(
  function (response) {
    const config = response.config;
    const url = config.url || "";

    // Keep the cache owner in sync with the signed-in user so a different
    // account that logs in on the same tab never sees stale data.
    if (url.indexOf("/auth/me") !== -1) {
      const uid = response.data && response.data.data && response.data.data.id;
      if (uid !== cacheOwnerId) {
        cacheOwnerId = uid;
        cacheStore.clear();
      }
    }

    if ((config.method || "get").toUpperCase() !== "GET") {
      // Any mutation invalidates cached responses.
      cacheStore.clear();
      return response;
    }

    if (isCacheable(config)) {
      const key = buildCacheKey(config);
      setCached(key, Object.assign({}, response), config.ttl);
    }
    return response;
  },
  function (error) {
    const config = error.config;
    if (config && (config.method || "get").toUpperCase() !== "GET") {
      cacheStore.clear();
    }

    // Central session-expiry handling: a 401 from any protected endpoint
    // (anything outside the auth flow) tells AuthContext to clear the cached
    // user so ProtectedRoute bounces the visitor to /login. This keeps the
    // behaviour consistent instead of scattering `window.location` checks.
    const status = error.response ? error.response.status : 0;
    const url = (config && config.url) || "";
    if (status === 403) {
      csrfToken = null;
      csrfTokenPromise = null;
    }
    if (status === 401 && url.indexOf("/auth/") === -1) {
      window.dispatchEvent(new CustomEvent("studykarle:unauthorized"));
    }

    // For responseType: "blob" requests (downloads) the backend still returns
    // JSON error bodies as a Blob — parse them so the UI shows the real
    // message instead of a generic one.
    if (
      error.response &&
      error.response.data &&
      typeof error.response.data.text === "function"
    ) {
      return error.response.data.text().then(function (text) {
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          parsed = null;
        }
        const blobHeaders = (error.response && error.response.headers) || {};
        return Promise.reject({
          status: status,
          message:
            (parsed && parsed.message) ||
            "Something went wrong. Please try again.",
          details: (parsed && parsed.details) || null,
          retryAfter:
            blobHeaders["retry-after"] || blobHeaders["Retry-After"] || null,
        });
      });
    }

    const message =
      (error.response && error.response.data && error.response.data.message) ||
      "Something went wrong. Please try again.";
    const details =
      (error.response && error.response.data && error.response.data.details) ||
      null;
    const headers = (error.response && error.response.headers) || {};
    const retryAfter = headers["retry-after"] || headers["Retry-After"] || null;
    return Promise.reject({
      status: status,
      message: message,
      details: details,
      retryAfter: retryAfter,
    });
  }
);

export default axiosClient;
export { API_URL };
