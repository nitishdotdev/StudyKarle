const noteModel = require("../models/noteModel");
const viewHistoryModel = require("../models/viewHistoryModel");
const driveService = require("../services/driveService");
const pdfActivityService = require("../services/pdfActivityService");
const materialGate = require("../services/materialGateService");
const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

module.exports = {
  getById: asyncHandler(async function (req, res) {
    const note = await noteModel.findById(req.params.noteId);
    if (!note || note.status !== "published") {
      throw ApiError.notFound("Note not found");
    }
    const decision = await materialGate.authorizeNote(req.user, note);
    note.protected = decision.protected;
    note.canPreview = decision.canPreview;
    note.canDownload = decision.canDownload;
    note.accessCode = decision.code || null;
    return ApiResponse.ok(res, note);
  }),

  preview: asyncHandler(async function (req, res) {
    const note = await loadPublishedNote(req.params.noteId);
    await materialGate.assertNotePreview(req.user, note);

    // Don't block the PDF stream on the view-history write.
    viewHistoryModel.record(req.user.id, note.id).catch(function () {});

    // Version tag = Drive file id + Drive modified time, so a file updated in
    // Drive produces a fresh ETag and the browser re-fetches the new bytes
    // instead of serving a stale, long-cached copy.
    const etag = '"' + note.drive_file_id + ":" + driveVersion(note) + '"';
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="' + note.title + '.pdf"'
    );
    // Short, revalidating cache: previews are fast (304 when unchanged) while
    // still picking up Drive updates within the cache window.
    res.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
    res.setHeader("ETag", etag);
    res.setHeader("Accept-Ranges", "bytes");

    if (req.headers["if-none-match"] === etag) {
      await pdfActivityService.recordOpen(req.user.id, "note", String(note.id), note.title);
      return res.status(304).end();
    }

    await driveService.streamFile(note.drive_file_id, res, req.headers.range);
    // Record AFTER the stream completes so the event reflects a real open.
    // The service never rejects, so a logging failure can never break preview.
    await pdfActivityService.recordOpen(req.user.id, "note", String(note.id), note.title);
  }),

  download: asyncHandler(async function (req, res) {
    const note = await loadPublishedNote(req.params.noteId);
    await materialGate.assertNoteDownload(req.user, note);
    const etag = '"' + note.drive_file_id + ":" + driveVersion(note) + '"';
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="' + note.title + '.pdf"'
    );
    res.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
    res.setHeader("ETag", etag);
    res.setHeader("Accept-Ranges", "bytes");

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    await driveService.streamFile(note.drive_file_id, res, req.headers.range);
    // Only record once the download stream succeeded. If the Drive stream
    // throws, the error handler responds 500 and no download event is written.
    await pdfActivityService.recordDownload(req.user.id, "note", String(note.id), note.title);
  }),
};

async function loadPublishedNote(noteId) {
  const note = await noteModel.findById(noteId);
  if (!note || note.status !== "published") {
    throw ApiError.notFound("Note not found");
  }
  const raw = await noteModel.findRawById(noteId);
  return Object.assign({}, raw, note);
}

// Stable, content-aware version string used in the ETag.
function driveVersion(note) {
  if (note.drive_modified_time) {
    return Date.parse(note.drive_modified_time) || "v";
  }
  if (note.updated_at) {
    return Date.parse(note.updated_at) || "v";
  }
  return "v";
}
