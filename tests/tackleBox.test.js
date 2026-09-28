const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../controllers/tackleBoxController'), 'utf8');

async function run(lures, fail = false) {
  let query;
  const Lure = {};
  const context = { exports: {}, require: () => ({ Lure, TackleBox: { findAll: async options => {
    query = options;
    if (fail) throw Error('database unavailable');
    return lures.map(lure => ({ lure: { toJSON: () => lure } }));
  } } }) };
  vm.runInNewContext(source, context);
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await context.exports.getTackleBoxLures({ params: { user_id: '42' } }, response);
  return { response, query, Lure };
}
test('loads lures with one user-scoped join and preserves sorted response', async () => {
  const { response, query, Lure } = await run([
    { id: 1, brand: 'Zoom', name: 'Worm' },
    { id: 2, brand: 'Acme', name: 'Spinner' },
    { id: 3, brand: 'Acme', name: 'Jig' },
  ]);
  assert.equal(query.where.user_id, '42');
  assert.equal(query.include[0].model, Lure);
  assert.equal(query.include[0].required, true);
  assert.deepEqual(Array.from(response.body.tackle_box, lure => lure.id), [3, 2, 1]);
  assert.deepEqual(Array.from(response.body.brands), ['Acme', 'Zoom']);
});
test('empty tackle box remains a successful empty collection', async () => {
  const { response } = await run([]);
  assert.equal(response.code, 200);
  assert.equal(response.body.tackle_box.length, 0);
  assert.equal(response.body.brands.length, 0);
});
test('query errors do not masquerade as an empty collection', async () => {
  const { response } = await run([], true);
  assert.equal(response.code, 500);
});
