const LIST_PREFIX = "studykarle:notes:";
const ITEM_PREFIX = "studykarle:note:";

function defaultStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function hasUserId(userId) {
  return userId != null && String(userId) !== "";
}

function sanitizeNote(note) {
  if (!note || typeof note !== "object" || note.id == null || note.id === "") {
    return null;
  }
  return {
    id: String(note.id),
    title: typeof note.title === "string" ? note.title : "",
    description: typeof note.description === "string" ? note.description : "",
    subject_name: typeof note.subject_name === "string" ? note.subject_name : "",
    semester_label: typeof note.semester_label === "string" ? note.semester_label : "",
    size_bytes: typeof note.size_bytes === "number" ? note.size_bytes : 0,
    page_count: typeof note.page_count === "number" ? note.page_count : 0,
    created_at: typeof note.created_at === "string" ? note.created_at : "",
    protected: !!note.protected,
    canPreview: note.canPreview !== false,
    canDownload: !!note.canDownload,
    accessCode: typeof note.accessCode === "string" ? note.accessCode : null,
  };
}

function sanitizeFile(file) {
  if (!file || typeof file !== "object" || file.driveId == null || file.driveId === "") {
    return null;
  }
  return {
    driveId: String(file.driveId),
    name: typeof file.name === "string" ? file.name : "",
    size_bytes: typeof file.size_bytes === "number" ? file.size_bytes : 0,
    modified_time: typeof file.modified_time === "string" ? file.modified_time : "",
    protected: !!file.protected,
    canPreview: file.canPreview !== false,
    canDownload: !!file.canDownload,
    accessCode: typeof file.accessCode === "string" ? file.accessCode : null,
  };
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function readJson(storage, key) {
  let raw = null;
  try {
    raw = storage.getItem(key);
  } catch (err) {
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function putCachedNotes(userId, payload, options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage || !hasUserId(userId)) {
    return false;
  }
  const notes = ((payload && payload.notes) || []).map(sanitizeNote).filter(Boolean);
  const files = ((payload && payload.files) || []).map(sanitizeFile).filter(Boolean);
  return writeJson(storage, LIST_PREFIX + String(userId), {
    savedAt: (options && options.now) || Date.now(),
    notes: notes,
    files: files,
  });
}

export function readCachedNotes(userId, options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage || !hasUserId(userId)) {
    return null;
  }
  const parsed = readJson(storage, LIST_PREFIX + String(userId));
  if (!parsed) {
    return null;
  }
  const notes = (parsed.notes || []).map(sanitizeNote).filter(Boolean);
  const files = (parsed.files || []).map(sanitizeFile).filter(Boolean);
  return {
    notes: notes,
    files: files,
    source: "cached",
    savedAt: parsed.savedAt || 0,
  };
}

export function putCachedNote(userId, note, options) {
  const storage = (options && options.storage) || defaultStorage();
  const clean = sanitizeNote(note);
  if (!storage || !hasUserId(userId) || !clean) {
    return false;
  }
  return writeJson(storage, ITEM_PREFIX + String(userId) + ":" + clean.id, {
    savedAt: (options && options.now) || Date.now(),
    note: clean,
  });
}

export function readCachedNote(userId, noteId, options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage || !hasUserId(userId) || noteId == null || noteId === "") {
    return null;
  }
  const parsed = readJson(storage, ITEM_PREFIX + String(userId) + ":" + String(noteId));
  const note = parsed && sanitizeNote(parsed.note);
  if (!note) {
    return null;
  }
  return {
    note: note,
    source: "cached",
    savedAt: parsed.savedAt || 0,
  };
}

export function clearCachedNotes(userId, options) {
  const storage = (options && options.storage) || defaultStorage();
  if (!storage || !hasUserId(userId)) {
    return;
  }
  const cached = readCachedNotes(userId, options);
  try {
    storage.removeItem(LIST_PREFIX + String(userId));
  } catch (err) {}
  if (cached && cached.notes) {
    cached.notes.forEach(function (note) {
      try {
        storage.removeItem(ITEM_PREFIX + String(userId) + ":" + note.id);
      } catch (err) {}
    });
  }
}

export function describeDataFreshness(input) {
  if (input && input.source === "cached") {
    return {
      source: "cached",
      label: "Showing notes saved on this device.",
    };
  }
  return {
    source: "live",
    label: null,
  };
}
