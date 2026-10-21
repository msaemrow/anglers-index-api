const { sendError, publicError } = require("../helpers/errors");
const { Trip, FishCatch, Lake, Species, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');
const { tripCatchError, tripSummary, tripDates, tripToday } = require('../services/trips');
const positiveId = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const lakeInclude = { model: Lake, as: 'lake', attributes: ['name', 'county', 'state'] };
function failure(res, error, req) {
  return sendError(res, error, req, 'Unable to update fishing trips.');
}
function reject(message, status = 400) { throw publicError(status, message); }
exports.listTrips = async (req, res) => {
  const after = req.query.after === undefined ? 0 : Number(req.query.after);
  if (!Number.isSafeInteger(after) || after < 0 || (req.query.status && !['active', 'completed'].includes(req.query.status)))
    return res.status(400).json({ error: 'Invalid trip filters.' });
  try {
    const where = { user_id: req.user.id, id: { [Op.gt]: after } };
    if (req.query.status) where.end_date = { [req.query.status === 'active' ? Op.gte : Op.lt]: tripToday() };
    const trips = await Trip.findAll({ where, include: [lakeInclude], order: [['id', 'ASC']], limit: 101 });
    const page = trips.slice(0, 100);
    const counts = page.length ? await FishCatch.findAll({ where: { user_id: req.user.id, trip_id: page.map(t => t.id) }, attributes: ['trip_id', [fn('COUNT', col('id')), 'count']], group: ['trip_id'], raw: true }) : [];
    const byTrip = new Map(counts.map(row => [String(row.trip_id), Number(row.count)]));
    res.set('Cache-Control', 'no-store');
    return res.json({ trips: page.map(t => tripSummary(t, byTrip.get(String(t.id)) || 0)), next: trips.length > 100 ? page.at(-1).id : null });
  } catch (error) { return failure(res, error, req); }
};
exports.getTrip = async (req, res) => {
  if (!positiveId(req.params.id)) return res.status(400).json({ error: 'Invalid trip.' });
  try {
    const trip = await Trip.findOne({ where: { id: Number(req.params.id), user_id: req.user.id }, include: [lakeInclude] });
    if (!trip) return res.status(404).json({ error: 'Fishing trip not found.' });
    const catches = await FishCatch.findAll({ where: { trip_id: trip.id, user_id: req.user.id }, attributes: ['id', 'date', 'time', 'timestamp', 'length', 'weight', 'species_id', 'lake_id', 'trip_id'], include: [{ model: Species, as: 'species', attributes: ['name'] }], order: [['timestamp', 'DESC'], ['id', 'DESC']] });
    res.set('Cache-Control', 'no-store');
    return res.json({ ...tripSummary(trip, catches.length), catches });
  } catch (error) { return failure(res, error, req); }
};
exports.createTrip = async (req, res) => {
  const dates = tripDates(req.body);
  if (!positiveId(req.body.lake_id) || !dates ||
    (req.body.notes !== undefined && (typeof req.body.notes !== 'string' || req.body.notes.length > 2000)))
    return res.status(400).json({ error: 'Choose a lake, valid trip dates, and notes of at most 2000 characters.' });
  try {
    if (!await Lake.findByPk(Number(req.body.lake_id))) return res.status(400).json({ error: 'Lake not found.' });
    const trip = await Trip.create({ user_id: req.user.id, lake_id: Number(req.body.lake_id), ...dates, notes: (req.body.notes || '').trim() });
    return res.status(201).json(tripSummary(trip, 0));
  } catch (error) { return failure(res, error, req); }
};
exports.attachCatch = async (req, res) => {
  if (!positiveId(req.params.id) || !positiveId(req.body.catch_id)) return res.status(400).json({ error: 'Choose a valid catch.' });
  try {
    await sequelize.transaction(async transaction => {
      // Always lock trip before catch, as in new catch creation.
      const trip = await Trip.findOne({ where: { id: Number(req.params.id), user_id: req.user.id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!trip) reject('Fishing trip not found.', 404);
      const fish = await FishCatch.findOne({ where: { id: Number(req.body.catch_id), user_id: req.user.id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!fish) reject('Catch not found.', 404);
      if (fish.trip_id != null && String(fish.trip_id) !== String(trip.id)) reject('This catch already belongs to another trip.', 409);
      const error = tripCatchError(trip, fish, req.user.id);
      if (error) reject(error);
      await fish.update({ trip_id: trip.id }, { transaction });
    });
    return res.json({ message: 'Catch added to trip.' });
  } catch (error) { return failure(res, error, req); }
};

exports.deleteTrip = async (req, res) => {
  if (!positiveId(req.params.id)) return res.status(400).json({ error: 'Invalid trip.' });
  try {
    await sequelize.transaction(async transaction => {
      // Serialize with catch creation/linking, which also lock the trip first.
      const trip = await Trip.findOne({ where: { id: Number(req.params.id), user_id: req.user.id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!trip) reject('Fishing trip not found.', 404);
      // Include soft-deleted catches so restoring one cannot restore a stale link.
      await FishCatch.update({ trip_id: null }, { where: { trip_id: trip.id, user_id: req.user.id }, paranoid: false, transaction });
      await trip.destroy({ transaction });
    });
    return res.json({ message: 'Trip deleted. All catches have been kept.' });
  } catch (error) { return failure(res, error, req); }
};
