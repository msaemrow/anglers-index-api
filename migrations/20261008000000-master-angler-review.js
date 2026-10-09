"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const [name, definition] of Object.entries({
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "pending" },
        denial_reason: { type: Sequelize.TEXT },
        reviewed_by: { type: Sequelize.INTEGER, references: { model: "users", key: "id" } },
        reviewed_at: { type: Sequelize.DATE },
      })) await queryInterface.addColumn("master_angler_catches", name, definition, { transaction });
      // Preserve legacy rows and reviewed flags. With no recorded decision,
      // their new status defaults to pending until an admin explicitly reviews them.
      // Queue eligible catches only when no active submission already exists.
      await queryInterface.sequelize.query(`
        INSERT INTO master_angler_catches (user_id, catch_id, reviewed, status, created_at, updated_at)
        SELECT c.user_id, c.id, false, 'pending', NOW(), NOW()
        FROM fish_catches c JOIN fish_species s ON s.id = c.species_id
        WHERE c.deleted_at IS NULL AND s.deleted_at IS NULL
          AND c.length >= s.master_angler_length AND s.master_angler_length > 0
          AND lower(trim(coalesce(c.witness, ''))) NOT IN ('', 'na', 'n/a', 'none')
          AND trim(coalesce(c.fish_image, '')) <> '' AND c.fish_image NOT LIKE '%stock-fish.jpg%'
          AND (c.fish_image ~* '^https?://' OR (c.fish_image LIKE '/%' AND c.fish_image NOT LIKE '//%'))
          AND NOT EXISTS (SELECT 1 FROM master_angler_catches m WHERE m.catch_id = c.id AND m.deleted_at IS NULL);
      `, { transaction });
      await queryInterface.addIndex("master_angler_catches", ["status", "catch_id"], {
        name: "master_angler_review_queue", transaction,
      });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeIndex("master_angler_catches", "master_angler_review_queue", { transaction });
      for (const name of ["status", "denial_reason", "reviewed_by", "reviewed_at"])
        await queryInterface.removeColumn("master_angler_catches", name, { transaction });
    });
  },
};
