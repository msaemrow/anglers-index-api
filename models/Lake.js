// models/Lake.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Lake = sequelize.define(
    "Lake",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      nearest_town: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      county: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      latitude: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      longitude: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
    },
    {
      tableName: "lakes",
      timestamps: false,
    }
  );

  return Lake;
};
