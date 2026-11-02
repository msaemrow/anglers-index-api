const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Op } = require('sequelize');
const source = fs.readFileSync(require.resolve('../controllers/catchMapController'), 'utf8');
function controller(findAll) {
  const context = { exports: {}, require: name => name === '../models' ? { CatchLocation: { findAll }, FishCatch: {}, Species: {}, Lure: {} } : require(name) };
  vm.runInNewContext(source, context);
  return context.exports.getCatchMap;
}
const response = () => ({ code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const row = id => ({ catch_id: id, latitude: 42, longitude: -93, user_id: 42, catch: { id, species_id: 3, date: '2026-10-31', time: '10:30:00', length: 12, weight: 1, species: { name: 'Bass' }, lure: { brand: 'Acme', name: 'Spoon' }, witness: 'Private', fish_image: 'private.jpg' } });

test('map queries scope both records to verified ownership, including admin accounts, and selected lake', async () => {
  let options;
  const run = controller(async query => { options = query; return [row(17)]; });
  for (const user of [{ id: 42 }, { id: 1, is_admin: true }]) {
    const res = response();
    await run({ user, query: { lake_id: '2' } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(options.where.user_id, user.id);
    assert.equal(options.include[0].where.user_id, user.id);
    assert.equal(options.include[0].where.lake_id, 2);
    assert.equal(options.include[0].required, true);
    assert.notEqual(options.include[0].paranoid, false);
    assert.deepEqual(Array.from(options.attributes), ['catch_id', 'latitude', 'longitude']);
    assert.equal(options.limit, 501);
    assert.equal(res.body.catches[0].id, 17);
    assert.equal(res.body.catches[0].species_name, 'Bass');
    assert.equal(res.body.catches[0].lure_label, 'Acme · Spoon');
    assert.equal(res.body.next_cursor, null);
    assert.doesNotMatch(JSON.stringify(res.body), /witness|fish_image|user_id|private.jpg/);
  }
});

test('unauthenticated, invalid lake/cursor and ownership override requests never query locations', async () => {
  const run = controller(async () => assert.fail('Must not query'));
  const anonymous = response();
  await run({ query: { lake_id: '2' } }, anonymous);
  assert.equal(anonymous.code, 401);
  for (const query of [ { lake_id: '0' }, { lake_id: ['2'] }, { lake_id: '2 OR 1=1' }, { lake_id: '2', user_id: '7' }, { lake_id: '2', after: '-1' }, { lake_id: '2', after: '9007199254740992' }]) {
    const res = response();
    await run({ user: { id: 42 }, query }, res);
    assert.equal(res.code, 400);
  }
});

test('map pages have a stable cursor and return empty lists normally', async () => {
  const run = controller(async options => {
    assert.equal(options.where.catch_id[Op.gt], 10);
    return Array.from({ length: 501 }, (_, i) => row(i + 11));
  });
  const res = response();
  await run({ user: { id: 42 }, query: { lake_id: '2', after: '10' } }, res);
  assert.equal(res.body.catches.length, 500);
  assert.equal(res.body.next_cursor, 510);
  const empty = response();
  await controller(async () => [])({ user: { id: 42 }, query: { lake_id: '2' } }, empty);
  assert.equal(empty.body.catches.length, 0);
  assert.equal(empty.body.next_cursor, null);
});

test('all-lake waypoints retain ownership restrictions without a lake constraint', async () => {
  let options;
  const res = response();
  await controller(async query => { options = query; return [row(17)]; })({ user: { id: 42 }, query: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(options.where.user_id, 42);
  assert.equal(options.include[0].where.user_id, 42);
  assert.equal(options.include[0].where.lake_id, undefined);
});
