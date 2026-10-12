const fs = require("fs");
const path = require("path");
const { normalizeEmail, extractDomain, isWellFormedEmail } = require("../utils/email");
const logger = require("../utils/logger");
const ApiError = require("../utils/ApiError");

const DISPOSABLE_MESSAGE =
  "Temporary email addresses are not supported. Please use a permanent email address.";

const DATASET_PATH = path.join(
  __dirname,
  "..",
  "data",
  "disposable-email-domains.json"
);

let domainSet = null;
let loadError = null;

function loadDataset() {
  if (domainSet) {
    return domainSet;
  }
  try {
    const raw = fs.readFileSync(DATASET_PATH, "utf8");
    const list = JSON.parse(raw);
    domainSet = new Set();
    if (Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        const domain = String(list[i] || "")
          .trim()
          .toLowerCase()
          .replace(/^\.+/, "")
          .replace(/\.+$/, "");
        if (domain) {
          domainSet.add(domain);
        }
      }
    }
    loadError = null;
  } catch (err) {
    loadError = err;
    domainSet = new Set();
    logger.error("Failed to load disposable email domain dataset", err);
  }
  return domainSet;
}

function domainMatches(domain) {
  const set = loadDataset();
  if (!domain) {
    return false;
  }
  let current = domain;
  while (current) {
    if (set.has(current)) {
      return true;
    }
    const dot = current.indexOf(".");
    if (dot === -1) {
      break;
    }
    current = current.slice(dot + 1);
  }
  return false;
}

function inspectEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || !isWellFormedEmail(normalized)) {
    return {
      ok: false,
      reason: "malformed",
      email: normalized,
      domain: null,
      disposable: false,
    };
  }
  const domain = extractDomain(normalized);
  if (loadError) {
    return {
      ok: true,
      reason: "detection_unavailable",
      email: normalized,
      domain: domain,
      disposable: false,
    };
  }
  if (domainMatches(domain)) {
    return {
      ok: false,
      reason: "disposable",
      email: normalized,
      domain: domain,
      disposable: true,
    };
  }
  return {
    ok: true,
    reason: "allowed",
    email: normalized,
    domain: domain,
    disposable: false,
  };
}

function isDisposableEmail(email) {
  return inspectEmail(email).disposable === true;
}

function assertNotDisposable(email) {
  const result = inspectEmail(email);
  if (result.reason === "disposable") {
    throw ApiError.badRequest(DISPOSABLE_MESSAGE);
  }
  return result;
}

module.exports = {
  DISPOSABLE_MESSAGE: DISPOSABLE_MESSAGE,
  loadDataset: loadDataset,
  inspectEmail: inspectEmail,
  isDisposableEmail: isDisposableEmail,
  assertNotDisposable: assertNotDisposable,
  domainMatches: domainMatches,
};
