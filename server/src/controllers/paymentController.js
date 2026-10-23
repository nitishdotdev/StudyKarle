const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const paymentService = require("../services/paymentService");
const accessEntitlementService = require("../services/accessEntitlementService");
const paymentConfig = require("../config/paymentConfig");

module.exports = {
  offer: asyncHandler(async function (req, res) {
    const cfg = paymentConfig.getPaymentConfig();
    const state = await accessEntitlementService.getEntitlementState(req.user.id);
    return ApiResponse.ok(res, {
      amountRupees: cfg.amountRupees,
      amountFormatted: cfg.amountFormatted,
      currency: cfg.currency,
      available: cfg.available,
      unavailableReason: cfg.unavailableReason,
      accessEndsAt: cfg.accessEndsAt,
      payeeName: cfg.payeeName,
      supportUrl: cfg.supportUrl,
      hasAccess: state.hasAccess,
      status: state.status,
      endsAt: state.endsAt,
    });
  }),

  access: asyncHandler(async function (req, res) {
    const state = await accessEntitlementService.getEntitlementState(req.user.id);
    return ApiResponse.ok(res, {
      hasAccess: state.hasAccess,
      status: state.status,
      endsAt: state.endsAt,
    });
  }),

  previewCheckout: asyncHandler(async function (req, res) {
    const data = await paymentService.previewCheckout(req.user);
    return ApiResponse.ok(res, data);
  }),

  checkout: asyncHandler(async function (req, res) {
    const requestedReference = req.body && req.body.paymentReference;
    const data = await paymentService.checkout(req.user, requestedReference);
    if (data.reused || data.alreadyActive) {
      return ApiResponse.ok(res, data);
    }
    return ApiResponse.created(res, data);
  }),

  submit: asyncHandler(async function (req, res) {
    const file = req.file
      ? {
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          originalName: req.file.originalname,
          size: req.file.size,
        }
      : null;
    const utr = req.body && req.body.utr;
    const data = await paymentService.submitProof(req.user, file, utr);
    return ApiResponse.ok(res, data);
  }),

  me: asyncHandler(async function (req, res) {
    const data = await paymentService.listMine(req.user);
    return ApiResponse.ok(res, data);
  }),

  getMine: asyncHandler(async function (req, res) {
    const data = await paymentService.getMineById(req.user, req.params.id);
    return ApiResponse.ok(res, data);
  }),

  adminList: asyncHandler(async function (req, res) {
    const data = await paymentService.adminList({ status: req.query.status });
    return ApiResponse.ok(res, data);
  }),

  adminGet: asyncHandler(async function (req, res) {
    const data = await paymentService.adminGet(req.params.id);
    return ApiResponse.ok(res, data);
  }),

  adminScreenshot: asyncHandler(async function (req, res) {
    const shot = await paymentService.adminScreenshot(req.params.id);
    res.setHeader("Content-Type", shot.mimeType);
    res.setHeader("Content-Disposition", 'inline; filename="' + shot.filename + '"');
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).end(Buffer.isBuffer(shot.bytes) ? shot.bytes : Buffer.from(shot.bytes));
  }),

  adminApprove: asyncHandler(async function (req, res) {
    const result = await paymentService.approve(req.user, req.params.id);
    return ApiResponse.ok(res, {
      status: result.payment.status,
      reviewedAt: result.payment.reviewed_at,
      reviewedBy: result.payment.reviewed_by,
      endsAt: result.entitlement ? result.entitlement.ends_at : null,
    });
  }),

  adminReject: asyncHandler(async function (req, res) {
    const note = req.body && req.body.note;
    const result = await paymentService.reject(req.user, req.params.id, note);
    return ApiResponse.ok(res, {
      status: result.payment.status,
      reviewedAt: result.payment.reviewed_at,
      reviewedBy: result.payment.reviewed_by,
    });
  }),
};
