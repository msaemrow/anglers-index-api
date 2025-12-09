const { Species, FishCatch } = require("../models");
const { ValidationError } = require("sequelize");
const { Op } = require("sequelize");

// GET all fish species, optionally filter by names (semicolon separated) and sort alphabetically
exports.getAllFishSpecies = async (req, res) => {
  try {
    const { names, includeCaughtSpecies, userId } = req.query;
    let where = {};

    if (names) {
      // Split names by semicolon and trim whitespace
      const namesArray = names.split(";").map((name) => name.trim());

      // Filter species where name is in namesArray (case-insensitive)
      where.name = {
        [Op.iLike]: { [Op.any]: namesArray.map((n) => `%${n}%`) },
      };
    }

    // Base query options
    const queryOptions = {
      where,
      order: [["name", "ASC"]], // Sort alphabetically by name
    };

    // If includeCaughtSpecies flag is set, include ONLY the biggest catch for each species
    if (includeCaughtSpecies === "true" && userId) {
      queryOptions.include = [
        {
          model: FishCatch,
          as: "fishCatches", // Adjust alias based on your association
          where: { user_id: userId },
          required: false, // LEFT JOIN - includes species even with no catches
          attributes: ["id", "length", "date", "master_angler"],
          limit: 1, // Only get one catch per species
          separate: true, // Required for limit to work per species
          order: [["length", "DESC"]], // Get the biggest one
        },
      ];
    }

    const species = await Species.findAll(queryOptions);

    // Transform data if includeCaughtSpecies is true
    let result = species;
    if (includeCaughtSpecies === "true" && userId) {
      result = species.map((sp) => {
        const speciesData = sp.toJSON();

        // Since we used limit: 1, there's either 0 or 1 catch
        const biggestCatch =
          speciesData.fishCatches && speciesData.fishCatches.length > 0
            ? speciesData.fishCatches[0]
            : null;

        return {
          ...speciesData,
          caught: !!biggestCatch,
          personalBest: biggestCatch
            ? {
                catchId: biggestCatch.id,
                length: biggestCatch.length,
                date: biggestCatch.date,
              }
            : null,
          approved_master_angler: biggestCatch
            ? biggestCatch.master_angler
            : false,
          fishCatches: undefined, // Remove the catches array from response
        };
      });
    }

    return res.status(200).json(result);
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
