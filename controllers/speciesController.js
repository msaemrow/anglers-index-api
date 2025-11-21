const { FishSpecies } = require("../models");
const { ValidationError } = require("sequelize");
const { Op } = require("sequelize");

// GET all fish species
exports.getAllFishSpecies = async (req, res) => {
  try {
    const species = await FishSpecies.findAll();
    return res.status(200).json(species);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ADD new fish species
exports.addFishSpecies = async (req, res) => {
  const { name, master_angler_length } = req.body;

  if (!name || master_angler_length === undefined) {
    return res
      .status(400)
      .json({ error: "Name and master_angler_length are required" });
  }

  try {
    const newSpecies = await FishSpecies.addSpecies(name, master_angler_length);
    return res.status(201).json(newSpecies);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ error: "Fish species already exists" });
    }
    return res.status(500).json({ error: error.message });
  }
};

// UPDATE master angler length for species
exports.updateFishSpecies = async (req, res) => {
  const { speciesId } = req.params;
  const { master_angler_length } = req.body;

  if (master_angler_length === undefined) {
    return res.status(400).json({ error: "master_angler_length is required" });
  }

  try {
    const updatedSpecies = await FishSpecies.updateMasterAnglerLength(
      speciesId,
      master_angler_length
    );
    return res.status(200).json(updatedSpecies);
  } catch (error) {
    if (error.message === "Species not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
};

// DELETE a species
exports.deleteFishSpecies = async (req, res) => {
  const { speciesId } = req.params;

  try {
    const species = await FishSpecies.findByPk(speciesId);
    if (!species) {
      return res.status(404).json({ error: "Fish species not found" });
    }
    await species.destroy();
    return res
      .status(200)
      .json({ message: "Fish species deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
