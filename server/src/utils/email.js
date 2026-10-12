function normalizeEmail(email) {
  if (email == null) {
    return "";
  }
  return String(email).trim().toLowerCase();
}

function extractDomain(email) {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    return null;
  }
  if (normalized.indexOf("@") !== at) {
    return null;
  }
  const domain = normalized.slice(at + 1).replace(/\.+$/, "");
  if (!domain || domain.indexOf(" ") !== -1) {
    return null;
  }
  return domain;
}

function isWellFormedEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }
  const domain = extractDomain(normalized);
  if (!domain) {
    return false;
  }
  const local = normalized.slice(0, normalized.lastIndexOf("@"));
  if (!local || local.length > 64 || domain.length > 255) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

module.exports = {
  normalizeEmail: normalizeEmail,
  extractDomain: extractDomain,
  isWellFormedEmail: isWellFormedEmail,
};
