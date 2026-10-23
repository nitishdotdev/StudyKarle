/**
 * Semester payment requests and Year 1 / Year 2 access entitlements.
 *
 * Access is never granted by a client-supplied flag. An administrator must
 * approve a payment request; the entitlement end date is taken from server
 * configuration (PAYMENT_ACCESS_ENDS_AT) at approval time.
 *
 * Payment screenshots are stored in PostgreSQL as bytea, not on the Render
 * disk. Do not assume unverified backup or filesystem persistence.
 */
exports.up = async function (knex) {
  const hasPayments = await knex.schema.hasTable("payment_requests");
  if (!hasPayments) {
    await knex.schema.createTable("payment_requests", function (table) {
      table.increments("id").primary();
      table
        .integer("user_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.string("payment_reference", 32).notNullable().unique();
      table.integer("amount_rupees").notNullable().defaultTo(9);
      table.string("currency", 8).notNullable().defaultTo("INR");
      table.string("upi_id", 320).nullable();
      table.string("payee_name", 120).nullable();
      table
        .enum("status", ["pending", "approved", "rejected"], {
          useNative: true,
          enumName: "payment_request_status",
        })
        .notNullable()
        .defaultTo("pending")
        .index();
      table.string("utr", 64).nullable();
      table.binary("proof_bytes").nullable();
      table.string("proof_mime_type", 80).nullable();
      table.string("proof_filename", 255).nullable();
      table.integer("proof_size_bytes").nullable();
      table.timestamp("submitted_at").nullable();
      table.timestamp("reviewed_at").nullable();
      table
        .integer("reviewed_by")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.string("review_note", 500).nullable();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.index("user_id");
      table.index(["user_id", "status"]);
    });
  }

  const hasAccess = await knex.schema.hasTable("semester_access");
  if (!hasAccess) {
    await knex.schema.createTable("semester_access", function (table) {
      table.increments("id").primary();
      table
        .integer("user_id")
        .unsigned()
        .notNullable()
        .unique()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table
        .integer("payment_request_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("payment_requests")
        .onDelete("SET NULL");
      table.timestamp("starts_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("ends_at").notNullable().index();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasThumbs = await knex.schema.hasTable("drive_thumbnails");
  if (!hasThumbs) {
    await knex.schema.createTable("drive_thumbnails", function (table) {
      table.increments("id").primary();
      table.string("drive_id", 200).notNullable().unique();
      table.string("mime_type", 80).notNullable();
      table.binary("bytes").notNullable();
      table.timestamp("source_modified_time").nullable();
      table.timestamp("generated_at").notNullable().defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasTable("drive_thumbnails")) {
    await knex.schema.dropTable("drive_thumbnails");
  }
  if (await knex.schema.hasTable("semester_access")) {
    await knex.schema.dropTable("semester_access");
  }
  if (await knex.schema.hasTable("payment_requests")) {
    await knex.schema.dropTable("payment_requests");
  }
  await knex.raw('DROP TYPE IF EXISTS "payment_request_status"');
};
