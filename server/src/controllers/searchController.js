const noteModel = require('../models/noteModel');
const noteService = require('../services/noteService');
const materialGate = require('../services/materialGateService');
const asyncHandler = require('../middleware/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');

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

module.exports = {
  search: asyncHandler(async function (req, res) {
    const query = req.query.q;
    const pagination = noteService.parsePagination(req.query);
    const results = await noteModel.search(query, pagination);
    const total = await noteModel.countSearch(query);
    await decorateNotes(req.user, results);
    return ApiResponse.ok(
      res,
      results,
      Object.assign({ query: query }, noteService.buildMeta(pagination.page, pagination.limit, total))
    );
  })
};
