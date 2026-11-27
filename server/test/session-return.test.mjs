import test from "node:test";
import assert from "node:assert/strict";
import {
  isSafeReturnPath,
  saveReturnTo,
  readReturnTo,
  clearReturnTo,
  authReturnQuery,
} from "../../client/src/utils/sessionReturn.js";

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

test("isSafeReturnPath accepts in-app paths with search", () => {
  assert.equal(isSafeReturnPath("/notes/abc"), true);
  assert.equal(isSafeReturnPath("/drive/folder/1?x=2"), true);
  assert.equal(isSafeReturnPath("/search?q=os"), true);
});

test("isSafeReturnPath rejects open redirects and script urls", () => {
  assert.equal(isSafeReturnPath("https://evil.example"), false);
  assert.equal(isSafeReturnPath("//evil.example/phish"), false);
  assert.equal(isSafeReturnPath("javascript:alert(1)"), false);
  assert.equal(isSafeReturnPath(""), false);
  assert.equal(isSafeReturnPath("/login"), false);
  assert.equal(isSafeReturnPath("/\\outside.example"), false);
  assert.equal(isSafeReturnPath("/x/../signup"), false);
  assert.equal(isSafeReturnPath("/auth/google/complete"), false);
});

test("saveReturnTo keeps a path across an auth redirect", () => {
  const storage = memoryStorage();
  saveReturnTo("/notes/note-1", { storage: storage });
  assert.equal(readReturnTo({ storage: storage }), "/notes/note-1");
  clearReturnTo({ storage: storage });
  assert.equal(readReturnTo({ storage: storage }), "");
});

test("saveReturnTo ignores unsafe destinations", () => {
  const storage = memoryStorage();
  assert.equal(saveReturnTo("https://evil.example", { storage: storage }), false);
  assert.equal(readReturnTo({ storage: storage }), "");
});

test("course material and payment context survive an auth redirect", () => {
  const target = "/drive/course/physics/00000000-0000-4000-8000-000000000001";
  assert.equal(new URLSearchParams(authReturnQuery(target)).get("returnTo"), target);
  assert.equal(authReturnQuery("//outside.example"), "");
});
