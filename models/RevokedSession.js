const { DataTypes } = require('sequelize');
module.exports = sequelize => sequelize.define('RevokedSession', {
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'revoked_sessions', timestamps: false });
