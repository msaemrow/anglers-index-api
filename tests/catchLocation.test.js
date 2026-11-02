const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseLocation, serializeLocation } = require('../services/catchLocation');
const manual = { latitude: 0, longitude: 0, source: 'manual' };
const device = { latitude: 42.123456, longitude: -93, source: 'device', accuracy_meters: 12, captured_at: '2026-10-31T12:30:00.000Z' };
function load(path, models) {
  const context = { module: { exports: {} }, exports: {}, require: name => {
    if (name === '../models') return models;
    return require(name);
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve(path), 'utf8'), context);
  return Object.keys(context.exports).length ? context.exports : context.module.exports;
}
const response = () => ({ code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('validates optional locations, zero coordinates, bounds, source, accuracy and UTC capture time', () => {
  assert.equal(parseLocation(undefined), null);
  assert.equal(parseLocation('null'), null);
  assert.equal(parseLocation(manual).latitude, 0);
  assert.deepEqual(parseLocation(JSON.stringify(device)), device);
  assert.equal(parseLocation({ ...manual, accuracy_meters: 99, captured_at: device.captured_at }).accuracy_meters, null);
  for (const bad of [false, [], '', '{bad', {}, { ...manual, latitude: 91 }, { ...manual, longitude: -181 }, { ...manual, latitude: '42' }, { ...manual, latitude: Infinity }, { ...manual, source: 'photo' }, { ...manual, user_id: 99 }, { ...device, accuracy_meters: -1 }, { ...device, accuracy_meters: null }, { ...device, captured_at: null }, { ...device, captured_at: '2026-02-30T12:30:00Z' }, { ...device, captured_at: 'yesterday' }]) {
    assert.throws(() => parseLocation(bad), error => error.status === 400);
  }
  assert.equal(serializeLocation({ ...device, user_id: 42, catch_id: 17 }).user_id, undefined);
});

test('owner-only location access has no admin bypass and uses authenticated ownership for writes', async () => {
  let stored = null;
  const calls = [];
  const models = {
    sequelize: { transaction: fn => fn({ LOCK: { UPDATE: 'UPDATE' } }) },
    FishCatch: { findOne: async options => { calls.push(['catch', options]); return options.where.id === '17' && options.where.user_id === 42 ? { id: 17 } : null; } },
    CatchLocation: {
      findOne: async options => { calls.push(['read', options]); return stored; },
      upsert: async (values, options) => { calls.push(['write', values, options]); stored = values; },
      destroy: async options => { calls.push(['delete', options]); stored = null; },
    },
  };
  const { locationRequest } = load('../controllers/catchLocationController', models);
  async function run(method, user, body = { location: device }, id = '17') {
    const res = response();
    await locationRequest({ method, params: { catch_id: id }, user, body }, res);
    return res;
  }
  for (const method of ['GET', 'PUT', 'DELETE']) {
    assert.equal((await run(method, null)).code, 401);
    for (const user of [{ id: 7 }, { id: 1, is_admin: true }]) assert.equal((await run(method, user)).code, 404);
  }
  assert.equal(calls.some(([kind]) => kind !== 'catch'), false);
  const saved = await run('PUT', { id: 42 });
  assert.equal(saved.code, 200);
  assert.equal(saved.headers['Cache-Control'], 'no-store');
  assert.equal(stored.user_id, 42);
  assert.equal(stored.catch_id, 17);
  assert.equal((await run('GET', { id: 42 })).body.location.latitude, device.latitude);
  assert.equal((await run('GET', { id: 42 })).body.location.user_id, undefined);
  for (const body of [{}, { location: null }, { location: { ...device, latitude: 100 } }, { location: device, user_id: 99 }]) assert.equal((await run('PUT', { id: 42 }, body)).code, 400);
  assert.equal((await run('DELETE', { id: 42 })).body.location, null);
  assert.equal(stored, null);
  assert.equal((await run('GET', { id: 42 })).body.location, null);
  for (const [, values, options] of calls.filter(([kind]) => kind === 'write')) {
    assert.equal(values.user_id, 42);
    assert.ok(options.transaction);
  }
});

test('preferences affect only the authenticated user and reject coerced values or other fields', async () => {
  const ids = [];
  const user = { capture_catch_location: false, update: async values => Object.assign(user, values) };
  const { preferences } = load('../controllers/preferencesController', { User: { findByPk: async id => { ids.push(id); return user; } } });
  async function run(method, body, currentUser = { id: 42 }) {
    const res = response();
    await preferences({ method, body, user: currentUser }, res);
    return res;
  }
  assert.equal((await run('GET', null, null)).code, 401);
  assert.equal((await run('GET')).body.capture_catch_location, false);
  for (const body of [{ capture_catch_location: 'true' }, { capture_catch_location: 1 }, {}, { capture_catch_location: true, user_id: 7 }]) assert.equal((await run('PATCH', body)).code, 400);
  assert.equal((await run('PATCH', { capture_catch_location: true })).body.capture_catch_location, true);
  assert.equal((await run('PATCH', { capture_catch_location: false })).body.capture_catch_location, false);
  assert.ok(ids.every(id => id === 42));
});

test('deleting a catch permanently removes coordinates within the catch transaction', async () => {
  const calls = [];
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const fish = { id: 17, user_id: 42, reload: async options => { assert.equal(options.transaction, transaction); calls.push('lock'); }, destroy: async options => { assert.equal(options.transaction, transaction); calls.push('catch'); } };
  const models = { FishCatch: { findByPk: async () => fish }, CatchLocation: { destroy: async options => { assert.equal(options.where.catch_id, 17); assert.equal(options.transaction, transaction); calls.push('location'); } }, sequelize: { transaction: fn => fn(transaction) } };
  const context = { module: { exports: {} }, require: name => {
    if (name === '../models') return models;
    if (name === '../helpers/errors') return require('../helpers/errors');
    if (name === '../services/catchPhotos') return { removePhoto: async () => {} };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/fishCatchController'), 'utf8'), context);
  const res = response();
  await context.module.exports.deleteFishCatch({ params: { catch_id: '17' }, user: { id: 42 } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(calls, ['lock', 'location', 'catch']);
});
