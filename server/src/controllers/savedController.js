const savedNoteModel = require('../models/savedNoteModel');
const savedFileModel = require('../models/savedFileModel');
const noteModel = require('../models/noteModel');
const driveNodeModel = require('../models/driveNodeModel');
const materialGate = require('../services/materialGateService');
const asyncHandler = require('../middleware/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

async function decorateNotes(user, notes) {
  const rows = notes || [];
  for (let i = 0; i < rows.length; i++) {
    const decision = await materialGate.authorizeNote(user, rows[i]);
    rows[i].protected = decision.protected;
    rows[i].canPreview = decision.canPreview;
    rows[i].canDownload = decision.canDownload;
    rows[i].accessCode = decision.code || null;
  }
  return rows;
}

async function decorateFiles(user, files) {
  const rows = files || [];
  for (let i = 0; i < rows.length; i++) {
    const raw = await driveNodeModel.findFileById(rows[i].driveId);
    if (!raw) continue;
    const decision = await materialGate.authorizeDriveNode(user, raw);
    rows[i].protected = decision.protected;
    rows[i].canPreview = decision.canPreview;
    rows[i].canDownload = decision.canDownload;
    rows[i].accessCode = decision.code || null;
  }
  return rows;
}

module.exports = {
  list: asyncHandler(async function (req, res) {
    const [notes, files] = await Promise.all([
      savedNoteModel.findByUser(req.user.id),
      savedFileModel.findByUser(req.user.id),
    ]);
    await decorateNotes(req.user, notes);
    await decorateFiles(req.user, files);
    return ApiResponse.ok(res, { notes: notes, files: files });
  }),

  save: asyncHandler(async function (req, res) {
    const note = await noteModel.findRawById(req.params.noteId);
    if (!note || note.status !== 'published') {
      throw ApiError.notFound('Note not found');
    }
    await savedNoteModel.create(req.user.id, req.params.noteId);
    return ApiResponse.created(res, { saved: true });
  }),

  unsave: asyncHandler(async function (req, res) {
    await savedNoteModel.remove(req.user.id, req.params.noteId);
    return ApiResponse.ok(res, { saved: false });
  }),

  fileStatus: asyncHandler(async function (req, res) {
    const node = await driveNodeModel.findFileById(req.params.nodeId);
    if (!node) {
      throw ApiError.notFound('File not found');
    }
    const saved = await savedFileModel.exists(req.user.id, req.params.nodeId);
    return ApiResponse.ok(res, { saved: saved });
  }),

  saveFile: asyncHandler(async function (req, res) {
    const node = await driveNodeModel.findFileById(req.params.nodeId);
    if (!node) {
      throw ApiError.notFound('File not found');
    }
    await savedFileModel.create(req.user.id, req.params.nodeId);
    return ApiResponse.created(res, { saved: true });
  }),

  unsaveFile: asyncHandler(async function (req, res) {
    await savedFileModel.remove(req.user.id, req.params.nodeId);
    return ApiResponse.ok(res, { saved: false });
  }),
};
