const db = require("../config/db");
const ApiError = require("../utils/ApiError");
const activity = require("./adminActivityModel");

const TABLE = "semester_access";

function query(trx) {
  return trx || db;
}

module.exports = {
  async findByUserId(userId, trx) {
    return query(trx)(TABLE).where({ user_id: userId }).first();
  },

  async listForAdmin({ email, status, page, limit }) {
    const rows = db(TABLE + " as access")
      .join("users as student", "student.id", "access.user_id")
      .leftJoin("payment_requests as payment", "payment.id", "access.payment_request_id")
      .where("student.role", "student");
    if (email) rows.andWhereRaw("position(lower(?) in lower(student.email)) > 0", [email]);
    if (status === "active") rows.whereNull("access.revoked_at").where("access.ends_at", ">", db.fn.now());
    if (status === "revoked") rows.whereNotNull("access.revoked_at");
    if (status === "expired") rows.whereNull("access.revoked_at").where("access.ends_at", "<=", db.fn.now());

    const [summary, data] = await Promise.all([
      rows.clone().count("access.id as total").first(),
      rows.select(
        "access.id", "access.starts_at as startsAt", "access.ends_at as endsAt",
        "access.revoked_at as revokedAt", "student.name", "student.email",
        "payment.payment_reference as paymentReference", "payment.reviewed_at as reviewedAt"
      ).orderBy("access.ends_at", "desc").orderBy("access.id", "desc")
        .limit(limit).offset((page - 1) * limit),
    ]);
    return {
      items: data.map((row) => ({
        ...row,
        status: row.revokedAt ? "revoked" : new Date(row.endsAt).getTime() > Date.now() ? "active" : "expired",
      })),
      totalPages: Math.ceil(Number(summary.total) / limit),
    };
  },

  async setRevoked(id, revoked, adminId) {
    return db.transaction(async (trx) => {
      const access = await trx(TABLE).where("id", id).forUpdate().first();
      if (!access) throw ApiError.notFound("Semester access record not found");
      const now = new Date();
      if (!revoked && new Date(access.ends_at) <= now) {
        throw ApiError.conflict("This semester pass has expired");
      }
      if (!!access.revoked_at === revoked) return;
      await trx(TABLE).where("id", id).update({
        revoked_at: revoked ? now : null,
        revoked_by: revoked ? adminId : null,
        updated_at: now,
      });
      await activity.log(adminId, revoked ? "access_revoked" : "access_restored", TABLE, id, {
        userId: access.user_id, paymentRequestId: access.payment_request_id,
      }, trx);
    });
  },

  async upsertForUser(userId, data, trx) {
    const q = query(trx);
    const existing = await q(TABLE).where({ user_id: userId }).first();
    const patch = {
      payment_request_id: data.payment_request_id,
      ends_at: data.ends_at,
      revoked_at: null,
      revoked_by: null,
      starts_at: data.starts_at || new Date(),
      updated_at: new Date(),
    };
    if (existing) {
      const rows = await q(TABLE)
        .where({ user_id: userId })
        .update(patch)
        .returning("*");
      return rows[0];
    }
    const rows = await q(TABLE)
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
