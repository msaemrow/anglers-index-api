const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../controllers/fishCatchController'), 'utf8');
async function run(query) {
  let options;
  const context = { module: { exports: {} }, require: name => name === '../models' ? { FishCatch: { findAll: async value => { options = value; return [{ id: 7 }]; } } } : {} };
  vm.runInNewContext(source, context);
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await context.module.exports.getAllFishCatches({ query }, response);
  return { options, response };
}
test('daily catches remain scoped to a user and are filtered in the database', async () => {
  const { options, response } = await run({ user_id: '42', date: '2026-09-29' });
  assert.equal(response.code, 200);
  assert.equal(options.where.user_id, '42');
  assert.equal(options.where.date, '2026-09-29');
});
test('invalid daily dates never query the database', async () => {
  for (const date of ['2026-02-30', 'not-a-date', '2026-9-29', '']) {
    const { response, options } = await run({ user_id: '42', date });
    assert.equal(response.code, 400);
    assert.equal(options, undefined);
  }
});
test('normal catch lists retain their existing behavior and date alone cannot un-scope a request', async () => {
  assert.equal((await run({ user_id: '42' })).options.where.date, undefined);
  assert.equal((await run({ date: '2026-09-29' })).response.code, 400);
});
