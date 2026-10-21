const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../controllers/fishCatchController'), 'utf8');
const valid = { species_id: 1, lake_id: 2, lure_id: 3, length: 0, weight: 2.5, date: '2026-09-29', time: '10:30:00', timestamp: 1790695800 };
async function run(body, user = { id: 42 }, { weatherFails = false, lakeExists = true, trip = null } = {}) {
  let weatherRequest;
  let created;
  let createdTrip;
  const context = { console: { warn() {} }, exports: {}, module: { exports: {} }, require: name => {
    if (name === '../helpers/errors') return require('../helpers/errors');
    if (name === '../services/masterAnglerReview') return { ...require('../services/masterAnglerReview'), syncSubmission: async () => {} };
    if (name === '../services/trips') return require('../services/trips');
    if (name === '../models') return {
      Trip: { findOne: async options => trip && String(options.where.user_id) === String(trip.user_id) ? trip : null, create: async fields => { createdTrip = fields; return { id: 55, ...fields }; } },
      sequelize: { transaction: async fn => fn({ LOCK: { UPDATE: 'UPDATE' } }) },
      Lake: { findByPk: async id => lakeExists ? { id, latitude: 42, longitude: -93 } : null },
      FishCatch: { create: async fields => { created = fields; return { toJSON: () => ({ id: 7, ...fields }) }; } },
    };
    if (name === '../services/catchWeather') return { getCatchWeather: async (lake, timestamp) => {
      weatherRequest = { lake, timestamp };
      if (weatherFails) throw Error('Weather offline');
      return { temperature: 65, barometric: 29.92, wind_speed: 8, wind_direction: 'NW', weather_conditions: 'clear sky' };
    } };
    return {};
  } };
  vm.runInNewContext(source, context);
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await context.module.exports.createFishCatch({ body, user }, response);
  return { response, created, createdTrip, weatherRequest };
}
test('new catch uses authenticated ownership, timestamp, and no fabricated photo', async () => {
  const { response, created } = await run({ ...valid, user_id: 999 });
  assert.equal(response.code, 201);
  assert.equal(created.user_id, 42);
  assert.equal(created.timestamp, valid.timestamp);
  assert.equal(created.length, 0);
  assert.equal(created.fish_image, '');
});
test('unauthenticated and invalid catches never reach the database', async () => {
  assert.equal((await run(valid, null)).response.code, 401);
  for (const patch of [{ species_id: '' }, { length: -1 }, { weight: '' }, { date: '2026-02-30' }, { time: '25:00' }, { timestamp: Infinity }]) {
    const { response, created } = await run({ ...valid, ...patch });
    assert.equal(response.code, 400);
    assert.equal(created, undefined);
  }
});
test('legacy date and time payloads receive a timestamp and default photo', async () => {
  const { response, created } = await run({ ...valid, timestamp: undefined });
  assert.equal(response.code, 201);
  assert.ok(Number.isInteger(created.timestamp));
  assert.equal(created.fish_image, '');
});

test('captures weather at the selected lake and catch instant, ignoring supplied weather', async () => {
  const { response, created, weatherRequest } = await run({ ...valid, temperature: 999 });
  assert.equal(response.code, 201);
  assert.equal(weatherRequest.lake.id, valid.lake_id);
  assert.equal(weatherRequest.timestamp, valid.timestamp);
  assert.equal(created.temperature, 65);
  assert.equal(created.barometric, 29.92);
  assert.equal(created.wind_direction, 'NW');
  assert.equal(created.wind_speed, 8);
  assert.equal(created.weather_conditions, 'clear sky');
  assert.equal(response.body.weather_warning, undefined);
});
test('weather failure preserves the catch and returns a visible warning', async () => {
  const { response, created } = await run(valid, { id: 42 }, { weatherFails: true });
  assert.equal(response.code, 201);
  assert.equal(response.body.id, 7);
  assert.equal(created.temperature, undefined);
  assert.match(response.body.weather_warning, /could not be recorded/);
});
test('a missing lake does not trigger weather lookup or catch creation', async () => {
  const { response, created, weatherRequest } = await run(valid, { id: 42 }, { lakeExists: false });
  assert.equal(response.code, 400);
  assert.equal(created, undefined);
  assert.equal(weatherRequest, undefined);
});

test('trip catches are validated before insertion and retain their trip ID', async () => {
  const trip = { id: 5, user_id: 42, lake_id: 2, start_date: valid.date, end_date: valid.date, status: 'active' };
  const accepted = await run({ ...valid, trip_id: 5 }, { id: 42 }, { trip });
  assert.equal(accepted.response.code, 201);
  assert.equal(accepted.created.trip_id, 5);
  for (const patch of [{ user_id: 99 }, { lake_id: 99 }, { start_date: '2026-09-30' }, { end_date: '2026-09-28' }]) {
    const rejected = await run({ ...valid, trip_id: 5 }, { id: 42 }, { trip: { ...trip, ...patch } });
    assert.equal(rejected.response.code, 400); assert.equal(rejected.created, undefined);
  }
});

test('starts a trip and links its first catch with authenticated ownership and matching lake', async () => {
  const result = await run({ ...valid, new_trip: { start_date: valid.date, single_day: true }, user_id: 999 });
  assert.equal(result.response.code, 201);
  assert.equal(result.createdTrip.user_id, 42);
  assert.equal(result.createdTrip.lake_id, valid.lake_id);
  assert.equal(result.createdTrip.start_date, valid.date);
  assert.equal(result.createdTrip.end_date, valid.date);
  assert.equal(result.createdTrip.status, undefined);
  assert.equal(result.created.trip_id, 55);
});
test('rejects invalid inline trip starts before creating either record', async () => {
  for (const patch of [
    { new_trip: { start_date: 'invalid', single_day: true } },
    { new_trip: { start_date: '2026-09-30', single_day: true } },
    { new_trip: { start_date: '2026-02-30', single_day: true } },
    { new_trip: { start_date: valid.date, single_day: true }, trip_id: 5 },
  ]) {
    const result = await run({ ...valid, ...patch });
    assert.equal(result.response.code, 400);
    assert.equal(result.created, undefined);
    assert.equal(result.createdTrip, undefined);
  }
});

test('photo URLs and storage keys cannot be supplied by the client', async () => {
  for (const fish_image of ['https://example.com/fish.jpg', 'catches/11111111-1111-4111-8111-111111111111.jpg']) {
    const result = await run({ ...valid, fish_image });
    assert.equal(result.response.code, 400);
    assert.equal(result.created, undefined);
  }
});
