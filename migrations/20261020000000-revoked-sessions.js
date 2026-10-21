'use strict';
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      await q.createTable('revoked_sessions', {
        id: { type: S.UUID, primaryKey: true, allowNull: false },
        user_id: { type: S.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        expires_at: { type: S.DATE, allowNull: false },
      }, { transaction });
      await q.addIndex('revoked_sessions', ['expires_at'], { transaction });
    });
  },
  async down(q) { await q.dropTable('revoked_sessions'); },
};
