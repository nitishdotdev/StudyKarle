const db = require("../config/db");

const TABLE = "oauth_login_tickets";

module.exports = {
  async create(data) {
    const rows = await db(TABLE)
      .insert({
        user_id: data.userId,
        ticket_hash: data.ticketHash,
        expires_at: data.expiresAt,
      })
      .returning("*");
    return rows[0];
  },

  async findValidByHash(ticketHash) {
    return db(TABLE)
      .where({ ticket_hash: ticketHash })
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
};
