"use strict";
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      await q.addColumn("users", "capture_catch_location", {
        type: S.BOOLEAN, allowNull: false, defaultValue: false,
      }, { transaction });
      await q.createTable("catch_locations", {
        catch_id: { type: S.INTEGER, primaryKey: true, allowNull: false, references: { model: "fish_catches", key: "id" }, onDelete: "CASCADE" },
        user_id: { type: S.INTEGER, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        latitude: { type: S.DOUBLE, allowNull: false },
        longitude: { type: S.DOUBLE, allowNull: false },
        accuracy_meters: { type: S.DOUBLE, allowNull: true },
        captured_at: { type: S.DATE, allowNull: true },
        source: { type: S.STRING(10), allowNull: false },
        created_at: { type: S.DATE, allowNull: false },
        updated_at: { type: S.DATE, allowNull: false },
      }, { transaction });
      await q.addIndex("catch_locations", ["user_id"], { transaction });
      await q.sequelize.query(`ALTER TABLE catch_locations ADD CONSTRAINT catch_location_values CHECK (
        latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
        AND (accuracy_meters IS NULL OR (accuracy_meters >= 0 AND accuracy_meters < 'Infinity'::float8))
        AND source IN ('device', 'manual')
        AND (source <> 'device' OR (accuracy_meters IS NOT NULL AND captured_at IS NOT NULL))
      )`, { transaction });
    });
  },
  async down(q) {
    await q.sequelize.transaction(async transaction => {
      await q.dropTable("catch_locations", { transaction });
      await q.removeColumn("users", "capture_catch_location", { transaction });
    });
  },
};
