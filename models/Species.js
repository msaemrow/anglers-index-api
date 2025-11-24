const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const FishSpecies = sequelize.define(
    "FishSpecies",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      master_angler_length: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
    },
    {
      tableName: "fish_species",
      timestamps: true,
      underscored: true,
      paranoid: true,
      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt", "deletedAt"] },
      },
    }
  );

  // Class-level methods (static) can be added as model methods:
  FishSpecies.addSpecies = async function (name, master_angler_length) {
    return await this.create({ name, master_angler_length });
  };

  FishSpecies.updateMasterAnglerLength = async function (speciesId, newLength) {
    const species = await this.findByPk(speciesId);
    if (!species) throw new Error("Species not found");
    species.master_angler_length = newLength;
    await species.save();
    return species;
  };

  return FishSpecies;
};
