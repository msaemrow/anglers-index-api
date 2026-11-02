const { FishCatch, CatchLocation, Lake, Species, Lure, sequelize } = require("../models");
const { Op, Transaction } = require("sequelize");
const { sendError } = require("../helpers/errors");
const { exportFilters, waypoint, gpxDocument } = require("../services/catchGpx");
const PAGE_SIZE = 500;

exports.exportCatchGpx = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  res.setHeader("Cache-Control", "no-store");
  try {
    const filters = exportFilters(req.query);
    // One snapshot keeps counts/positions consistent while locations are edited.
    const result = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      const waypoints = [];
      let skipped = 0;
      let after = 0;
      while (true) {
        if (req.aborted || res.destroyed) return null;
        const where = { user_id: req.user.id, id: { [Op.gt]: after } };
        if (filters.lake_id) where.lake_id = filters.lake_id;
        if (filters.species_id) where.species_id = filters.species_id;
        if (filters.from || filters.to) where.date = {
          ...(filters.from ? { [Op.gte]: filters.from } : {}),
          ...(filters.to ? { [Op.lte]: filters.to } : {}),
        };
        const catches = await FishCatch.findAll({
          where, attributes: ["id", "date", "time", "timestamp", "length", "weight"],
          ...(filters.details ? { include: [
            { model: Lake, as: "lake", attributes: ["name"] },
            { model: Species, as: "species", attributes: ["name"] },
            { model: Lure, as: "lure", attributes: ["brand", "name", "color", "size"] },
          ] } : {}),
          order: [["id", "ASC"]], limit: PAGE_SIZE, transaction,
        });
        if (!catches.length) break;
        const positions = await CatchLocation.findAll({
          where: { user_id: req.user.id, catch_id: { [Op.in]: catches.map(fish => fish.id) } },
          attributes: ["catch_id", "latitude", "longitude"], transaction,
        });
        const byCatch = new Map(positions.map(position => [position.catch_id, position]));
        for (const fish of catches) {
          const point = waypoint(fish, byCatch.get(fish.id), filters.details);
          if (point) waypoints.push(point);
          else skipped++;
        }
        after = catches[catches.length - 1].id;
        if (catches.length < PAGE_SIZE) break;
      }
      return { gpx: gpxDocument(waypoints, waypoints.length, skipped), exported: waypoints.length, skipped };
    });
    if (!result || req.aborted || res.destroyed) return;
    res.setHeader("Content-Type", "application/gpx+xml; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="anglers-index-catches.gpx"');
    res.setHeader("X-Export-Count", String(result.exported));
    res.setHeader("X-Skipped-Count", String(result.skipped));
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Export-Count, X-Skipped-Count");
    return res.send(result.gpx);
  } catch (error) { return sendError(res, error, req, "Unable to export catch locations."); }
};
