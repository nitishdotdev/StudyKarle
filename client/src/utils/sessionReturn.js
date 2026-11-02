const KEY = "studykarle:returnTo";

function defaultStorage() {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }
  return window.sessionStorage;
}

function pathnameOf(path) {
  const raw = String(path || "");
  const queryAt = raw.indexOf("?");
  return queryAt === -1 ? raw : raw.slice(0, queryAt);
}

export function isSafeReturnPath(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    return false;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) {
    return false;
  }
  const pathname = pathnameOf(path);
  if (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password") {
    return false;
  }
  return true;
}

export function saveReturnTo(path, options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage || !isSafeReturnPath(path)) {
    return false;
  }
  try {
    storage.setItem(KEY, path);
    return true;
  } catch (err) {
    return false;
  }
}

export function readReturnTo(options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage) {
    return "";
  }
  let raw = "";
  try {
    raw = storage.getItem(KEY) || "";
  } catch (err) {
    return "";
  }
  return isSafeReturnPath(raw) ? raw : "";
}

export function clearReturnTo(options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(KEY);
  } catch (err) {}
}
