const { logError } = require("../helpers/errors");
const { FishCatch, Lake, Species } = require('../models');
const { Op } = require('sequelize');

exports.getCatchAnalysis = async (req, res) => {
  const cursor = req.query.after === undefined ? 0 : Number(req.query.after);
  if (!Number.isSafeInteger(cursor) || cursor < 0)
    return res.status(400).json({ error: 'Invalid catch cursor.' });
  try {
    const rows = await FishCatch.findAll({
      where: { user_id: req.user.id, id: { [Op.gt]: cursor } },
      attributes: ['id', 'lake_id', 'species_id', 'date', 'time', 'temperature', 'barometric', 'weather_conditions', 'wind_speed', 'wind_direction'],
      include: [
        { model: Lake, as: 'lake', attributes: ['name', 'county', 'state'] },
        { model: Species, as: 'species', attributes: ['name'] },
      ],
      order: [['id', 'ASC']], limit: 501,
    });
    const catches = rows.slice(0, 500);
    res.set('Cache-Control', 'no-store');
    return res.json({ catches, next: rows.length > 500 ? catches.at(-1).id : null });
  } catch (error) {
    logError(error, req);
    return res.status(500).json({ error: 'Unable to load catch analysis.' });
  }
};
