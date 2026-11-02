import test from "node:test";
import assert from "node:assert/strict";
import {
  saveDraft,
  readDraft,
  discardDraft,
  isDraftNewer,
  shouldRestoreDraft,
} from "../../client/src/utils/draftStore.js";

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

test("saveDraft and readDraft restore non-sensitive fields", () => {
  const storage = memoryStorage();
  saveDraft(
    "profile",
    { name: "Ada", course: "CSE", currentYear: "2nd Year" },
    { storage: storage, now: 1000 }
  );
  const draft = readDraft("profile", { storage: storage, now: 1500 });
  assert.equal(draft.name, "Ada");
  assert.equal(draft.course, "CSE");
  assert.equal(draft.currentYear, "2nd Year");
});

test("saveDraft never persists passwords, otp, tokens, or reset secrets", () => {
  const storage = memoryStorage();
  saveDraft(
    "signup",
    {
      name: "Ada",
      email: "ada@example.com",
      password: "longpass1",
      otp: "123456",
      resetToken: "abc",
      currentPassword: "old",
      newPassword: "newpass2",
    },
    { storage: storage, now: 1000 }
  );
  const draft = readDraft("signup", { storage: storage, now: 1500 });
  assert.equal(draft.name, "Ada");
  assert.equal(draft.email, "ada@example.com");
  assert.equal(draft.password, undefined);
  assert.equal(draft.otp, undefined);
  assert.equal(draft.resetToken, undefined);
  assert.equal(draft.currentPassword, undefined);
  assert.equal(draft.newPassword, undefined);
});

test("readDraft returns null after expiry", () => {
  const storage = memoryStorage();
  saveDraft("login", { email: "ada@example.com" }, { storage: storage, now: 1000 });
  const draft = readDraft("login", {
    storage: storage,
    now: 1000 + 8 * 24 * 60 * 60 * 1000,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  });
  assert.equal(draft, null);
});

test("discardDraft removes a recovered draft", () => {
  const storage = memoryStorage();
  saveDraft("profile", { name: "Ada" }, { storage: storage, now: 1000 });
  discardDraft("profile", { storage: storage });
  assert.equal(readDraft("profile", { storage: storage, now: 1100 }), null);
});

test("isDraftNewer prevents overwriting newer in-memory work with a stale draft", () => {
  assert.equal(isDraftNewer({ savedAt: 50, name: "Old" }, { savedAt: 100, name: "New" }), false);
  assert.equal(isDraftNewer({ savedAt: 200, name: "Draft" }, { savedAt: 100, name: "Old" }), true);
});

test("shouldRestoreDraft keeps a local draft across an auth redirect", () => {
  const storage = memoryStorage();
  saveDraft("profile", { name: "Ada Lovelace" }, { storage: storage, now: 2000 });
  const draft = readDraft("profile", { storage: storage, now: 2500 });
  assert.equal(
    shouldRestoreDraft(draft, {
      name: "Ada",
      course: "CSE",
      currentYear: "2nd Year",
      savedAt: 1000,
    }),
    true
  );
});

test("shouldRestoreDraft does not overwrite newer server profile data", () => {
  const storage = memoryStorage();
  saveDraft("profile", { name: "Stale" }, { storage: storage, now: 1000 });
  const draft = readDraft("profile", { storage: storage, now: 1500 });
  assert.equal(
    shouldRestoreDraft(draft, {
      name: "Ada",
      course: "CSE",
      currentYear: "2nd Year",
      savedAt: 5000,
    }),
    false
  );
});

test("shouldRestoreDraft ignores a draft that already matches current fields", () => {
  assert.equal(
    shouldRestoreDraft(
      { name: "Ada", course: "CSE", savedAt: 2000 },
      { name: "Ada", course: "CSE", currentYear: "2nd Year", savedAt: 1000 }
    ),
    false
  );
});
