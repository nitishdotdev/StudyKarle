/**
 * Google account-linking challenges.
 *
 * When a Google sign-in returns a verified identity whose email belongs to an
 * existing StudyKarle account that is NOT yet linked to that Google subject, we
 * must not silently take over the account (or dead-end the user). Instead we
 * create a short-lived, single-use challenge that binds:
 *
 *   - the existing StudyKarle account (user_id, chosen by the server), and
 *   - the verified Google subject + email from the ID token.
 *
 * The user then proves ownership (existing password, or an email OTP for
 * password-less accounts) and the Google subject is attached to that account.
 *
 * Only the SHA/ HMAC hash of the opaque ticket is stored, never the ticket
 * itself, so a database read cannot be replayed against the API.
 */
exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable("google_link_challenges");
  if (hasTable) {
    return;
  }

  await knex.schema.createTable("google_link_challenges", function (table) {
    table.increments("id").primary();
    table
      .integer("user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    // Verified Google identity this challenge intends to attach.
    table.string("google_sub", 255).notNullable();
    table.string("google_email", 320).notNullable();
    table.string("google_name", 255).nullable();
    table.string("google_picture", 1024).nullable();

    // Server-validated destination to return to after a successful link.
    table.string("redirect_path", 512).nullable();

    // Opaque ticket (hash only) and lifecycle.
    table.string("ticket_hash", 128).notNullable().unique();
    table.timestamp("expires_at").notNullable();
    table.timestamp("consumed_at").nullable();
    table.integer("attempts").notNullable().defaultTo(0);

    // Optional email-OTP recovery for password-less accounts. Bound to this
    // same challenge record; the ticket is still required to complete linking.
    table.string("otp_hash", 128).nullable();
    table.timestamp("otp_expires_at").nullable();
    table.integer("otp_attempts").notNullable().defaultTo(0);
    table.integer("otp_resend_count").notNullable().defaultTo(0);

    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index("user_id");
    table.index("expires_at");
  });
};

exports.down = async function (knex) {
  const hasTable = await knex.schema.hasTable("google_link_challenges");
  if (hasTable) {
    await knex.schema.dropTable("google_link_challenges");
  }
};
