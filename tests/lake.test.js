const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../controllers/lakeController'), 'utf8');
function setup({ missing = false } = {}) {
  const calls = [];
  const lake = { id: 17, name: 'Old lake', county: 'County', latitude: 45, longitude: -93,
    save: async () => calls.push(['save']), destroy: async () => calls.push(['destroy']) };
  const models = { Lake: {
    findByPk: async id => { calls.push(['find', id]); return missing ? null : lake; },
    create: async fields => { calls.push(['create', fields]); return { id: 18, ...fields }; },
    findAll: async options => { calls.push(['list', options]); return [lake]; },
  } };
  const context = { process: { env: {} }, module: { exports: {} }, require: name => name === '../models' ? models : name === 'dotenv' ? { config() {} } : name === 'axios' ? { get: async () => { calls.push(['geocode']); return { data: [{ lat: 44, lon: -92 }] }; } } : {}, console };
  vm.runInNewContext(source, context);
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  return { calls, lake, res, handlers: context.module.exports };
}
test('update uses the route lakeId and preserves omitted fields', async () => {
  const s = setup();
  await s.handlers.updateLake({ params: { lakeId: '17' }, body: { name: 'Updated lake' } }, s.res);
  assert.equal(s.calls[0][1], '17'); assert.equal(s.res.code, 200);
  assert.equal(s.lake.name, 'Updated lake'); assert.equal(s.lake.latitude, 45);
  assert.ok(s.calls.some(([kind]) => kind === 'save'));
});
test('delete uses the route lakeId', async () => {
  const s = setup(); await s.handlers.deleteLake({ params: { lakeId: '17' } }, s.res);
  assert.equal(s.calls[0][1], '17'); assert.equal(s.res.code, 200);
  assert.ok(s.calls.some(([kind]) => kind === 'destroy'));
});
test('missing lake does not save or delete', async () => {
  for (const name of ['updateLake', 'deleteLake']) {
    const s = setup({ missing: true }); await s.handlers[name]({ params: { lakeId: '17' }, body: {} }, s.res);
    assert.equal(s.res.code, 404); assert.equal(s.calls.length, 1);
  }
});
test('lake listing preserves filters and orders consistently', async () => {
  const s = setup(); await s.handlers.getLakes({ query: { state: 'MN', county: 'County' } }, s.res);
  const options = s.calls[0][1];
  assert.equal(options.where.state, 'MN'); assert.equal(options.where.county, 'County');
  assert.equal(options.order[0][0], 'name'); assert.equal(options.order[1][0], 'id');
});
test('all lake writes load the authenticated user before checking admin access', () => {
  const routes = [];
  const router = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (...args) => routes.push([method, ...args])]));
  const middleware = { addUserToReq() {}, adminRequired() {} };
  const context = { module: { exports: {} }, require: name => name === 'express' ? { Router: () => router } : name.includes('authMiddleware') ? middleware : {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../routes/lakeRoutes'), 'utf8'), context);
  for (const [method, path, loadUser, authorize] of routes.filter(([method]) => method !== 'get')) {
    assert.equal(loadUser, middleware.addUserToReq, `${method} ${path}`);
    assert.equal(authorize, middleware.adminRequired, `${method} ${path}`);
  }
});

test('map-selected coordinates are saved exactly without town lookup', async () => {
  const s = setup();
  await s.handlers.addLake({ body: { name: 'Lake', nearest_town: 'Town', county: 'County', state: 'MN', latitude: 0, longitude: -93.123456 } }, s.res);
  assert.equal(s.res.code, 201);
  assert.equal(s.res.body.latitude, 0);
  assert.equal(s.res.body.longitude, -93.123456);
  assert.ok(!s.calls.some(([kind]) => kind === 'geocode'));
});
test('new lakes without coordinates keep the town lookup fallback', async () => {
  const s = setup();
  await s.handlers.addLake({ body: { name: 'Lake', nearest_town: 'Town', county: 'County', state: 'MN' } }, s.res);
  assert.equal(s.res.code, 201);
  assert.equal(s.res.body.latitude, 44);
  assert.ok(s.calls.some(([kind]) => kind === 'geocode'));
});
test('invalid and incomplete selected coordinates never create a lake', async () => {
  for (const pair of [{ latitude: 45 }, { latitude: null, longitude: 0 }, { latitude: '', longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }]) {
    const s = setup(); await s.handlers.addLake({ body: pair }, s.res);
    assert.equal(s.res.code, 400);
    assert.equal(s.calls.length, 0);
  }
});
test('editing coordinates preserves exact selected values and rejects invalid values', async () => {
  const s = setup(); await s.handlers.updateLake({ params: { lakeId: 17 }, body: { latitude: '45.123456', longitude: '-93.654321' } }, s.res);
  assert.equal(s.res.code, 200); assert.equal(s.lake.latitude, 45.123456); assert.equal(s.lake.longitude, -93.654321);
  const invalid = setup(); await invalid.handlers.updateLake({ params: { lakeId: 17 }, body: { latitude: '' } }, invalid.res);
  assert.equal(invalid.res.code, 400); assert.ok(!invalid.calls.some(([kind]) => kind === 'save'));
});
