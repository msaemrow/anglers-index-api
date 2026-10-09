'use strict';
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      await q.createTable('fishing_trips', {
        id: { type: S.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        user_id: { type: S.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
        lake_id: { type: S.INTEGER, allowNull: false, references: { model: 'lakes', key: 'id' } },
        started_at: { type: S.DATE, allowNull: false }, ended_at: { type: S.DATE },
        notes: { type: S.TEXT, allowNull: false, defaultValue: '' },
        created_at: { type: S.DATE, allowNull: false }, updated_at: { type: S.DATE, allowNull: false },
      }, { transaction });
      await q.addIndex('fishing_trips', ['user_id', 'started_at'], { transaction });
      await q.addColumn('fish_catches', 'trip_id', { type: S.INTEGER, allowNull: true, references: { model: 'fishing_trips', key: 'id' }, onDelete: 'SET NULL' }, { transaction });
      await q.addIndex('fish_catches', ['trip_id'], { transaction });
    });
  },
  async down(q) {
    await q.sequelize.transaction(async transaction => {
      await q.removeColumn('fish_catches', 'trip_id', { transaction });
      await q.dropTable('fishing_trips', { transaction });
    });
  },
};
