import test from "node:test";
import assert from "node:assert/strict";
import {
  resumeAction,
  resourceHref,
  shouldShowContinueStudying,
  lastOpenedLabel,
} from "../../client/src/utils/continueStudying.js";
import { readPdfPosition, savePdfPosition } from "../../client/src/utils/pdfPositionStore.js";
import { paymentAccessPath } from "../../client/src/utils/paymentRedirect.js";

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

test("only authenticated students see Continue Studying", () => {
  assert.equal(shouldShowContinueStudying({ id: 1, role: "student" }), true);
  assert.equal(shouldShowContinueStudying({ id: 2, role: "admin" }), false);
  assert.equal(shouldShowContinueStudying(null), false);
  assert.equal(shouldShowContinueStudying(undefined), false);
});

test("drive and note resources navigate to the existing viewer routes", () => {
  assert.equal(
    resourceHref({ resourceType: "drive", resourceId: "trees", canPreview: true }),
    "/drive/file/trees"
  );
  assert.equal(
    resourceHref({ resourceType: "note", resourceId: "33", canPreview: true }),
    "/notes/33"
  );
});

test("locked resources navigate to the existing access page", () => {
  const item = {
    resourceType: "drive",
    resourceId: "trees",
    href: "/drive/file/trees",
    canPreview: false,
    accessCode: "PAYMENT_REQUIRED",
  };
  assert.equal(resourceHref(item), paymentAccessPath("PAYMENT_REQUIRED"));
});

test("reading-position lookup shows Resume only for a saved page greater than one", () => {
  const storage = memoryStorage();
  savePdfPosition("7", "trees", 12, { storage: storage });
  const page = readPdfPosition("7", "trees", { storage: storage });
  assert.equal(page, 12);
  assert.equal(resumeAction({ canPreview: true }, page), "Resume · Page 12");
  assert.equal(resumeAction({ canPreview: true }, 1), "Continue reading");
  assert.equal(resumeAction({ canPreview: true }, null), "Continue reading");
});

test("locked resources use Unlock access instead of a resume label", () => {
  assert.equal(resumeAction({ canPreview: false }, 12), "Unlock access");
});

test("last opened copy stays relative and never invents a completion percent", () => {
  const recent = lastOpenedLabel(new Date().toISOString());
  assert.equal(recent.indexOf("%"), -1);
  assert.ok(recent.indexOf("Last opened") === 0);
});
