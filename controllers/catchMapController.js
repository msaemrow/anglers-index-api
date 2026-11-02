const { CatchLocation, FishCatch, Species, Lure } = require("../models");
const { Op } = require("sequelize");
const { sendError } = require("../helpers/errors");
const PAGE_SIZE = 500;

exports.getCatchMap = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  res.setHeader("Cache-Control", "no-store");
  const positiveId = value => typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
  if (!positiveId(req.query.lake_id) || (req.query.after !== undefined && !positiveId(req.query.after)) ||
      Object.keys(req.query).some(key => !["lake_id", "after"].includes(key)))
    return res.status(400).json({ error: "Choose a valid lake and map cursor." });
  try {
    const rows = await CatchLocation.findAll({
      where: { user_id: req.user.id, ...(req.query.after ? { catch_id: { [Op.gt]: Number(req.query.after) } } : {}) },
      attributes: ["catch_id", "latitude", "longitude"],
      include: [{
        model: FishCatch, as: "catch", required: true,
        // Ownership on both records. Default paranoid scope excludes deleted catches.
        where: { user_id: req.user.id, lake_id: Number(req.query.lake_id) },
        attributes: ["id", "species_id", "date", "time", "length", "weight"],
        include: [
          { model: Species, as: "species", attributes: ["name"] },
          { model: Lure, as: "lure", attributes: ["brand", "name", "color", "size"] },
        ],
      }],
      order: [["catch_id", "ASC"]], limit: PAGE_SIZE + 1,
    });
    const catches = rows.slice(0, PAGE_SIZE).map(row => {
      const fish = row.catch;
      return { id: row.catch_id, latitude: row.latitude, longitude: row.longitude,
        species_id: fish.species_id, species_name: fish.species?.name || "Unknown species",
        date: fish.date, time: fish.time, length: fish.length, weight: fish.weight,
        lure_label: [fish.lure?.brand, fish.lure?.name, fish.lure?.color, fish.lure?.size].filter(Boolean).join(" · "),
      };
    });
    return res.json({ catches, next_cursor: rows.length > PAGE_SIZE ? catches[catches.length - 1].id : null });
  } catch (error) { return sendError(res, error, req); }
};
