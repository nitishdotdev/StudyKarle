const db = require("../config/db");

const TABLE = "password_reset_authorizations";

module.exports = {
  async create(data) {
    const rows = await db(TABLE)
      .insert({
        user_id: data.userId,
        token_hash: data.tokenHash,
        expires_at: data.expiresAt,
      })
      .returning("*");
    return rows[0];
  },

  async findValidByHash(tokenHash) {
    return db(TABLE)
      .where({ token_hash: tokenHash })
      .whereNull("consumed_at")
      .where("expires_at", ">", db.fn.now())
      .first();
  },

  async consume(id) {
    return db(TABLE)
      .where({ id: id })
      .whereNull("consumed_at")
      .update({ consumed_at: db.fn.now() });
  },

  async consumeAllForUser(userId) {
    return db(TABLE)
      .where({ user_id: userId })
      .whereNull("consumed_at")
      .update({ consumed_at: db.fn.now() });
  },
};
