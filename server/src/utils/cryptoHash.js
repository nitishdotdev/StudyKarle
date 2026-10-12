const crypto = require("crypto");
const env = require("../config/env");

function hmacSha256(value) {
  return crypto
    .createHmac("sha256", env.jwtSecret)
    .update(String(value))
    .digest("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes || 32).toString("hex");
}

function generateNumericOtp() {
  const num = crypto.randomBytes(4).readUInt32BE(0);
  return String(100000 + (num % 900000));
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(String(a), "utf8");
  const right = Buffer.from(String(b), "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

module.exports = {
  hmacSha256: hmacSha256,
  sha256: sha256,
  randomToken: randomToken,
  generateNumericOtp: generateNumericOtp,
  timingSafeEqualHex: timingSafeEqualHex,
};
