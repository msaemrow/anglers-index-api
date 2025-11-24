// models/Lure.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Lure = sequelize.define(
    "Lure",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      brand: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      color: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      size: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      tableName: "lures",
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  // If you want to add instance or class methods, add them here as needed

  return Lure;
};
