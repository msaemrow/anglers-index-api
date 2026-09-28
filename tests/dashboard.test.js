const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../controllers/dashboardController'), 'utf8');

function setup({ admin = false, empty = false, fail = false } = {}) {
  const calls = [];
  const row = { id: 7, toJSON: () => ({ id: 7 }) };
  const models = {
    FishCatch: {
      count: async options => {
        calls.push(['count', options]);
        if (fail) throw Error('database offline');
        return empty ? 0 : options.distinct ? 3 : options.where.master_angler ? 8 : 40;
      },
      findAll: async options => { calls.push(['preview', options]); return empty ? [] : [row]; },
    },
    MasterAngler: {
      findAndCountAll: async options => { calls.push(['pending', options]); return { count: 12, rows: [{ catch_id: 9 }] }; },
      findAll: async options => { calls.push(['approved', options]); return [{ catch_id: 7 }]; },
    },
  };
  const context = { exports: {}, require: name => name === '../models' ? models : { Op: { in: Symbol.for('in') } }, console: { error() {} } };
  vm.runInNewContext(source, context);
  const response = { statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { calls, response, run: () => context.exports.getDashboard({ user: { id: 42, is_admin: admin }, query: { user_id: 999 } }, response) };
}

test('scopes counts/previews to authenticated user and bounds previews', async () => {
  const { run, calls, response } = setup(); await run();
  for (const [kind, options] of calls) {
    if (['count', 'preview', 'approved'].includes(kind)) assert.equal(options.where.user_id, 42);
    if (kind === 'preview') { assert.equal(options.limit, 5); assert.equal(options.order[1][0], 'id'); }
  }
  assert.equal(response.body.stats.totalCatches, 40);
  assert.equal(response.body.stats.totalMasterAngler, 8);
  assert.equal(response.body.stats.lakesFished, 3);
  assert.equal(response.body.recentCatches[0].approved_master_angler, true);
  assert.equal(response.body.pendingReviews, null);
  assert.ok(!calls.some(([kind]) => kind === 'pending'));
});
test('admin receives bounded pending preview and full total', async () => {
  const { run, calls, response } = setup({ admin: true }); await run();
  const options = calls.find(([kind]) => kind === 'pending')[1];
  assert.equal(options.limit, 5); assert.equal(options.where.reviewed, false);
  assert.equal(response.body.pendingReviews.total, 12);
});
test('empty history returns successful zero totals without approval query', async () => {
  const { run, calls, response } = setup({ empty: true }); await run();
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.stats.totalCatches, 0);
  assert.equal(response.body.recentCatches.length, 0);
  assert.ok(!calls.some(([kind]) => kind === 'approved'));
});
test('database failure returns an error instead of an empty history', async () => {
  const { run, response } = setup({ fail: true }); await run();
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error, 'Unable to load dashboard.');
});
