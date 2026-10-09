const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { tripCatchError, tripSummary, validDate, tripDates, tripStatus, tripToday } = require('../services/trips');
const start = '2026-01-01', end = '2026-01-03';
const trip = { id: 5, user_id: 42, lake_id: 2, start_date: start, end_date: end, status: 'active', notes: '' };
const fish = { id: 7, user_id: 42, lake_id: 2, trip_id: null, date: '2026-01-02', timestamp: Date.parse('2026-01-01T11:00:00Z') / 1000 };
function setup({ query = {}, body = {}, tripExists = true, fishExists = true, completed = false, lastCatch = fish.date, fail = false, unlinkFails = false } = {}) {
  const calls = [];
  const storedTrip = { async destroy(options) { calls.push(['destroyTrip', options]); }, ...trip, status: completed ? 'completed' : 'active', toJSON() { return { ...trip, end_date: this.end_date, status: this.status }; }, async update(fields) { calls.push(['updateTrip', fields]); Object.assign(this, fields); } };
  const storedFish = { ...fish, async update(fields) { calls.push(['updateCatch', fields]); Object.assign(this, fields); } };
  const models = {
    Trip: { findOne: async options => { calls.push(['trip', options]); if (fail) throw Error('secret db info'); return tripExists ? storedTrip : null; }, findAll: async options => { calls.push(['trips', options]); return [storedTrip]; }, create: async fields => { calls.push(['create', fields]); return { id: 5, ...fields }; } },
    FishCatch: { update: async (fields, options) => { calls.push(['unlinkCatches', fields, options]); if (unlinkFails) throw Error('private failure'); return [2]; }, findOne: async options => { calls.push(['catch', options]); return fishExists ? storedFish : null; }, findAll: async options => { calls.push(['counts', options]); return [{ trip_id: 5, count: '0' }]; }, max: async () => lastCatch, count: async () => 0 },
    Lake: { findByPk: async () => ({ id: 2 }) }, Species: {},
    sequelize: { transaction: async callback => callback({ LOCK: { UPDATE: 'UPDATE' } }) },
  };
  const context = { exports: {}, require: name => name === '../models' ? models : require(name) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/tripController'), 'utf8'), context);
  const res = { statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  return { calls, res, run: action => context.exports[action]({ user: { id: 42 }, params: { id: '5' }, query, body }, res) };
}
test('trip constraints enforce ownership, matching lake, and inclusive calendar dates', () => {
  assert.equal(tripCatchError(trip, fish, 42), null);
  assert.match(tripCatchError(trip, fish, 99), /not found/);
  assert.match(tripCatchError(trip, { ...fish, lake_id: 8 }, 42), /lake/);
  for (const date of ['2025-12-31', '2026-01-04', '2026-02-30'])
    assert.match(tripCatchError(trip, { ...fish, date }, 42), /within/);
  for (const date of [start, end])
    for (const time of ['00:00:00', '23:59:59'])
      assert.equal(tripCatchError(trip, { ...fish, date, time }, 42), null);
});
test('summaries count inclusive days, retain zero catches, and omit hourly statistics', () => {
  const summary = tripSummary(trip, 0);
  assert.equal(summary.catch_count, 0);
  assert.equal(summary.day_count, 3);
  assert.equal('catches_per_hour' in summary, false);
  assert.equal('duration_hours' in summary, false);
  assert.equal(tripSummary({ ...trip, end_date: start }, 4).day_count, 1);
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-01-01T10:00'), false);
  assert.equal(tripDates({ start_date: start, end_date: 'ignored', single_day: true }).end_date, start);
  assert.equal(tripDates({ start_date: start, single_day: false }), null);
});
test('trip list scopes both trips and catch totals to session user', async () => {
  const fixture = setup({ query: { user_id: '99', status: 'active' } }); await fixture.run('listTrips');
  for (const [, options] of fixture.calls) assert.equal(options.where.user_id, 42);
  assert.equal(fixture.calls[0][1].limit, 101);
  assert.equal(fixture.res.body.trips[0].catch_count, 0);
});
test('creation ignores supplied ownership, validates calendar ranges, and records zero catches', async () => {
  const fixture = setup({ body: { lake_id: 2, start_date: start, end_date: end, status: 'completed', user_id: 99 } }); await fixture.run('createTrip');
  assert.equal(fixture.res.statusCode, 201);
  assert.equal(fixture.calls.find(([kind]) => kind === 'create')[1].user_id, 42);
  assert.equal(fixture.res.body.catch_count, 0);
  const invalid = setup({ body: { lake_id: 2, start_date: end, end_date: start } }); await invalid.run('createTrip');
  assert.equal(invalid.res.statusCode, 400); assert.equal(invalid.calls.length, 0);
});
test('attachment locks owned records, supports completed trips, and hides other users records', async () => {
  const fixture = setup({ body: { catch_id: 7 }, completed: true }); await fixture.run('attachCatch');
  assert.equal(fixture.res.statusCode, 200);
  for (const [kind, options] of fixture.calls) if (['trip', 'catch'].includes(kind)) { assert.equal(options.where.user_id, 42); assert.equal(options.lock, 'UPDATE'); }
  assert.equal(fixture.calls.at(-1)[1].trip_id, 5);
  for (const flags of [{ tripExists: false }, { fishExists: false }]) {
    const missing = setup({ ...flags, body: { catch_id: 7 } }); await missing.run('attachCatch');
    assert.equal(missing.res.statusCode, 404); assert.ok(!missing.calls.some(([kind]) => kind === 'updateCatch'));
  }
  const failed = setup({ fail: true, body: { catch_id: 7 } }); await failed.run('attachCatch');
  assert.equal(failed.res.statusCode, 500); assert.equal(failed.res.body.error, 'Unable to update fishing trips.');
});

test('single day creation ignores end date', async () => {
  const fixture = setup({ body: { lake_id: 2, start_date: start, end_date: 'invalid', single_day: true } });
  await fixture.run('createTrip');
  assert.equal(fixture.res.statusCode, 201);
  assert.equal(fixture.res.body.end_date, start);

});

test('trips complete after the entire end day in America/Chicago, including DST boundaries', () => {
  const trip = { end_date: '2026-10-08' };
  assert.equal(tripStatus(trip, '2026-10-08'), 'active');
  assert.equal(tripStatus(trip, '2026-10-09'), 'completed');
  assert.equal(tripToday(new Date('2026-10-09T04:59:59Z')), '2026-10-08');
  assert.equal(tripToday(new Date('2026-10-09T05:00:00Z')), '2026-10-09');
  assert.equal(tripToday(new Date('2026-11-02T05:59:59Z')), '2026-11-01');
  assert.equal(tripToday(new Date('2026-11-02T06:00:00Z')), '2026-11-02');
});
test('active and completed list filters use date boundaries instead of stored flags', async () => {
  const { Op } = require('sequelize');
  for (const status of ['active', 'completed']) {
    const fixture = setup({ query: { status } }); await fixture.run('listTrips');
    const where = fixture.calls[0][1].where;
    assert.equal(where.end_date[status === 'active' ? Op.gte : Op.lt], tripToday());
    assert.equal(where.status, undefined);
  }
});

test('deleting an owned trip detaches all catches before deletion in the same transaction', async () => {
  const fixture = setup(); await fixture.run('deleteTrip');
  assert.equal(fixture.res.statusCode, 200);
  assert.equal(fixture.calls[0][1].where.user_id, 42);
  assert.equal(fixture.calls[0][1].lock, 'UPDATE');
  const unlink = fixture.calls.find(([kind]) => kind === 'unlinkCatches');
  assert.equal(unlink[1].trip_id, null);
  assert.equal(unlink[2].where.trip_id, 5);
  assert.equal(unlink[2].paranoid, false);
  const deletion = fixture.calls.find(([kind]) => kind === 'destroyTrip');
  assert.equal(deletion[1].transaction, unlink[2].transaction);
  assert.equal(fixture.calls.at(-1)[0], 'destroyTrip');
});
test('missing or unowned trips do not unlink catches; unlink failure prevents deletion', async () => {
  const missing = setup({ tripExists: false }); await missing.run('deleteTrip');
  assert.equal(missing.res.statusCode, 404);
  assert.ok(!missing.calls.some(([kind]) => kind === 'unlinkCatches'));
  const failed = setup({ unlinkFails: true }); await failed.run('deleteTrip');
  assert.equal(failed.res.statusCode, 500);
  assert.ok(!failed.calls.some(([kind]) => kind === 'destroyTrip'));
});
