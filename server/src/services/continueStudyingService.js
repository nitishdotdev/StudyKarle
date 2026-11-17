const pdfActivityService = require("./pdfActivityService");
const driveNodeModel = require("../models/driveNodeModel");
const noteModel = require("../models/noteModel");
const materialGate = require("./materialGateService");
const accessEntitlementService = require("./accessEntitlementService");
const yearScope = require("./yearScopeService");

const MAX_ITEMS = 2;

function uniqueKey(row) {
  return String(row.resourceType || "") + ":" + String(row.pdfId || "");
}

function contextFromPath(path) {
  const parts = String(path || "")
    .split("/")
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return "";
}

function toDriveItem(row, node, decision) {
  return {
    source: row.source || "history",
    resourceType: "drive",
    resourceId: node.drive_id,
    title: node.name,
    context: contextFromPath(node.path),
    href: "/drive/file/" + encodeURIComponent(node.drive_id),
    lastOpenedAt: row.source === "recommendation" ? undefined : row.createdAt,
    modifiedAt: row.source === "recommendation" ? node.modified_time || null : undefined,
    mimeType: node.mime_type || null,
    fileType: node.mime_type && String(node.mime_type).indexOf("pdf") !== -1 ? "pdf" : "file",
    protected: !!decision.protected,
    canPreview: !!decision.canPreview,
    canDownload: !!decision.canDownload,
    accessCode: decision.code || null,
  };
}

function isPdf(node) {
  return (
    node &&
    (String(node.mime_type || "").toLowerCase().indexOf("pdf") !== -1 ||
      /\.pdf$/i.test(String(node.name || "")))
  );
}

function isApproved(entitlement) {
  return !!(entitlement && entitlement.hasAccess && entitlement.status === "approved");
}

async function recommendationItems(user) {
  const entitlement = await accessEntitlementService.getEntitlementState(user.id);
  if (isApproved(entitlement)) return [];

  const preferredYear = Number.parseInt(String(user.currentYear || ""), 10);
  const candidates = await driveNodeModel.findRecommendedPdfFiles(
    preferredYear === 1 || preferredYear === 2 ? preferredYear : null
  );
  const items = [];
  for (let i = 0; i < candidates.length && items.length < MAX_ITEMS; i++) {
    const node = candidates[i];
    if (!isPdf(node) || !yearScope.isProtectedNode(node)) continue;
    const decision = await materialGate.authorizeDriveNode(user, node);
    if (!decision.protected || decision.canPreview || decision.canDownload) continue;
    items.push(toDriveItem({ source: "recommendation" }, node, decision));
  }
  return items;
}

function toNoteItem(row, note, decision) {
  return {
    source: row.source || "history",
    resourceType: "note",
    resourceId: String(note.id),
    title: note.title,
    context: note.subject_name || "",
    href: "/notes/" + encodeURIComponent(note.id),
    lastOpenedAt: row.createdAt,
    mimeType: null,
    fileType: note.file_type || "pdf",
    protected: !!decision.protected,
    canPreview: !!decision.canPreview,
    canDownload: !!decision.canDownload,
    accessCode: decision.code || null,
  };
}

async function listForStudent(user) {
  const userId = user && user.id;
  if (!userId) return [];

  const opened = await pdfActivityService.recentOpenedByUser(userId);
  const unique = [];
  const seen = new Set();
  opened.forEach(function (row) {
    if (!row || !row.pdfId || (row.resourceType !== "drive" && row.resourceType !== "note")) {
      return;
    }
    const key = uniqueKey(row);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(row);
  });

  const driveIds = [];
  const noteIds = [];
  unique.forEach(function (row) {
    if (row.resourceType === "drive") driveIds.push(row.pdfId);
    else noteIds.push(row.pdfId);
  });

  const [driveRows, noteRows] = await Promise.all([
    driveIds.length ? driveNodeModel.findFilesByIds(driveIds) : [],
    noteIds.length ? noteModel.findPublishedByIds(noteIds) : [],
  ]);

  const driveById = new Map();
  driveRows.forEach(function (node) {
    driveById.set(node.drive_id, node);
  });
  const noteById = new Map();
  noteRows.forEach(function (note) {
    noteById.set(String(note.id), note);
  });

  const items = [];
  for (let i = 0; i < unique.length && items.length < MAX_ITEMS; i++) {
    const row = unique[i];
    if (row.resourceType === "drive") {
      const node = driveById.get(row.pdfId);
      if (!node) continue;
      const decision = await materialGate.authorizeDriveNode(user, node);
      items.push(toDriveItem(row, node, decision));
    } else {
      const note = noteById.get(String(row.pdfId));
      if (!note) continue;
      const decision = await materialGate.authorizeNote(user, note);
      items.push(toNoteItem(row, note, decision));
    }
  }

  if (items.length > 0) return items;
  return recommendationItems(user);
}

module.exports = {
  listForStudent,
};
