exports.up = async function (knex) {
  const hasGoogleSub = await knex.schema.hasColumn("users", "google_sub");
  if (!hasGoogleSub) {
    await knex.schema.alterTable("users", function (table) {
      table.string("google_sub", 255).nullable().unique();
    });
  }

  const hasTokenVersion = await knex.schema.hasColumn("users", "token_version");
  if (!hasTokenVersion) {
    await knex.schema.alterTable("users", function (table) {
      table.integer("token_version").notNullable().defaultTo(0);
    });
  }

  await knex.raw("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL");

  const hasPurpose = await knex.schema.hasColumn("otp_verifications", "purpose");
  if (!hasPurpose) {
    await knex.schema.alterTable("otp_verifications", function (table) {
      table.string("purpose", 32).notNullable().defaultTo("signup");
      table.integer("attempts").notNullable().defaultTo(0);
      table.timestamp("consumed_at").nullable();
    });
    await knex.raw(
      "ALTER TABLE otp_verifications ALTER COLUMN otp TYPE VARCHAR(128)"
    );
    await knex.raw("ALTER TABLE otp_verifications ALTER COLUMN name DROP NOT NULL");
    await knex.raw(
      "ALTER TABLE otp_verifications ALTER COLUMN password_hash DROP NOT NULL"
    );
    await knex.schema.alterTable("otp_verifications", function (table) {
      table.index(["email", "purpose"]);
    });
  }

  const hasResetTable = await knex.schema.hasTable(
    "password_reset_authorizations"
  );
  if (!hasResetTable) {
    await knex.schema.createTable(
      "password_reset_authorizations",
      function (table) {
        table.increments("id").primary();
        table
          .integer("user_id")
          .unsigned()
          .notNullable()
          .references("id")
          .inTable("users")
          .onDelete("CASCADE");
        table.string("token_hash", 128).notNullable().unique();
        table.timestamp("expires_at").notNullable();
        table.timestamp("consumed_at").nullable();
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.index("user_id");
        table.index("expires_at");
      }
    );
  }

  const hasLoginTickets = await knex.schema.hasTable("oauth_login_tickets");
  if (!hasLoginTickets) {
    await knex.schema.createTable("oauth_login_tickets", function (table) {
      table.increments("id").primary();
      table
        .integer("user_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.string("ticket_hash", 128).notNullable().unique();
      table.timestamp("expires_at").notNullable();
      table.timestamp("consumed_at").nullable();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.index("expires_at");
    });
  }
};

exports.down = async function (knex) {
  const hasResetTable = await knex.schema.hasTable(
    "password_reset_authorizations"
  );
  if (hasResetTable) {
    await knex.schema.dropTable("password_reset_authorizations");
  }
};
