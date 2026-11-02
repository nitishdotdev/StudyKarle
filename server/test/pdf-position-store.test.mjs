import test from "node:test";
import assert from "node:assert/strict";
import {
  savePdfPosition,
  readPdfPosition,
  clearPdfPosition,
} from "../../client/src/utils/pdfPositionStore.js";

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

test("pdf reading position is restored for the same user and note", () => {
  const storage = memoryStorage();
  savePdfPosition("user-a", "note-1", 7, { storage: storage });
  assert.equal(readPdfPosition("user-a", "note-1", { storage: storage }), 7);
});

test("pdf reading position is isolated per user", () => {
  const storage = memoryStorage();
  savePdfPosition("user-a", "note-1", 4, { storage: storage });
  assert.equal(readPdfPosition("user-b", "note-1", { storage: storage }), null);
});

test("invalid pages are not persisted", () => {
  const storage = memoryStorage();
  assert.equal(savePdfPosition("user-a", "note-1", 0, { storage: storage }), false);
  assert.equal(savePdfPosition("user-a", "note-1", -2, { storage: storage }), false);
  assert.equal(savePdfPosition("user-a", "", 3, { storage: storage }), false);
  assert.equal(savePdfPosition("", "note-1", 3, { storage: storage }), false);
  assert.equal(readPdfPosition("user-a", "note-1", { storage: storage }), null);
});

test("clearPdfPosition removes only that note for that user", () => {
  const storage = memoryStorage();
  savePdfPosition("user-a", "note-1", 3, { storage: storage });
  savePdfPosition("user-a", "note-2", 9, { storage: storage });
  clearPdfPosition("user-a", "note-1", { storage: storage });
  assert.equal(readPdfPosition("user-a", "note-1", { storage: storage }), null);
  assert.equal(readPdfPosition("user-a", "note-2", { storage: storage }), 9);
});
