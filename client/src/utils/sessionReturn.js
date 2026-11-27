const KEY = "studykarle:returnTo";

function defaultStorage() {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }
  return window.sessionStorage;
}

export function isSafeReturnPath(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") ||
      path.includes("\\") || /[\u0000-\u001f\u007f]/.test(path)) {
    return false;
  }
  const origin = "https://studykarle.me";
  const target = new URL(path, origin);
  return target.origin === origin &&
    !/^\/(login|signup|forgot-password|auth)(?:\/|$)/i.test(target.pathname);
}

export function authReturnQuery(redirectTo) {
  return isSafeReturnPath(redirectTo) ? "?" + new URLSearchParams({ returnTo: redirectTo }) : "";
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
