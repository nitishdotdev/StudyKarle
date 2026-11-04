const driveNodeModel = require("../models/driveNodeModel");
const noteModel = require("../models/noteModel");
const materialGate = require("./materialGateService");
const ranking = require("./searchRanking");
const noteService = require("./noteService");

const CANDIDATE_CAP = 200;

function parseFilters(query) {
  const kind = query && (query.kind === "file" || query.kind === "folder") ? query.kind : "";
  const yearRaw = query && query.year != null ? String(query.year) : "";
  const year = yearRaw === "1" || yearRaw === "2" ? yearRaw : "";
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

async function withAncestors(hit) {
  if (hit.source !== "drive" || !hit.nodeId || typeof driveNodeModel.findAncestors !== "function") {
    hit.ancestors = hit.ancestors || [];
    return hit;
  }
  const ancestors = await driveNodeModel.findAncestors(hit.nodeId);
  hit.ancestors = ancestors || [];
  return hit;
}

async function decorateHit(user, hit) {
  if (hit.source === "drive") {
    const raw =
      typeof driveNodeModel.findById === "function"
        ? await driveNodeModel.findById(hit.nodeId)
        : null;
    if (!raw) {
      return null;
    }
    raw.ancestors = hit.ancestors || [];
    const decision = await materialGate.authorizeDriveNode(user, raw);
    hit.protected = decision.protected;
    hit.canPreview = decision.canPreview;
    hit.canDownload = decision.canDownload;
    hit.accessCode = decision.code || null;
    return hit;
  }
  const decision = await materialGate.authorizeNote(user, hit);
  hit.protected = decision.protected;
  hit.canPreview = decision.canPreview;
  hit.canDownload = decision.canDownload;
  hit.accessCode = decision.code || null;
  return hit;
}

async function searchLibrary(user, query, reqQuery) {
  const q = String(query || "").trim();
  const pagination = noteService.parsePagination(reqQuery || {});
  const filters = parseFilters(reqQuery || {});

  let driveRows = [];
  if (typeof driveNodeModel.search === "function") {
    driveRows = await driveNodeModel.search(q, {
      kind: filters.kind || undefined,
      limit: CANDIDATE_CAP,
    });
  }

  let noteRows = [];
  if (typeof noteModel.search === "function") {
    noteRows = await noteModel.search(q, { limit: CANDIDATE_CAP });
  }

  const driveHits = (driveRows || []).map(toDriveHit);
  const noteHits = (noteRows || []).map(toNoteHit);
  const merged = ranking.dedupeSearchHits(driveHits, noteHits);
  const filtered = ranking.applySearchFilters(merged, filters);
  const ranked = ranking.sortSearchHits(filtered, q);
  const page = ranking.paginateSearchHits(ranked, pagination);

  const items = [];
  for (let i = 0; i < page.items.length; i++) {
    const withPath = await withAncestors(page.items[i]);
    const decorated = await decorateHit(user, withPath);
    if (decorated) items.push(decorated);
  }

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
