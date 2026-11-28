const db = require('../config/db');

const TABLE = 'admin_activity';

module.exports = {
  async log(adminId, action, entityType, entityId, meta, trx) {
    return (trx || db)(TABLE).insert({
      admin_id: adminId,
      action: action,
      entity_type: entityType,
      entity_id: entityId || null,
      meta: meta ? JSON.stringify(meta) : null
    });
  },

  async recent(limit) {
    return db(TABLE)
      .leftJoin('users', 'users.id', 'admin_activity.admin_id')
      .select(
        'admin_activity.id',
        'admin_activity.action',
        'admin_activity.entity_type',
        'admin_activity.entity_id',
        'admin_activity.meta',
        'admin_activity.created_at',
        'users.name as admin_name'
      )
      .orderBy('admin_activity.created_at', 'desc')
      .limit(limit || 20);
  }
};
