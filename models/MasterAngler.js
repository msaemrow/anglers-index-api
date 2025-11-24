const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const MasterAngler = sequelize.define(
    "MasterAngler",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      catch_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      reviewed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "master_angler_catches",
      timestamps: true,
      underscored: true,
      paranoid: true,
      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt", "deletedAt"] },
      },
    }
  );

  return MasterAngler;
};
