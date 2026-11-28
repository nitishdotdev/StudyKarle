const driveNodeModel = require("../models/driveNodeModel");
const noteModel = require("../models/noteModel");
const { authorizeMaterial } = require("./materialAccessService");
const { getEntitlementState } = require("./accessEntitlementService");
const ranking = require("./searchRanking");
const noteService = require("./noteService");

const CANDIDATE_CAP = 200;

function parseFilters(query) {
  const kind = query && (query.kind === "file" || query.kind === "folder") ? query.kind : "";
  const yearRaw = query && query.year != null ? String(query.year) : "";
  const year = ["1", "2", "3", "4"].includes(yearRaw) ? yearRaw : "";
  const type = query && query.type === "pdf" ? "pdf" : "";
  return { kind: kind, year: year, type: type };
}

function driveFileType(row, kind, title) {
  if (kind === "folder") return "folder";
  const mime = String((row && (row.mime_type || row.mimeType)) || "").toLowerCase();
  if (mime.indexOf("pdf") !== -1 || /\.pdf$/i.test(title)) return "pdf";
  return "";
}

function toDriveHit(row) {
  const nodeId = row.drive_id || row.nodeId;
  const kind = row.kind === "folder" ? "folder" : "file";
  const title = row.name || row.title || "";
  return {
    source: "drive",
    nodeId: nodeId,
    parentDriveId: row.parent_drive_id || null,
    title: title,
    kind: kind,
    path: row.path || "",
    mimeType: row.mime_type || row.mimeType || "",
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : row.sizeBytes || null,
    modifiedTime: row.modified_time || row.modifiedTime || null,
    href: kind === "folder" ? "/drive/folder/" + nodeId : "/drive/file/" + nodeId,
    academicYear: ranking.academicYearFromPath(row.path, kind, title),
    fileType: driveFileType(row, kind, title),
  };
}

function toNoteHit(row) {
  const title = row.title || "";
  const yearLabel = row.year_label || "";
  const path = yearLabel
    ? yearLabel + "/" + (row.subject_name || "") + "/" + title
    : title;
  const driveFileId = row.drive_file_id || row.driveFileId || null;
  return Object.assign({}, row, {
    source: "note",
    id: row.id,
    title: title,
    kind: "file",
    path: path,
    description: row.description || "",
    mimeType: row.file_type ? "application/" + row.file_type : "application/pdf",
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    href: "/notes/" + row.id,
    driveFileId: driveFileId,
    academicYear: ranking.academicYearFromPath(path, "file", title),
    fileType: row.file_type || "pdf",
    subjectName: row.subject_name || "",
    semesterLabel: row.semester_label || "",
  });
}

// Fetch bounded batches until the cap contains matching candidates. Use the
// same year and file classification for both sources and for displayed hits.
async function collectCandidates(model, query, filters, toHit) {
  const candidates = [];
  for (let offset = 0; candidates.length < CANDIDATE_CAP; offset += CANDIDATE_CAP) {
    const rows = await model.search(query, {
      kind: filters.kind || undefined,
      limit: CANDIDATE_CAP,
      offset,
    });
    const matches = ranking.applySearchFilters(rows.map(toHit), filters);
    candidates.push(...matches.slice(0, CANDIDATE_CAP - candidates.length));
    if (rows.length < CANDIDATE_CAP) break;
  }
  return candidates;
}

function decorateHit(user, hit, ancestorsById, entitlement) {
  const { parentDriveId, ...publicHit } = hit;
  const ancestors = ancestorsById.get(hit.nodeId) || [];
  const decision = authorizeMaterial(user, {
    kind: hit.kind,
    name: hit.title,
    path: hit.path,
    ancestors,
  }, entitlement);
  return {
    ...publicHit,
    ancestors,
    protected: decision.protected,
    canPreview: decision.canPreview,
    canDownload: decision.canDownload,
    accessCode: decision.code || null,
  };
}

async function searchLibrary(user, query, reqQuery) {
  const q = String(query || "").trim();
  const pagination = noteService.parsePagination(reqQuery || {});
  const filters = parseFilters(reqQuery || {});

  const [driveHits, noteHits] = await Promise.all([
    collectCandidates(driveNodeModel, q, filters, toDriveHit),
    filters.kind === "folder" ? [] : collectCandidates(noteModel, q, filters, toNoteHit),
  ]);
  const merged = ranking.dedupeSearchHits(driveHits, noteHits);
  const ranked = ranking.sortSearchHits(merged, q);
  const page = ranking.paginateSearchHits(ranked, pagination);

  const nodes = page.items.filter((hit) => hit.source === "drive");
  const [ancestors, entitlement] = await Promise.all([
    driveNodeModel.findAncestorsForNodes(nodes),
    page.items.length && user.role !== "admin" ? getEntitlementState(user.id) : null,
  ]);
  const items = page.items.map((hit) => decorateHit(user, hit, ancestors, entitlement));

  const corpus = ranked.map(function (hit) {
    return hit.title;
  });
  const suggestion = ranking.suggestCorrection(q, corpus);

  return {
    items: items,
    meta: Object.assign(
      {
        query: q,
        suggestion: suggestion,
        filters: filters,
      },
      noteService.buildMeta(pagination.page, pagination.limit, page.total)
    ),
  };
}

module.exports = {
  parseFilters,
  toDriveHit,
  toNoteHit,
  searchLibrary,
};
