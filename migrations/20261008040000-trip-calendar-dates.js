'use strict';
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      await q.addColumn('fishing_trips', 'start_date', { type: S.DATEONLY }, { transaction });
      await q.addColumn('fishing_trips', 'end_date', { type: S.DATEONLY }, { transaction });
      await q.addColumn('fishing_trips', 'status', { type: S.STRING(20), allowNull: false, defaultValue: 'active' }, { transaction });
      // Older trips have no saved timezone. Use the application's local timezone,
      // and include every linked catch's recorded date to preserve valid membership.
      await q.sequelize.query(`UPDATE fishing_trips t SET
        start_date = LEAST((t.started_at AT TIME ZONE 'America/Chicago')::date,
          (SELECT MIN(c.date) FROM fish_catches c WHERE c.trip_id = t.id AND c.deleted_at IS NULL)),
        end_date = GREATEST((COALESCE(t.ended_at, t.started_at) AT TIME ZONE 'America/Chicago')::date,
          (SELECT MAX(c.date) FROM fish_catches c WHERE c.trip_id = t.id AND c.deleted_at IS NULL)),
        status = CASE WHEN t.ended_at IS NULL THEN 'active' ELSE 'completed' END`, { transaction });
      for (const field of ['start_date', 'end_date']) await q.changeColumn('fishing_trips', field, { type: S.DATEONLY, allowNull: false }, { transaction });
      await q.changeColumn('fishing_trips', 'started_at', { type: S.DATE, allowNull: true }, { transaction });
      await q.addConstraint('fishing_trips', { fields: ['start_date', 'end_date'], type: 'check', name: 'fishing_trip_date_range', where: { end_date: { [S.Op.gte]: S.col('start_date') } }, transaction });
    });
  },
  async down(q, S) {
    await q.sequelize.transaction(async transaction => {
      await q.removeConstraint('fishing_trips', 'fishing_trip_date_range', { transaction });
      await q.sequelize.query(`UPDATE fishing_trips SET
        started_at = COALESCE(started_at, start_date::timestamp AT TIME ZONE 'America/Chicago'),
        ended_at = CASE WHEN status = 'completed' THEN COALESCE(ended_at, (end_date + 1)::timestamp AT TIME ZONE 'America/Chicago' - INTERVAL '1 second') ELSE NULL END`, { transaction });
      await q.changeColumn('fishing_trips', 'started_at', { type: S.DATE, allowNull: false }, { transaction });
      for (const field of ['start_date', 'end_date', 'status']) await q.removeColumn('fishing_trips', field, { transaction });
    });
  },
};
