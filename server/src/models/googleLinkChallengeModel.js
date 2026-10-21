const db = require("../config/db");

const TABLE = "google_link_challenges";
const USERS = "users";

// Sentinel used internally to force a transaction rollback when the atomic
// consume+link cannot proceed. It is never surfaced to callers.
function linkReasonError(reason) {
  const err = new Error("google-link-reason:" + reason);
  err.isGoogleLinkReason = true;
  err.linkReason = reason;
  return err;
}

module.exports = {
  async create(data) {
    const rows = await db(TABLE)
      .insert({
        user_id: data.userId,
        google_sub: data.googleSub,
        google_email: data.googleEmail,
        google_name: data.googleName || null,
        google_picture: data.googlePicture || null,
        redirect_path: data.redirectPath || null,
        ticket_hash: data.ticketHash,
        expires_at: data.expiresAt,
        consumed_at: null,
        attempts: 0,
        otp_hash: null,
        otp_expires_at: null,
        otp_attempts: 0,
        otp_resend_count: 0,
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

  async findById(id) {
    return db(TABLE).where({ id: id }).first();
  },

  async consume(id) {
    return db(TABLE)
      .where({ id: id })
      .whereNull("consumed_at")
      .update({ consumed_at: db.fn.now() });
  },

  // Invalidate any other outstanding challenge for the same account so a
  // second Google attempt supersedes the first.
  async consumeAllForUser(userId) {
    return db(TABLE)
      .where({ user_id: userId })
      .whereNull("consumed_at")
      .update({ consumed_at: db.fn.now() });
  },

  async incrementAttempts(id) {
    return db(TABLE).where({ id: id }).increment("attempts", 1);
  },

  async setOtp(id, otpHash, expiresAt, resendCount) {
    return db(TABLE).where({ id: id }).update({
      otp_hash: otpHash,
      otp_expires_at: expiresAt,
      otp_attempts: 0,
      otp_resend_count: resendCount || 0,
    });
  },

  async incrementOtpAttempts(id) {
    return db(TABLE).where({ id: id }).increment("otp_attempts", 1);
  },

  async clearOtp(id) {
    return db(TABLE).where({ id: id }).update({
      otp_hash: null,
      otp_expires_at: null,
      otp_attempts: 0,
    });
  },

  /**
   * Atomically consume the challenge and attach the Google subject to the
   * bound account.
   *
   *   - The challenge row is consumed conditionally (only if not already
   *     consumed), so a ticket can be used at most once even under concurrency.
   *   - The user is updated conditionally on `google_sub IS NULL`, so an
   *     account that already has a (possibly different) Google identity is
   *     never overwritten.
   *   - `google_sub` has a UNIQUE constraint, so if a concurrent request linked
   *     the same Google identity to another account first, the UPDATE raises
   *     23505 (unique_violation), the transaction rolls back and the challenge
   *     is NOT consumed.
   *
   * @returns {Promise<{ok:boolean, user?:object, reason?:string}>}
   */
  async consumeAndLinkGoogleSub(challenge) {
    try {
      return await db.transaction(async function (trx) {
        const consumed = await trx(TABLE)
          .where({ id: challenge.id })
          .whereNull("consumed_at")
          .update({ consumed_at: db.fn.now() });
        if (!consumed) {
          throw linkReasonError("consumed");
        }

        const linked = await trx(USERS)
          .where({ id: challenge.user_id })
          .whereNull("google_sub")
          .update({
            google_sub: challenge.google_sub,
            updated_at: db.fn.now(),
          })
          .returning("*");

        if (!linked || !linked.length) {
          throw linkReasonError("already_linked");
        }

        return { ok: true, user: linked[0] };
      });
    } catch (err) {
      if (err && err.isGoogleLinkReason) {
        return { ok: false, reason: err.linkReason };
      }
      // Unique violation: the Google subject was linked to another user by a
      // concurrent request between our checks and this update.
      if (err && err.code === "23505") {
        return { ok: false, reason: "sub_taken" };
      }
      throw err;
    }
  },
};
