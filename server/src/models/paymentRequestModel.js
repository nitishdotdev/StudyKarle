const db = require("../config/db");

const TABLE = "payment_requests";

const PUBLIC_COLUMNS = [
  "id",
  "user_id",
  "payment_reference",
  "amount_rupees",
  "currency",
  "upi_id",
  "payee_name",
  "status",
  "utr",
  "proof_mime_type",
  "proof_filename",
  "proof_size_bytes",
  "submitted_at",
  "reviewed_at",
  "reviewed_by",
  "review_note",
  "created_at",
  "updated_at",
];

module.exports = {
  async create(data) {
    const rows = await db(TABLE)
      .insert({
        user_id: data.user_id,
        payment_reference: data.payment_reference,
        amount_rupees: data.amount_rupees,
        currency: data.currency || "INR",
        upi_id: data.upi_id || null,
        payee_name: data.payee_name || null,
        status: data.status || "pending",
        utr: data.utr || null,
        proof_bytes: data.proof_bytes || null,
        proof_mime_type: data.proof_mime_type || null,
        proof_filename: data.proof_filename || null,
        proof_size_bytes: data.proof_size_bytes || null,
        submitted_at: data.submitted_at || null,
      })
      .returning("*");
    return rows[0];
  },

  async findById(id) {
    return db(TABLE).where({ id: id }).first();
  },

  async findByReference(ref) {
    return db(TABLE).where({ payment_reference: ref }).first();
  },

  async findLatestByUser(userId) {
    return db(TABLE).where({ user_id: userId }).orderBy("id", "desc").first();
  },

  async findByUser(userId) {
    return db(TABLE)
      .select(PUBLIC_COLUMNS)
      .where({ user_id: userId })
      .orderBy("id", "desc");
  },

  async list(filters) {
    const query = db(TABLE)
      .leftJoin("users", "users.id", "payment_requests.user_id")
      .select(
        PUBLIC_COLUMNS.map(function (col) {
          return "payment_requests." + col;
        }).concat([
          "users.name as student_name",
          "users.email as student_email",
        ])
      )
      .orderBy("payment_requests.id", "desc");
    if (filters && filters.status) {
      query.where("payment_requests.status", filters.status);
    }
    return query;
  },

  async update(id, patch) {
    const data = Object.assign({}, patch, { updated_at: new Date() });
    const rows = await db(TABLE).where({ id: id }).update(data).returning("*");
    return rows[0] || null;
  },
};
