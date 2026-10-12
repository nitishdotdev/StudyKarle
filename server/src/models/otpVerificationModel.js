const db = require("../config/db");

const TABLE = "otp_verifications";

module.exports = {
  async create(data) {
    const rows = await db(TABLE)
      .insert({
        email: data.email.toLowerCase(),
        name: data.name || null,
        password_hash: data.passwordHash || null,
        otp: data.otp,
        expires_at: data.expiresAt,
        resend_count: data.resendCount || 0,
        purpose: data.purpose || "signup",
        attempts: data.attempts || 0,
        consumed_at: null,
      })
      .returning("*");
    return rows[0];
  },

  async findByEmail(email) {
    return db(TABLE)
      .where({ email: String(email).toLowerCase() })
      .whereNull("consumed_at")
      .orderBy("created_at", "desc")
      .first();
  },

  async findLatestByEmailAndPurpose(email, purpose) {
    return db(TABLE)
      .where({
        email: String(email).toLowerCase(),
        purpose: purpose,
      })
      .whereNull("consumed_at")
      .orderBy("created_at", "desc")
      .first();
  },

  async findByEmailAndOtp(email, otp) {
    return db(TABLE)
      .where({
        email: String(email).toLowerCase(),
        otp: String(otp),
      })
      .whereNull("consumed_at")
      .first();
  },

  async incrementAttempts(id) {
    return db(TABLE)
      .where({ id: id })
      .increment("attempts", 1)
      .update({ updated_at: db.fn.now() });
  },

  async consume(id) {
    return db(TABLE)
      .where({ id: id })
      .whereNull("consumed_at")
      .update({ consumed_at: db.fn.now(), updated_at: db.fn.now() });
  },

  async incrementResendCount(email) {
    return db(TABLE)
      .where({ email: String(email).toLowerCase() })
      .increment("resend_count", 1)
      .update({ updated_at: db.fn.now() });
  },

  async removeByEmail(email) {
    return db(TABLE).where({ email: String(email).toLowerCase() }).del();
  },

  async removeByEmailAndPurpose(email, purpose) {
    return db(TABLE)
      .where({
        email: String(email).toLowerCase(),
        purpose: purpose,
      })
      .del();
  },

  async consumeByEmailAndPurpose(email, purpose) {
    return db(TABLE)
      .where({
        email: String(email).toLowerCase(),
        purpose: purpose,
      })
      .whereNull("consumed_at")
      .update({ consumed_at: db.fn.now(), updated_at: db.fn.now() });
  },

  async removeExpired() {
    return db(TABLE).where("expires_at", "<", db.fn.now()).del();
  },
};
