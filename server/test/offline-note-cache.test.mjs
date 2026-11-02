import test from "node:test";
import assert from "node:assert/strict";
import {
  putCachedNotes,
  readCachedNotes,
  putCachedNote,
  readCachedNote,
  clearCachedNotes,
  describeDataFreshness,
} from "../../client/src/utils/offlineNoteCache.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: function (key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem: function (key, value) {
      map.set(key, String(value));
    },
    removeItem: function (key) {
      map.delete(key);
    },
  };
}

const NOTE = {
  id: "note-1",
  title: "OS notes",
  description: "Unit 1",
  subject_name: "Operating Systems",
  semester_label: "Sem 3",
  size_bytes: 1200,
  page_count: 12,
  created_at: "2026-01-01T00:00:00.000Z",
  protected: false,
  canPreview: true,
  canDownload: false,
  accessCode: null,
  token: "secret-token",
  password: "hunter2",
};

const FILE = {
  driveId: "drive-1",
  name: "Lab manual.pdf",
  size_bytes: 4000,
  modified_time: "2026-02-01T00:00:00.000Z",
  protected: false,
  canPreview: true,
  canDownload: false,
  accessCode: null,
  otp: "999999",
};

test("cached saved notes survive a reload for the same user", () => {
  const storage = memoryStorage();
  putCachedNotes(
    "user-a",
    { notes: [NOTE], files: [FILE] },
    { storage: storage, now: 1000 }
  );
  const cached = readCachedNotes("user-a", { storage: storage, now: 1500 });
  assert.equal(cached.notes[0].title, "OS notes");
  assert.equal(cached.files[0].name, "Lab manual.pdf");
  assert.equal(cached.source, "cached");
});

test("cached notes are scoped to the signed-in user", () => {
  const storage = memoryStorage();
  putCachedNotes("user-a", { notes: [NOTE], files: [] }, { storage: storage, now: 1000 });
  assert.equal(readCachedNotes("user-b", { storage: storage, now: 1500 }), null);
  assert.equal(readCachedNotes("user-a", { storage: storage, now: 1500 }).notes.length, 1);
});

test("offline note cache never stores passwords, tokens, or otp", () => {
  const storage = memoryStorage();
  putCachedNotes("user-a", { notes: [NOTE], files: [FILE] }, { storage: storage, now: 1000 });
  putCachedNote("user-a", NOTE, { storage: storage, now: 1000 });
  const list = readCachedNotes("user-a", { storage: storage, now: 1500 });
  const note = readCachedNote("user-a", "note-1", { storage: storage, now: 1500 });
  assert.equal(list.notes[0].password, undefined);
  assert.equal(list.notes[0].token, undefined);
  assert.equal(list.files[0].otp, undefined);
  assert.equal(note.note.password, undefined);
  assert.equal(note.note.token, undefined);
  const raw = JSON.stringify(storage.getItem("studykarle:notes:user-a") || "");
  assert.equal(raw.includes("hunter2"), false);
  assert.equal(raw.includes("secret-token"), false);
  assert.equal(raw.includes("999999"), false);
});

test("missing user id never writes or reads a shared cache", () => {
  const storage = memoryStorage();
  assert.equal(
    putCachedNotes("", { notes: [NOTE], files: [] }, { storage: storage, now: 1000 }),
    false
  );
  assert.equal(readCachedNotes("", { storage: storage, now: 1500 }), null);
  assert.equal(readCachedNotes(null, { storage: storage, now: 1500 }), null);
});

test("describeDataFreshness distinguishes cached snapshots from live data", () => {
  const cached = describeDataFreshness({ source: "cached" });
  assert.equal(cached.source, "cached");
  assert.match(cached.label, /this device/i);
  const live = describeDataFreshness({ source: "live" });
  assert.equal(live.source, "live");
  assert.equal(live.label, null);
});

test("clearCachedNotes removes only that user's snapshot", () => {
  const storage = memoryStorage();
  putCachedNotes("user-a", { notes: [NOTE], files: [] }, { storage: storage, now: 1000 });
  putCachedNotes("user-b", { notes: [NOTE], files: [] }, { storage: storage, now: 1000 });
  clearCachedNotes("user-a", { storage: storage });
  assert.equal(readCachedNotes("user-a", { storage: storage, now: 1500 }), null);
  assert.equal(readCachedNotes("user-b", { storage: storage, now: 1500 }).notes.length, 1);
});
