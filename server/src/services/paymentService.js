const crypto = require("crypto");
const paymentRequestModel = require("../models/paymentRequestModel");
const semesterAccessModel = require("../models/semesterAccessModel");
const accessEntitlementService = require("./accessEntitlementService");
const paymentConfig = require("../config/paymentConfig");
const { validatePaymentProof } = require("./paymentProofService");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

async function qrDataUrl(upiUri) {
  try {
    const QRCode = require("qrcode");
    return await QRCode.toDataURL(upiUri, { margin: 1, width: 280, errorCorrectionLevel: "M" });
  } catch (err) {
    logger.error("Failed to generate UPI QR code", err);
    return null;
  }
}

function randomReference() {
  return "SK-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function uniqueReference() {
  for (let i = 0; i < 8; i++) {
    const ref = randomReference();
    const existing = await paymentRequestModel.findByReference(ref);
    if (!existing) return ref;
  }
  return "SK-" + Date.now().toString(36).toUpperCase();
}

function toStudentPaymentView(row) {
  if (!row) return null;
  return {
    id: row.id,
    paymentReference: row.payment_reference,
    amountRupees: row.amount_rupees,
    currency: row.currency || "INR",
    status: row.status,
    utr: row.utr || null,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    hasScreenshot: !!(row.proof_bytes || row.proof_size_bytes),
  };
}

function requireAvailableConfig() {
  const cfg = paymentConfig.getPaymentConfig();
  if (!cfg.available) {
    throw new ApiError(503, cfg.unavailableReason || "Checkout is temporarily unavailable.");
  }
  return cfg;
}

async function checkout(user) {
  const cfg = requireAvailableConfig();
  const state = await accessEntitlementService.getEntitlementState(user.id);
  if (state.hasAccess) {
    return {
      alreadyActive: true,
      hasAccess: true,
      status: "approved",
      endsAt: state.endsAt,
      amountRupees: cfg.amountRupees,
      paymentReference: state.payment ? state.payment.payment_reference : null,
    };
  }

  if (state.payment && state.payment.status === "pending") {
    const upiUri = paymentConfig.buildUpiUri(cfg, state.payment.payment_reference);
    return {
      reused: true,
      hasAccess: false,
      status: "pending",
      amountRupees: cfg.amountRupees,
      amountFormatted: cfg.amountFormatted,
      currency: cfg.currency,
      upiId: cfg.upiId,
      payeeName: cfg.payeeName,
      paymentReference: state.payment.payment_reference,
      accessEndsAt: cfg.accessEndsAt,
      upiUri: upiUri,
      qrDataUrl: await qrDataUrl(upiUri),
      supportUrl: cfg.supportUrl,
      submitted: !!(state.payment.submitted_at || state.payment.proof_size_bytes),
    };
  }

  const reference = await uniqueReference();
  await paymentRequestModel.create({
    user_id: user.id,
    payment_reference: reference,
    amount_rupees: cfg.amountRupees,
    currency: cfg.currency,
    upi_id: cfg.upiId,
    payee_name: cfg.payeeName,
    status: "pending",
  });

  const upiUri = paymentConfig.buildUpiUri(cfg, reference);
  return {
    reused: false,
    hasAccess: false,
    status: "pending",
    amountRupees: cfg.amountRupees,
    amountFormatted: cfg.amountFormatted,
    currency: cfg.currency,
    upiId: cfg.upiId,
    payeeName: cfg.payeeName,
    paymentReference: reference,
    accessEndsAt: cfg.accessEndsAt,
    upiUri: upiUri,
    qrDataUrl: await qrDataUrl(upiUri),
    supportUrl: cfg.supportUrl,
    submitted: false,
  };
}

async function submitProof(user, file, utr) {
  const latest = await paymentRequestModel.findLatestByUser(user.id);
  if (!latest || latest.status === "approved") {
    throw ApiError.badRequest("Start checkout before submitting payment proof.");
  }
  if (latest.status === "approved") {
    throw ApiError.conflict("This payment has already been approved.");
  }

  const check = validatePaymentProof(file);
  if (!check.ok) {
    throw ApiError.badRequest(check.error);
  }

  const cleanUtr = utr ? String(utr).trim().slice(0, 64) : null;
  const updated = await paymentRequestModel.update(latest.id, {
    status: "pending",
    utr: cleanUtr || latest.utr || null,
    proof_bytes: file.buffer,
    proof_mime_type: check.mimeType,
    proof_filename: check.originalName,
    proof_size_bytes: check.size,
    submitted_at: new Date(),
  });

  return toStudentPaymentView(updated);
}

async function listMine(user) {
  const rows = await paymentRequestModel.findByUser(user.id);
  const access = await accessEntitlementService.getEntitlementState(user.id);
  return {
    hasAccess: access.hasAccess,
    status: access.status,
    endsAt: access.endsAt,
    payments: (rows || []).map(toStudentPaymentView),
  };
}

async function getMineById(user, id) {
  const row = await paymentRequestModel.findById(id);
  if (!row || row.user_id !== user.id) {
    throw ApiError.notFound("Payment not found");
  }
  return toStudentPaymentView(row);
}

function toAdminPaymentView(row) {
  return {
    id: row.id,
    paymentReference: row.payment_reference,
    amountRupees: row.amount_rupees,
    currency: row.currency || "INR",
    status: row.status,
    utr: row.utr || null,
    studentId: row.user_id,
    studentName: row.student_name || null,
    studentEmail: row.student_email || null,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    reviewNote: row.review_note,
    hasScreenshot: !!(row.proof_bytes || row.proof_size_bytes),
    proofMimeType: row.proof_mime_type,
  };
}

async function adminList(filters) {
  const rows = await paymentRequestModel.list(filters || {});
  return { payments: (rows || []).map(toAdminPaymentView) };
}

async function adminGet(id) {
  const rows = await paymentRequestModel.list({});
  const row = (rows || []).find(function (item) {
    return Number(item.id) === Number(id);
  });
  if (!row) {
    const fallback = await paymentRequestModel.findById(id);
    if (!fallback) throw ApiError.notFound("Payment not found");
    return toAdminPaymentView(fallback);
  }
  return toAdminPaymentView(row);
}

async function adminScreenshot(id) {
  const row = await paymentRequestModel.findById(id);
  if (!row || !row.proof_bytes) {
    throw ApiError.notFound("Payment screenshot not found");
  }
  return {
    bytes: row.proof_bytes,
    mimeType: row.proof_mime_type || "image/jpeg",
    filename: row.proof_filename || "payment-proof",
  };
}

async function approve(adminUser, id) {
  const cfg = requireAvailableConfig();
  const row = await paymentRequestModel.findById(id);
  if (!row) throw ApiError.notFound("Payment not found");
  if (row.status === "approved") {
    const existing = await semesterAccessModel.findByUserId(row.user_id);
    return { payment: row, entitlement: existing };
  }

  const updated = await paymentRequestModel.update(id, {
    status: "approved",
    reviewed_at: new Date(),
    reviewed_by: adminUser.id,
  });

  const entitlement = await semesterAccessModel.upsertForUser(row.user_id, {
    payment_request_id: updated.id,
    ends_at: cfg.accessEndsAt,
    starts_at: new Date(),
  });

  return { payment: updated, entitlement: entitlement };
}

async function reject(adminUser, id, note) {
  const row = await paymentRequestModel.findById(id);
  if (!row) throw ApiError.notFound("Payment not found");
  const updated = await paymentRequestModel.update(id, {
    status: "rejected",
    reviewed_at: new Date(),
    reviewed_by: adminUser.id,
    review_note: note ? String(note).slice(0, 500) : null,
  });
  return { payment: updated };
}

module.exports = {
  checkout,
  submitProof,
  listMine,
  getMineById,
  adminList,
  adminGet,
  adminScreenshot,
  approve,
  reject,
  toStudentPaymentView,
};
