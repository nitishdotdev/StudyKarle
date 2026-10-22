const driveNodeModel = require("../models/driveNodeModel");
const yearScope = require("./yearScopeService");
const materialAccess = require("./materialAccessService");
const accessEntitlementService = require("./accessEntitlementService");
const ApiError = require("../utils/ApiError");

function paymentError(decision) {
  const messages = {
    PAYMENT_REQUIRED: "Semester access is required to view this material.",
    PAYMENT_PENDING: "Your payment is being verified. Access will unlock after approval.",
    PAYMENT_REJECTED: "Your payment was not approved. You can resubmit proof from the access page.",
    PAYMENT_EXPIRED: "Your semester access has expired.",
    DOWNLOAD_DISABLED: "Downloads are disabled for students.",
  };
  const status = decision.code === "DOWNLOAD_DISABLED" ? 403 : 402;
  return new ApiError(status, messages[decision.code] || messages.PAYMENT_REQUIRED, {
    code: decision.code,
    accessPath: "/access",
  });
}

async function withAncestors(node) {
  if (!node) return node;
  if (node.ancestors && node.ancestors.length) return node;
  let ancestors = [];
  if (typeof driveNodeModel.findAncestors === "function" && node.drive_id) {
    ancestors = await driveNodeModel.findAncestors(node.drive_id);
  }
  return Object.assign({}, node, { ancestors: ancestors || [] });
}

function noteAsNode(note) {
  const yearLabel = note.year_label || "";
  const path = yearLabel ? yearLabel + "/" + (note.subject_name || "") + "/" + (note.title || "") : note.title || "";
  return {
    name: note.title,
    kind: "file",
    path: path,
    ancestors: yearLabel ? [{ name: yearLabel }] : [],
    year_id: note.year_id,
    year_label: yearLabel,
  };
}

async function classifyDriveNode(node) {
  const withPath = await withAncestors(node);
  return yearScope.isProtectedNode(withPath);
}

async function authorizeDriveNode(user, node) {
  const withPath = await withAncestors(node);
  const entitlement =
    user && user.role === "admin"
      ? { hasAccess: true, status: "approved" }
      : await accessEntitlementService.getEntitlementState(user.id);
  return materialAccess.authorizeMaterial(user, withPath, entitlement);
}

async function authorizeNote(user, note) {
  const node = noteAsNode(note);
  const entitlement =
    user && user.role === "admin"
      ? { hasAccess: true, status: "approved" }
      : await accessEntitlementService.getEntitlementState(user.id);
  return materialAccess.authorizeMaterial(user, node, entitlement);
}

async function assertDrivePreview(user, node) {
  const decision = await authorizeDriveNode(user, node);
  if (!decision.canPreview) {
    throw paymentError(decision);
  }
  return decision;
}

async function assertDriveDownload(user, node) {
  const decision = await authorizeDriveNode(user, node);
  if (!decision.canDownload) {
    if (decision.protected) {
      throw paymentError(
        Object.assign({}, decision, {
          code: decision.canPreview ? "DOWNLOAD_DISABLED" : decision.code,
        })
      );
    }
    throw ApiError.forbidden("You are not authorized to access this resource");
  }
  return decision;
}

async function assertNotePreview(user, note) {
  const decision = await authorizeNote(user, note);
  if (!decision.canPreview) {
    throw paymentError(decision);
  }
  return decision;
}

async function assertNoteDownload(user, note) {
  const decision = await authorizeNote(user, note);
  if (!decision.canDownload) {
    if (decision.protected) {
      throw paymentError(
        Object.assign({}, decision, {
          code: decision.canPreview ? "DOWNLOAD_DISABLED" : decision.code,
        })
      );
    }
    throw ApiError.forbidden("You are not authorized to access this resource");
  }
  return decision;
}

function denyProtectedShare() {
  throw ApiError.forbidden("Protected Year 1 and Year 2 materials cannot be shared publicly.");
}

module.exports = {
  paymentError,
  classifyDriveNode,
  authorizeDriveNode,
  authorizeNote,
  assertDrivePreview,
  assertDriveDownload,
  assertNotePreview,
  assertNoteDownload,
  denyProtectedShare,
  noteAsNode,
};
