const { sendError, publicError } = require("../helpers/errors");
const { Species, FishCatch, MasterAngler, sequelize } = require("../models");
const { ValidationError } = require("sequelize");
const { Op } = require("sequelize");

// GET all fish species, optionally filter by names (semicolon separated) and sort alphabetically
exports.getAllFishSpecies = async (req, res) => {
  try {
    const { names, includeCaughtSpecies, userId } = req.query;
    if (includeCaughtSpecies === "true") {
      if (!req.user) return res.status(401).json({ error: "Sign in to view personal bests." });
      if (userId !== undefined && String(userId) !== String(req.user.id))
        return res.status(403).json({ error: "You can only view your own personal bests." });
    }
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
    if (includeCaughtSpecies === "true") {
      queryOptions.include = [
        {
          model: FishCatch,
          as: "fishCatches", // Adjust alias based on your association
          where: { user_id: req.user.id },
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
    if (includeCaughtSpecies === "true") {
      const catchIds = species.flatMap(sp => (sp.toJSON().fishCatches || []).map(c => c.id));
      const reviews = catchIds.length ? await MasterAngler.findAll({
        where: { catch_id: { [Op.in]: catchIds } }, attributes: ["catch_id", "status"], order: [["id", "DESC"]], raw: true,
      }) : [];
      const statuses = new Map();
      for (const review of reviews) if (!statuses.has(review.catch_id)) statuses.set(review.catch_id, review.status);
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
          master_angler_status: biggestCatch ? statuses.get(biggestCatch.id) || "not_eligible" : "not_eligible",
          approved_master_angler: biggestCatch ? statuses.get(biggestCatch.id) === "approved" : false,
          fishCatches: undefined, // Remove the catches array from response
        };
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error, req);
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
    const newSpecies = await Species.addSpecies(name, master_angler_length);
    return res.status(201).json(newSpecies);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ error: "Fish species already exists" });
    }
    return sendError(res, error, req);
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
    const length = Number(master_angler_length);
    if (master_angler_length === null || String(master_angler_length).trim() === "" || !Number.isFinite(length) || length < 0)
      return res.status(400).json({ error: "Master Angler length must be a nonnegative number." });
    const updatedSpecies = await sequelize.transaction(async transaction => {
      const species = await Species.findByPk(speciesId, { transaction });
      if (!species) throw publicError(404, "Species not found");
      await species.update({ master_angler_length: length }, { transaction });
      const catches = await FishCatch.findAll({ where: { species_id: speciesId }, order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
      const { syncSubmission } = require("../services/masterAnglerReview");
      for (const fish of catches) await syncSubmission(fish, transaction, { preserveApproval: true, species });
      return species;
    });
    return res.status(200).json(updatedSpecies);
  } catch (error) {
    return sendError(res, error, req);
  }
};

// DELETE a species
exports.deleteFishSpecies = async (req, res) => {
  const { speciesId } = req.params;

  try {
    const species = await Species.findByPk(speciesId);
    if (!species) {
      return res.status(404).json({ error: "Fish species not found" });
    }
    await species.destroy();
    return res
      .status(200)
      .json({ message: "Fish species deleted successfully" });
  } catch (error) {
    return sendError(res, error, req);
  }
};
