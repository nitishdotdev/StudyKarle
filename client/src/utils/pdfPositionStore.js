const PREFIX = "studykarle:pdfpos:";

function defaultStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function hasId(value) {
  return value != null && String(value) !== "";
}

function keyFor(userId, noteId) {
  return PREFIX + String(userId) + ":" + String(noteId);
}

export function savePdfPosition(userId, noteId, page, options) {
  const storage = (options && options.storage) || defaultStorage();
  const pageNumber = Number(page);
  if (!storage || !hasId(userId) || !hasId(noteId) || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return false;
  }
  try {
    storage.setItem(keyFor(userId, noteId), JSON.stringify({ page: pageNumber }));
    return true;
  } catch (err) {
    return false;
  }
}

export function readPdfPosition(userId, noteId, options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage || !hasId(userId) || !hasId(noteId)) {
    return null;
  }
  let raw = null;
  try {
    raw = storage.getItem(keyFor(userId, noteId));
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
  const pageNumber = parsed && Number(parsed.page);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return null;
  }
  return pageNumber;
}

export function clearPdfPosition(userId, noteId, options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage || !hasId(userId) || !hasId(noteId)) {
    return;
  }
  try {
    storage.removeItem(keyFor(userId, noteId));
  } catch (err) {}
}
