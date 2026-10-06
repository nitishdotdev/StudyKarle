const noteModel = require("../models/noteModel");
const subjectModel = require("../models/subjectModel");
const userModel = require("../models/userModel");
const savedNoteModel = require("../models/savedNoteModel");
const viewHistoryModel = require("../models/viewHistoryModel");
const adminActivityModel = require("../models/adminActivityModel");
const noteService = require("../services/noteService");
const adminNoteService = require("../services/adminNoteService");
const pdfActivityService = require("../services/pdfActivityService");
const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

module.exports = {
  stats: asyncHandler(async function (req, res) {
    const totalNotes = await noteModel.countAll();
    const totalUsers = await userModel.count();
    const totalViews = await viewHistoryModel.totalViews();
    const totalSizeBytes = await noteModel.sumSizeBytes();
    const recentUploads = await noteModel.findRecent(5);
    const recentActivity = await adminActivityModel.recent(10);
    const pdfActivity = await pdfActivityService.recent();

    return ApiResponse.ok(res, {
      totalNotes: totalNotes,
      totalUsers: totalUsers,
      totalViews: totalViews,
      totalSizeBytes: totalSizeBytes,
      recentUploads: recentUploads,
      recentActivity: recentActivity,
      pdfActivity: pdfActivity,
    });
  }),

  listNotes: asyncHandler(async function (req, res) {
    const pagination = noteService.parsePagination(req.query);
    const params = Object.assign({ search: req.query.search }, pagination);
    const notes = await noteModel.listForAdmin(params);
    const total = await noteModel.countForAdmin(params);
    return ApiResponse.ok(
      res,
      notes,
      noteService.buildMeta(pagination.page, pagination.limit, total)
    );
  }),

  createNote: asyncHandler(async function (req, res) {
    const note = await noteService.uploadNote(
      req.file,
      {
        title: req.body.title,
        description: req.body.description,
        subjectId: req.body.subjectId,
        unitId: req.body.unitId,
        status: req.body.status,
      },
      req.user.id
    );
    await adminActivityModel.log(req.user.id, "note.create", "note", note.id, {
      title: note.title,
    });
    return ApiResponse.created(res, note);
  }),

  bulkUploadNotes: asyncHandler(async function (req, res) {
    if (!req.files || req.files.length === 0) {
      throw ApiError.badRequest("No files uploaded");
    }

    const { subjectId, unitId, description } = req.body;

    if (!subjectId) {
      throw ApiError.badRequest("Subject ID is required");
    }

    const results = await adminNoteService.bulkUploadNotes(req.files, {
      subjectId: Number(subjectId),
      unitId: unitId ? Number(unitId) : null,
      uploadedBy: req.user.id,
      description: description || null,
    });

    await adminActivityModel.log(
      req.user.id,
      "note.bulk_upload",
      "note",
      null,
      {
        subjectId,
        unitId,
        count: results.success.length,
        failed: results.failed.length,
      }
    );

    return ApiResponse.ok(res, {
      message: `Uploaded ${results.success.length} note(s)`,
      successful: results.success,
      failed: results.failed,
    });
  }),

  updateNote: asyncHandler(async function (req, res) {
    const note = await noteModel.update(req.params.id, req.body);
    if (!note) {
      throw ApiError.notFound("Note not found");
    }
    await adminActivityModel.log(
      req.user.id,
      "note.update",
      "note",
      note.id,
      {}
    );
    return ApiResponse.ok(res, note);
  }),

  deleteNote: asyncHandler(async function (req, res) {
    await noteService.deleteNote(req.params.id);
    await adminActivityModel.log(
      req.user.id,
      "note.delete",
      "note",
      Number(req.params.id),
      {}
    );
    return ApiResponse.ok(res, { deleted: true });
  }),

  listSubjects: asyncHandler(async function (req, res) {
    const subjects = await subjectModel.listAllForAdmin();
    return ApiResponse.ok(res, subjects);
  }),

  createSubject: asyncHandler(async function (req, res) {
    const subject = await subjectModel.create(req.body);
    await adminActivityModel.log(
      req.user.id,
      "subject.create",
      "subject",
      subject.id,
      {
        name: subject.name,
      }
    );
    return ApiResponse.created(res, subject);
  }),

  updateSubject: asyncHandler(async function (req, res) {
    const subject = await subjectModel.update(req.params.id, req.body);
    if (!subject) {
      throw ApiError.notFound("Subject not found");
    }
    await adminActivityModel.log(
      req.user.id,
      "subject.update",
      "subject",
      subject.id,
      {}
    );
    return ApiResponse.ok(res, subject);
  }),

  deleteSubject: asyncHandler(async function (req, res) {
    await subjectModel.remove(req.params.id);
    await adminActivityModel.log(
      req.user.id,
      "subject.delete",
      "subject",
      Number(req.params.id),
      {}
    );
    return ApiResponse.ok(res, { deleted: true });
  }),

  listUsers: asyncHandler(async function (req, res) {
    const pagination = noteService.parsePagination(req.query);
    const params = Object.assign({ search: req.query.search }, pagination);
    const users = await userModel.list(params);
    const total = await userModel.count(params);
    return ApiResponse.ok(
      res,
      users,
      noteService.buildMeta(pagination.page, pagination.limit, total)
    );
  }),

  updateUserRole: asyncHandler(async function (req, res) {
    if (["student", "admin"].indexOf(req.body.role) === -1) {
      throw ApiError.badRequest("Invalid role");
    }
    if (Number(req.params.id) === req.user.id) {
      throw ApiError.badRequest("You cannot change your own role");
    }
    const user = await userModel.updateRole(req.params.id, req.body.role);
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    await adminActivityModel.log(
      req.user.id,
      "user.role_change",
      "user",
      user.id,
      {
        role: req.body.role,
      }
    );
    return ApiResponse.ok(res, user);
  }),

  deleteUser: asyncHandler(async function (req, res) {
    if (Number(req.params.id) === req.user.id) {
      throw ApiError.badRequest("You cannot delete your own account");
    }
    await userModel.remove(req.params.id);
    await adminActivityModel.log(
      req.user.id,
      "user.delete",
      "user",
      Number(req.params.id),
      {}
    );
    return ApiResponse.ok(res, { deleted: true });
  }),

  viewHistory: asyncHandler(async function (req, res) {
    const limit = parseInt(req.query.limit, 10) || 100;
    const history = await viewHistoryModel.findAll(limit);
    return ApiResponse.ok(res, history);
  }),

  activity: asyncHandler(async function (req, res) {
    const limit = parseInt(req.query.limit, 10) || 30;
    const activity = await adminActivityModel.recent(limit);
    return ApiResponse.ok(res, activity);
  }),

  // User PDF activity (opened / downloaded / shared) for the Recent Activity
  // dashboard. Admin-only via the admin router's authenticate+authorize.
  pdfActivity: asyncHandler(async function (req, res) {
    const limit = parseInt(req.query.limit, 10) || 20;
    const activity = await pdfActivityService.recent(limit);
    return ApiResponse.ok(res, activity);
  }),

  // Clears ONLY the pdf_activity rows backing the Recent Activity dashboard.
  // Security/audit logs (admin_activity, view_history) are never touched.
  clearPdfActivity: asyncHandler(async function (req, res) {
    const deleted = await pdfActivityService.clear();
    return ApiResponse.ok(res, { cleared: true, deleted: deleted });
  }),

  // ─── Google Drive sync ───
  driveSyncStatus: asyncHandler(async function (req, res) {
    const driveSyncService = require("../services/driveSyncService");
    const status = await driveSyncService.getSyncStatus();
    return ApiResponse.ok(res, status);
  }),

  triggerDriveSync: asyncHandler(async function (req, res) {
    const driveSyncService = require("../services/driveSyncService");
    // runSync never throws; it returns a result object with a status field.
    const result = await driveSyncService.runSync();
    return ApiResponse.ok(res, result);
  }),
};
