const userModel = require('../models/userModel');
const authService = require('../services/authService');
const savedNoteModel = require('../models/savedNoteModel');
const savedFileModel = require('../models/savedFileModel');
const viewHistoryModel = require('../models/viewHistoryModel');
const continueStudyingService = require('../services/continueStudyingService');
const asyncHandler = require('../middleware/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');

module.exports = {
  getMe: asyncHandler(async function (req, res) {
    const user = await userModel.findPublicById(req.user.id);
    const [savedCount, savedFileCount] = await Promise.all([
      savedNoteModel.countByUser(req.user.id),
      savedFileModel.countByUser(req.user.id),
    ]);
    const recentViews = await viewHistoryModel.findByUser(req.user.id, 5);
    return ApiResponse.ok(res, {
      user: user,
      savedCount: savedCount + savedFileCount,
      recentViews: recentViews,
    });
  }),

  updateMe: asyncHandler(async function (req, res) {
    const updated = await userModel.updateProfile(req.user.id, {
      name: req.body.name,
      course: req.body.course,
      currentYear: req.body.currentYear
    });
    return ApiResponse.ok(res, updated);
  }),

  changePassword: asyncHandler(async function (req, res) {
    await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    return ApiResponse.ok(res, { updated: true });
  }),

  continueStudying: asyncHandler(async function (req, res) {
    const items = await continueStudyingService.listForStudent(req.user);
    return ApiResponse.ok(res, { items: items });
  })
};
