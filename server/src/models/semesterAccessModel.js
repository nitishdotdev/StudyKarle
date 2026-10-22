const db = require("../config/db");

const TABLE = "semester_access";

module.exports = {
  async findByUserId(userId) {
    return db(TABLE).where({ user_id: userId }).first();
  },

  async upsertForUser(userId, data) {
    const existing = await this.findByUserId(userId);
    const patch = {
      payment_request_id: data.payment_request_id,
      ends_at: data.ends_at,
      starts_at: data.starts_at || new Date(),
      updated_at: new Date(),
    };
    if (existing) {
      const rows = await db(TABLE)
        .where({ user_id: userId })
        .update(patch)
        .returning("*");
      return rows[0];
    }
    const rows = await db(TABLE)
      .insert({
        user_id: userId,
        payment_request_id: patch.payment_request_id,
        starts_at: patch.starts_at,
        ends_at: patch.ends_at,
      })
      .returning("*");
    return rows[0];
  },
};
