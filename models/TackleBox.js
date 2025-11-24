const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TackleBox = sequelize.define(
    "TackleBox",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      lure_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "lures", key: "id" },
        onDelete: "CASCADE",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "tackle_box",
      timestamps: true,
      underscored: true,
      paranoid: true,
      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt", "deletedAt"] },
      },
    }
  );

  return TackleBox;
};
