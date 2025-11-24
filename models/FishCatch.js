// models/FishCatch.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const FishCatch = sequelize.define(
    "FishCatch",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      species_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      lake_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      length: {
        type: DataTypes.FLOAT,
      },

      weight: {
        type: DataTypes.FLOAT,
      },

      date: {
        type: DataTypes.DATEONLY,
      },

      time: {
        type: DataTypes.TIME,
      },

      timestamp: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      barometric: {
        type: DataTypes.FLOAT,
      },

      temperature: {
        type: DataTypes.INTEGER,
      },

      weather_conditions: {
        type: DataTypes.TEXT,
      },

      wind_direction: {
        type: DataTypes.STRING(2),
      },

      wind_speed: {
        type: DataTypes.INTEGER,
      },

      lure_id: {
        type: DataTypes.INTEGER,
      },

      fish_image: {
        type: DataTypes.TEXT,
        defaultValue: "/static/images/stock-fish.jpg",
      },

      master_angler: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      witness: {
        type: DataTypes.STRING(75),
        defaultValue: "NA",
      },
    },
    {
      tableName: "fish_catches",
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  return FishCatch;
};
