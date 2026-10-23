const AMOUNT_RUPEES = 9;
const CURRENCY = "INR";
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SUPPORT_INSTAGRAM = "https://www.instagram.com/nitishdotdev/";

function isValidUpiId(value) {
  const id = String(value || "").trim();
  if (!id) return false;
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(id);
}

function parseAccessEndsAt(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getPaymentConfig(now) {
  const upiId = String(process.env.PAYMENT_UPI_ID || "").trim();
  const payeeName = String(process.env.PAYMENT_PAYEE_NAME || "").trim() || "StudyKarle";
  const accessEndsAt = parseAccessEndsAt(process.env.PAYMENT_ACCESS_ENDS_AT);
  const current = now ? new Date(now) : new Date();

  if (!isValidUpiId(upiId)) {
    return {
      available: false,
      unavailableReason: "UPI payment destination is not configured.",
      amountRupees: AMOUNT_RUPEES,
      amountFormatted: AMOUNT_RUPEES.toFixed(2),
      currency: CURRENCY,
      payeeName: payeeName,
      upiId: null,
      accessEndsAt: null,
      supportUrl: SUPPORT_INSTAGRAM,
    };
  }

  if (!accessEndsAt) {
    return {
      available: false,
      unavailableReason: "Semester end date is missing or invalid.",
      amountRupees: AMOUNT_RUPEES,
      amountFormatted: AMOUNT_RUPEES.toFixed(2),
      currency: CURRENCY,
      payeeName: payeeName,
      upiId: upiId,
      accessEndsAt: null,
      supportUrl: SUPPORT_INSTAGRAM,
    };
  }

  if (accessEndsAt.getTime() <= current.getTime()) {
    return {
      available: false,
      unavailableReason: "Semester end date is in the past.",
      amountRupees: AMOUNT_RUPEES,
      amountFormatted: AMOUNT_RUPEES.toFixed(2),
      currency: CURRENCY,
      payeeName: payeeName,
      upiId: upiId,
      accessEndsAt: accessEndsAt,
      supportUrl: SUPPORT_INSTAGRAM,
    };
  }

  return {
    available: true,
    unavailableReason: null,
    amountRupees: AMOUNT_RUPEES,
    amountFormatted: AMOUNT_RUPEES.toFixed(2),
    currency: CURRENCY,
    payeeName: payeeName,
    upiId: upiId,
    accessEndsAt: accessEndsAt,
    supportUrl: SUPPORT_INSTAGRAM,
  };
}

function buildUpiUri(cfg, paymentReference) {
  function encode(value) {
    return encodeURIComponent(String(value || "")).replace(/%40/g, "@");
  }
  return (
    "upi://pay?pa=" +
    encode(cfg.upiId) +
    "&pn=" +
    encode(cfg.payeeName) +
    "&am=" +
    encode(cfg.amountFormatted) +
    "&cu=" +
    encode(cfg.currency) +
    "&tn=" +
    encode(paymentReference)
  );
}

module.exports = {
  AMOUNT_RUPEES,
  CURRENCY,
  MAX_PROOF_BYTES,
  ALLOWED_PROOF_TYPES,
  SUPPORT_INSTAGRAM,
  isValidUpiId,
  parseAccessEndsAt,
  getPaymentConfig,
  buildUpiUri,
};
