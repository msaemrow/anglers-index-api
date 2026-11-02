const { DataTypes } = require("sequelize");

// Deliberately not included in catch associations: precise positions are owner-only.
module.exports = sequelize => sequelize.define("CatchLocation", {
  catch_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  latitude: { type: DataTypes.DOUBLE, allowNull: false },
  longitude: { type: DataTypes.DOUBLE, allowNull: false },
  accuracy_meters: { type: DataTypes.DOUBLE, allowNull: true },
  captured_at: { type: DataTypes.DATE, allowNull: true },
  source: { type: DataTypes.STRING(10), allowNull: false },
}, { tableName: "catch_locations", timestamps: true, underscored: true });
