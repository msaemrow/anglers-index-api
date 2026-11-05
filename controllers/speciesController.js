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

    const species = await Species.findAll(queryOptions);
    let result = species;
    if (includeCaughtSpecies === "true") {
      // One bounded aggregate per species, without loading every catch into Node.
      const [stats] = await sequelize.query(`
        SELECT c.species_id, COUNT(*)::integer AS catch_count,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM master_angler_catches m
            WHERE m.catch_id = c.id AND m.deleted_at IS NULL AND m.status = 'approved'
              AND m.id = (SELECT MAX(latest.id) FROM master_angler_catches latest
                WHERE latest.catch_id = c.id AND latest.deleted_at IS NULL)
          ))::integer AS master_angler_count,
          MAX(c.id) FILTER (WHERE c.personal_best) AS best_id,
          MAX(c.length) FILTER (WHERE c.personal_best) AS best_length,
          MAX(c.date) FILTER (WHERE c.personal_best) AS best_date
        FROM fish_catches c WHERE c.user_id = :userId AND c.deleted_at IS NULL
        GROUP BY c.species_id
      `, { replacements: { userId: req.user.id } });
      const bySpecies = new Map(stats.map(row => [String(row.species_id), row]));
      result = species.map(sp => {
        const data = sp.toJSON();
        const stat = bySpecies.get(String(data.id));
        const count = stat?.master_angler_count ?? 0;
        return { ...data, caught: (stat?.catch_count ?? 0) > 0,
          personalBest: stat?.best_id ? { catchId: stat.best_id, length: stat.best_length, date: stat.best_date } : null,
          master_angler_count: count, approved_master_angler: count > 0,
          master_angler_status: count > 0 ? "approved" : "not_eligible" };
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
