const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../controllers/fishCatchController'), 'utf8');
const valid = { species_id: 1, lake_id: 2, lure_id: 3, length: 0, weight: 2.5, date: '2026-09-29', time: '10:30:00', timestamp: 1790695800 };
async function run(body, user = { id: 42 }, { weatherFails = false, lakeExists = true } = {}) {
  let weatherRequest;
  let created;
  const context = { console: { warn() {} }, exports: {}, module: { exports: {} }, require: name => {
    if (name === '../models') return {
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
  return { response, created, weatherRequest };
}
test('new catch uses authenticated ownership, timestamp, and the correct photo field', async () => {
  const { response, created } = await run({ ...valid, user_id: 999, fish_image: '/photo.jpg' });
  assert.equal(response.code, 201);
  assert.equal(created.user_id, 42);
  assert.equal(created.timestamp, valid.timestamp);
  assert.equal(created.length, 0);
  assert.equal(created.fish_image, '/photo.jpg');
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
  assert.equal(created.fish_image, '/static/images/stock-fish.jpg');
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
