const { MAX_PROOF_BYTES, ALLOWED_PROOF_TYPES } = require("../config/paymentConfig");

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function startsWith(buffer, magic) {
  if (!buffer || buffer.length < magic.length) return false;
  return buffer.slice(0, magic.length).equals(magic);
}

function isWebp(buffer) {
  if (!buffer || buffer.length < 12) return false;
  return (
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP"
  );
}

function sniffMime(buffer) {
  if (startsWith(buffer, JPEG_MAGIC)) return "image/jpeg";
  if (startsWith(buffer, PNG_MAGIC)) return "image/png";
  if (isWebp(buffer)) return "image/webp";
  return null;
}

function validatePaymentProof(file) {
  if (!file || !file.buffer || !file.buffer.length) {
    return { ok: false, error: "Payment screenshot is required." };
  }
  const size = Number(file.size != null ? file.size : file.buffer.length);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "Payment screenshot is required." };
  }
  if (size > MAX_PROOF_BYTES) {
    return { ok: false, error: "Payment screenshot must be 5MB or smaller." };
  }
  const sniffed = sniffMime(file.buffer);
  if (!sniffed) {
    return { ok: false, error: "Payment screenshot must be a JPEG, PNG, or WEBP image." };
  }
  const declared = String(file.mimeType || file.mimetype || "").toLowerCase();
  if (declared && ALLOWED_PROOF_TYPES.indexOf(declared) === -1) {
    return { ok: false, error: "Payment screenshot must be a JPEG, PNG, or WEBP image." };
  }
  if (declared && declared !== sniffed) {
    return { ok: false, error: "Payment screenshot file content does not match its type." };
  }
  return {
    ok: true,
    mimeType: sniffed,
    size: size,
    originalName: file.originalName || file.originalname || "screenshot",
  };
}

module.exports = {
  validatePaymentProof,
  sniffMime,
};
