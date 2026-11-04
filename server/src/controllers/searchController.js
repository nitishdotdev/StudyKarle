const searchService = require("../services/searchService");
const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");

module.exports = {
  search: asyncHandler(async function (req, res) {
    const query = req.query.q;
    const result = await searchService.searchLibrary(req.user, query, req.query);
    return ApiResponse.ok(res, result.items, result.meta);
  }),
};
