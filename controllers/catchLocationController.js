const { FishCatch, CatchLocation, sequelize } = require("../models");
const { parseLocation, serializeLocation } = require("../services/catchLocation");
const { sendError } = require("../helpers/errors");

async function locationRequest(req, res) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  res.setHeader("Cache-Control", "no-store");
  try {
    const result = await sequelize.transaction(async transaction => {
      // Lock the catch for writes so deletion and location replacement cannot race.
      const catchObj = await FishCatch.findOne({
        where: { id: req.params.catch_id, user_id: req.user.id },
        attributes: ["id"], transaction,
        ...(req.method !== "GET" ? { lock: transaction.LOCK.UPDATE } : {}),
      });
      if (!catchObj) return { missing: true };
      const where = { catch_id: catchObj.id, user_id: req.user.id };
      if (req.method === "DELETE") {
        await CatchLocation.destroy({ where, transaction });
        return { location: null };
      }
      if (req.method === "PUT") {
        if (!req.body || Object.keys(req.body).some(key => key !== "location") || req.body.location == null)
          return { invalid: true };
        const location = parseLocation(req.body.location);
        if (!location) return { invalid: true };
        await CatchLocation.upsert({ ...location, ...where }, { transaction });
        return { location };
      }
      const location = await CatchLocation.findOne({ where, transaction });
      return { location: serializeLocation(location) };
    });
    if (result.missing) return res.status(404).json({ error: "Catch not found." });
    if (result.invalid) return res.status(400).json({ error: "Provide a location or use Remove location." });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, req);
  }
}
module.exports = { locationRequest };
