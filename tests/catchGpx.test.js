const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Op, Transaction } = require('sequelize');
const { exportFilters, escapeXml, waypoint, gpxDocument } = require('../services/catchGpx');
const fish = id => ({ id, date: '2026-11-01', time: '10:30:00', timestamp: 1793541000, length: 12.5, weight: 0, species: { name: 'Bass & Pike' }, lake: { name: 'Lake <North>' }, lure: { brand: 'Acme', name: 'Spoon' }, witness: 'Private Witness' });

test('validates inclusive date and lake filters and rejects ownership overrides', () => {
  assert.equal(exportFilters({}).details, true);
  assert.equal(exportFilters({ species_id: '3' }).species_id, 3);
  assert.equal(exportFilters({ details: 'false', lake_id: '2', from: '2026-11-01', to: '2026-11-01' }).lake_id, 2);
  for (const query of [{ species_id: '0' }, { species_id: ['3'] }, { species_id: '3 OR 1=1' }, { user_id: '7' }, { lake_id: '0' }, { lake_id: ['2'] }, { from: '2026-02-30' }, { to: 'invalid' }, { from: '2026-11-02', to: '2026-11-01' }, { details: 'yes' }, { details: ['true'] }]) assert.throws(() => exportFilters(query), error => error.status === 400);
});
test('generates GPX waypoints with escaped text, catch time and explicit measurement units', () => {
  const xml = waypoint(fish(17), { latitude: 0, longitude: 0 }, true);
  assert.match(xml, /lat="0.00000000" lon="0.00000000"/);
  assert.match(xml, /Bass &amp; Pike 2026-11-01 #17/);
  assert.match(xml, /Lake &lt;North&gt;/);
  assert.match(xml, /Weight: 0 lb/);
  assert.match(xml, /<time>[^<]+Z<\/time>\n    <name>/);
  assert.doesNotMatch(xml, /Private Witness|witness|user_id|captured_at/);
  assert.equal(escapeXml('A\x00\x01\ud800 & < > " \' 🐟'), 'A &amp; &lt; &gt; &quot; &apos; 🐟');
  const minimal = waypoint(fish(17), { latitude: 42, longitude: -93 }, false);
  assert.match(minimal, /<name>Catch 17<\/name>/);
  assert.doesNotMatch(minimal, /<time>|<desc>|Bass|Acme/);
});
test('GPX coordinates use decimal syntax, normalize +180 and skip unusable positions', () => {
  assert.match(waypoint(fish(1), { latitude: 0.0000001, longitude: 180 }, true), /lat="0.00000010" lon="-180.00000000"/);
  assert.match(waypoint(fish(1), { latitude: 90, longitude: 179.999999999 }, true), /lon="-180.00000000"/);
  for (const position of [null, {}, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }, { latitude: '42', longitude: 0 }]) assert.equal(waypoint(fish(1), position, true), null);
  assert.match(gpxDocument([], 0, 2), /<gpx version="1.1" creator="Anglers Index" xmlns="http:\/\/www.topografix.com\/GPX\/1\/1">/);
});

function load(models) {
  const context = { exports: {}, require: name => name === '../models' ? models : require(name) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/catchExportController'), 'utf8'), context);
  return context.exports.exportCatchGpx;
}
const response = () => ({ code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } });

test('export scopes catch and location batches to authenticated ownership, including admins, and filters catch dates', async () => {
  for (const user of [{ id: 42 }, { id: 1, is_admin: true }]) {
    const transaction = {};
    let query;
    const run = load({
      sequelize: { transaction: async (options, fn) => { assert.equal(options.isolationLevel, Transaction.ISOLATION_LEVELS.REPEATABLE_READ); return fn(transaction); } },
      FishCatch: { findAll: async options => { query = options; assert.equal(options.transaction, transaction); return [fish(17), fish(18), fish(19)]; } },
      CatchLocation: { findAll: async options => {
        assert.equal(options.where.user_id, user.id);
        assert.equal(options.transaction, transaction);
        assert.deepEqual(Array.from(options.where.catch_id[Op.in]), [17, 18, 19]);
        return [{ catch_id: 17, latitude: 42, longitude: -93 }, { catch_id: 19, latitude: NaN, longitude: -93 }];
      } },
    });
    const res = response();
    await run({ user, query: { lake_id: '2', species_id: '3', from: '2026-11-01', to: '2026-11-02' } }, res);
    assert.equal(query.where.user_id, user.id);
    assert.equal(query.where.lake_id, 2);
    assert.equal(query.where.species_id, 3);
    assert.equal(query.where.date[Op.gte], '2026-11-01');
    assert.equal(query.where.date[Op.lte], '2026-11-02');
    assert.notEqual(query.paranoid, false);
    assert.equal(query.limit, 500);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.headers['Content-Type'], 'application/gpx+xml; charset=utf-8');
    assert.equal(res.headers['X-Export-Count'], '1');
    assert.equal(res.headers['X-Skipped-Count'], '2');
    assert.match(res.headers['Access-Control-Expose-Headers'], /X-Export-Count/);
    assert.equal((res.body.match(/<wpt /g) || []).length, 1);
  }
});
test('exports all cursor batches, keeps duplicate positions as separate waypoints and supports an empty export', async () => {
  let pages = 0;
  const run = load({
    sequelize: { transaction: async (_, fn) => fn({}) },
    FishCatch: { findAll: async options => {
      pages++;
      assert.equal(options.include, undefined);
      if (pages === 1) return Array.from({ length: 500 }, (_, index) => fish(index + 1));
      assert.equal(options.where.id[Op.gt], 500);
      return [fish(501)];
    } },
    CatchLocation: { findAll: async options => Array.from(options.where.catch_id[Op.in]).map(id => ({ catch_id: id, latitude: 42, longitude: -93 })) },
  });
  const res = response();
  await run({ user: { id: 42 }, query: { details: 'false' } }, res);
  assert.equal(pages, 2);
  assert.equal(res.headers['X-Export-Count'], '501');
  assert.equal((res.body.match(/<wpt /g) || []).length, 501);
  assert.doesNotMatch(res.body, /<time>|Bass|Acme/);
  const empty = response();
  await load({ sequelize: { transaction: async (_, fn) => fn({}) }, FishCatch: { findAll: async () => [] } })({ user: { id: 42 }, query: {} }, empty);
  assert.equal(empty.headers['X-Export-Count'], '0');
  assert.match(empty.body, /0 catch locations exported/);
});
test('unauthenticated, invalid and aborted exports do not fetch catch data', async () => {
  const run = load({ sequelize: { transaction: async (_, fn) => fn({}) }, FishCatch: { findAll: async () => assert.fail('Must not query') } });
  const anonymous = response();
  await run({ query: {} }, anonymous);
  assert.equal(anonymous.code, 401);
  const invalid = response();
  await run({ user: { id: 42 }, query: { user_id: '7' } }, invalid);
  assert.equal(invalid.code, 400);
  const aborted = response();
  await run({ user: { id: 42 }, query: {}, aborted: true }, aborted);
  assert.equal(aborted.body, undefined);
});
