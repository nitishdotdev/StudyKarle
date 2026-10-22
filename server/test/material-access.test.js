const test = require("node:test");
const assert = require("node:assert/strict");

const access = require("../src/services/materialAccessService");

const protectedNode = {
  name: "kinematics.pdf",
  kind: "file",
  path: "Year 1/Physics/kinematics.pdf",
  ancestors: [{ name: "Library" }, { name: "Year 1" }, { name: "Physics" }],
};

const unprotectedNode = {
  name: "handbook.pdf",
  kind: "file",
  path: "Misc/handbook.pdf",
  ancestors: [{ name: "Library" }, { name: "Misc" }],
};

test("admins can preview and download protected materials without paying", function () {
  const admin = { id: 1, role: "admin" };
  const decision = access.authorizeMaterial(admin, protectedNode, {
    hasAccess: false,
    status: "unpaid",
  });
  assert.equal(decision.canPreview, true);
  assert.equal(decision.canDownload, true);
  assert.equal(decision.bypassReason, "admin");
});

test("unpaid students cannot preview protected materials", function () {
  const student = { id: 2, role: "student" };
  const decision = access.authorizeMaterial(student, protectedNode, {
    hasAccess: false,
    status: "unpaid",
  });
  assert.equal(decision.canPreview, false);
  assert.equal(decision.canDownload, false);
  assert.equal(decision.code, "PAYMENT_REQUIRED");
});

test("pending students cannot preview protected materials", function () {
  const student = { id: 2, role: "student" };
  const decision = access.authorizeMaterial(student, protectedNode, {
    hasAccess: false,
    status: "pending",
  });
  assert.equal(decision.canPreview, false);
  assert.equal(decision.code, "PAYMENT_PENDING");
});

test("rejected students cannot preview protected materials", function () {
  const student = { id: 2, role: "student" };
  const decision = access.authorizeMaterial(student, protectedNode, {
    hasAccess: false,
    status: "rejected",
  });
  assert.equal(decision.canPreview, false);
  assert.equal(decision.code, "PAYMENT_REJECTED");
});

test("expired entitlements cannot preview protected materials", function () {
  const student = { id: 2, role: "student" };
  const decision = access.authorizeMaterial(student, protectedNode, {
    hasAccess: false,
    status: "expired",
  });
  assert.equal(decision.canPreview, false);
  assert.equal(decision.code, "PAYMENT_EXPIRED");
});

test("approved unexpired students can preview but not download protected materials", function () {
  const student = { id: 2, role: "student" };
  const decision = access.authorizeMaterial(student, protectedNode, {
    hasAccess: true,
    status: "approved",
    endsAt: new Date("2099-12-31"),
  });
  assert.equal(decision.canPreview, true);
  assert.equal(decision.canDownload, false);
});

test("unprotected materials stay previewable but students cannot download them", function () {
  const student = { id: 2, role: "student" };
  const decision = access.authorizeMaterial(student, unprotectedNode, {
    hasAccess: false,
    status: "unpaid",
  });
  assert.equal(decision.canPreview, true);
  assert.equal(decision.canDownload, false);
  assert.equal(decision.protected, false);
});

test("approved students still cannot download unprotected materials", function () {
  const student = { id: 2, role: "student" };
  const decision = access.authorizeMaterial(student, unprotectedNode, {
    hasAccess: true,
    status: "approved",
    endsAt: new Date("2099-12-31"),
  });
  assert.equal(decision.canPreview, true);
  assert.equal(decision.canDownload, false);
  assert.equal(decision.protected, false);
});

test("admins can still download unprotected materials", function () {
  const admin = { id: 1, role: "admin" };
  const decision = access.authorizeMaterial(admin, unprotectedNode, {
    hasAccess: false,
    status: "unpaid",
  });
  assert.equal(decision.canPreview, true);
  assert.equal(decision.canDownload, true);
  assert.equal(decision.bypassReason, "admin");
});
