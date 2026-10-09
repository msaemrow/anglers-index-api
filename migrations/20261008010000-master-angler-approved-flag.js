"use strict";
module.exports = {
  async up(queryInterface) {
    // The award flag now represents approval only. Keep all catch and review data.
    await queryInterface.sequelize.query(`
      UPDATE fish_catches c SET master_angler = (m.status = 'approved')
      FROM (
        SELECT DISTINCT ON (catch_id) catch_id, status
        FROM master_angler_catches WHERE deleted_at IS NULL
        ORDER BY catch_id, id DESC
      ) m
      WHERE c.id = m.catch_id AND c.deleted_at IS NULL
        AND c.master_angler IS DISTINCT FROM (m.status = 'approved');
    `);
  },
  async down() {
    // Do not restore eligibility flags on denied catches when rolling back.
  },
};
