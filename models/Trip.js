const { DataTypes } = require('sequelize');
module.exports = sequelize => sequelize.define('Trip', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  lake_id: { type: DataTypes.INTEGER, allowNull: false },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
}, { tableName: 'fishing_trips', underscored: true, timestamps: true });
