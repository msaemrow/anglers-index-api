// migrations/XXXXXXXXXXXXXX-remove-soft-delete-from-tackle-box.js
"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("tackle_box", "deleted_at");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("tackle_box", "deleted_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
};
