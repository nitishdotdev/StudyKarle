const PREFIX = "studykarle:draft:";
const SENSITIVE = {
  password: true,
  otp: true,
  resetToken: true,
  currentPassword: true,
  newPassword: true,
  confirmPassword: true,
  token: true,
  csrfToken: true,
};

function defaultStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function keyFor(name) {
  return PREFIX + String(name || "");
}

function sanitize(fields) {
  const next = {};
  if (!fields || typeof fields !== "object") {
    return next;
  }
  Object.keys(fields).forEach(function (key) {
    if (SENSITIVE[key]) {
      return;
    }
    const value = fields[key];
    if (value == null) {
      return;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      next[key] = value;
    }
  });
  return next;
}

export function saveDraft(name, fields, options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage || !name) {
    return false;
  }
  const payload = {
    savedAt: (options && options.now) || Date.now(),
    fields: sanitize(fields),
  };
  try {
    storage.setItem(keyFor(name), JSON.stringify(payload));
    return true;
  } catch (err) {
    return false;
  }
}

export function readDraft(name, options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage || !name) {
    return null;
  }
  let raw = null;
  try {
    raw = storage.getItem(keyFor(name));
  } catch (err) {
    return null;
  }
  if (!raw) {
    return null;
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return null;
  }
  const now = (options && options.now) || Date.now();
  const maxAgeMs = options && options.maxAgeMs;
  const savedAt = parsed && parsed.savedAt;
  if (maxAgeMs && savedAt && now - savedAt > maxAgeMs) {
    try {
      storage.removeItem(keyFor(name));
    } catch (err) {}
    return null;
  }
  const fields = parsed && parsed.fields ? sanitize(parsed.fields) : sanitize(parsed);
  if (!Object.keys(fields).length) {
    return null;
  }
  fields.savedAt = savedAt || 0;
  return fields;
}

export function discardDraft(name, options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage || !name) {
    return;
  }
  try {
    storage.removeItem(keyFor(name));
  } catch (err) {}
}

export function isDraftNewer(draft, current) {
  const draftAt = draft && typeof draft.savedAt === "number" ? draft.savedAt : 0;
  const currentAt = current && typeof current.savedAt === "number" ? current.savedAt : 0;
  return draftAt > currentAt;
}

export function shouldRestoreDraft(draft, current) {
  if (!draft || typeof draft !== "object") {
    return false;
  }
  const keys = Object.keys(draft).filter(function (key) {
    return key !== "savedAt";
  });
  if (!keys.length) {
    return false;
  }
  if (!current) {
    return true;
  }
  if (!isDraftNewer(draft, current)) {
    return false;
  }
  return keys.some(function (key) {
    const draftValue = draft[key];
    if (draftValue == null || draftValue === "") {
      return false;
    }
    return String(draftValue) !== String(current[key] == null ? "" : current[key]);
  });
}
