"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = [
      "users",
      "lures",
      "fish_catches",
      "fish_species",
      "lakes",
      "tackle_box",
      "master_angler_catches",
    ];

    for (const table of tables) {
      await queryInterface.addColumn(table, "created_at", {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      });

      await queryInterface.addColumn(table, "updated_at", {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      });

      await queryInterface.addColumn(table, "deleted_at", {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = [
      "users",
      "lures",
      "fish_catches",
      "fish_species",
      "lakes",
      "tackle_box",
      "master_angler_catches",
    ];

    for (const table of tables) {
      await queryInterface.removeColumn(table, "created_at");
      await queryInterface.removeColumn(table, "updated_at");
      await queryInterface.removeColumn(table, "deleted_at");
    }
  },
};
