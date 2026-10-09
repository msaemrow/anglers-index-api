"use strict";
const { isEligible } = require("../services/masterAnglerReview");
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      const [catches] = await queryInterface.sequelize.query(`
        SELECT c.*, s.master_angler_length, m.id AS submission_id, m.status AS review_status
        FROM fish_catches c
        LEFT JOIN fish_species s ON s.id = c.species_id AND s.deleted_at IS NULL
        LEFT JOIN (
          SELECT DISTINCT ON (catch_id) id, catch_id, status
          FROM master_angler_catches WHERE deleted_at IS NULL ORDER BY catch_id, id DESC
        ) m ON m.catch_id = c.id
        WHERE c.deleted_at IS NULL
        ORDER BY c.id
        FOR UPDATE OF c
      `, { transaction });
      const missing = [];
      for (const fish of catches) {
        const decision = ["approved", "denied"].includes(fish.review_status);
        const status = decision ? fish.review_status : isEligible(fish, fish) ? "pending" : "not_eligible";
        if (fish.submission_id && !decision) {
          await queryInterface.bulkUpdate("master_angler_catches", {
            status, reviewed: false, updated_at: new Date(),
          }, { id: fish.submission_id }, { transaction });
        } else if (!fish.submission_id) {
          missing.push({ user_id: fish.user_id, catch_id: fish.id, status, reviewed: false,
            created_at: new Date(), updated_at: new Date() });
        }
        if (fish.master_angler !== (status === "approved")) {
          await queryInterface.bulkUpdate("fish_catches", { master_angler: status === "approved" }, { id: fish.id }, { transaction });
        }
      }
      if (missing.length) await queryInterface.bulkInsert("master_angler_catches", missing, { transaction });
      await queryInterface.changeColumn("master_angler_catches", "status", {
        type: Sequelize.STRING(20), allowNull: false, defaultValue: "not_eligible",
      }, { transaction });
    });
  },
  async down(queryInterface, Sequelize) {
    // Preserve reconciled statuses and admin decisions on rollback.
    await queryInterface.changeColumn("master_angler_catches", "status", {
      type: Sequelize.STRING(20), allowNull: false, defaultValue: "pending",
    });
  },
};
