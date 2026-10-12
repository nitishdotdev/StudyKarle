const db = require("../config/db");

const TABLE = "users";
const PUBLIC_COLUMNS = [
  "id",
  "name",
  "email",
  "role",
  "avatar_url",
  "course",
  "current_year",
  "created_at",
];

function publicUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar_url: row.avatar_url,
    course: row.course,
    current_year: row.current_year,
    created_at: row.created_at,
    has_password: !!row.password_hash,
    google_linked: !!row.google_sub,
  };
}

module.exports = {
  publicUser: publicUser,

  async create(data) {
    const rows = await db(TABLE)
      .insert({
        name: data.name,
        email: data.email.toLowerCase(),
        password_hash: data.passwordHash || null,
        role: data.role || "student",
        google_sub: data.googleSub || null,
        avatar_url: data.avatarUrl || null,
        token_version: 0,
      })
      .returning("*");
    return rows[0];
  },

  async findByEmail(email) {
    return db(TABLE).where({ email: String(email).toLowerCase() }).first();
  },

  async findById(id) {
    return db(TABLE).where({ id: id }).first();
  },

  async findByGoogleSub(googleSub) {
    if (!googleSub) {
      return null;
    }
    return db(TABLE).where({ google_sub: String(googleSub) }).first();
  },

  async findPublicById(id) {
    const row = await db(TABLE).where({ id: id }).first();
    return publicUser(row);
  },

  async updateProfile(id, data) {
    const rows = await db(TABLE)
      .where({ id: id })
      .update({
        name: data.name,
        course: data.course,
        current_year: data.currentYear,
        updated_at: db.fn.now(),
      })
      .returning("*");
    return publicUser(rows[0]);
  },

  async updatePassword(id, passwordHash) {
    return db(TABLE).where({ id: id }).update({
      password_hash: passwordHash,
      updated_at: db.fn.now(),
    });
  },

  async incrementTokenVersion(id) {
    return db(TABLE).where({ id: id }).update({
      token_version: db.raw("COALESCE(token_version, 0) + 1"),
      updated_at: db.fn.now(),
    });
  },

  async list(params) {
    const query = db(TABLE).select(PUBLIC_COLUMNS).orderBy("created_at", "desc");
    if (params && params.search) {
      query.where(function () {
        this.whereILike("name", "%" + params.search + "%").orWhereILike(
          "email",
          "%" + params.search + "%"
        );
      });
    }
    if (params && params.limit) {
      query.limit(params.limit).offset(params.offset || 0);
    }
    return query;
  },

  async count(params) {
    const query = db(TABLE);
    if (params && params.search) {
      query.where(function () {
        this.whereILike("name", "%" + params.search + "%").orWhereILike(
          "email",
          "%" + params.search + "%"
        );
      });
    }
    const result = await query.count("id as count").first();
    return Number(result.count);
  },

  async updateRole(id, role) {
    const rows = await db(TABLE)
      .where({ id: id })
      .update({ role: role, updated_at: db.fn.now() })
      .returning(PUBLIC_COLUMNS);
    return rows[0];
  },

  async remove(id) {
    return db(TABLE).where({ id: id }).del();
  },
};
