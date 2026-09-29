const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../controllers/lureController'), 'utf8');
const fields = { brand: ' Acme ', name: ' Spoon ', color: ' Silver ', size: ' 1/4 oz ' };
function setup({ failMembership = false, missing = false } = {}) {
  const calls = [];
  const transaction = {};
  const lure = { id: 17, user_id: 42, save: async () => calls.push(['save']) };
  const models = {
    Lure: {
      create: async (data, options) => { calls.push(['create', data, options]); return { id: 17, ...data }; },
      findByPk: async id => { calls.push(['find', id]); return missing ? null : lure; },
    },
    TackleBox: { create: async (data, options) => { calls.push(['membership', data, options]); if (failMembership) throw Error('membership failed'); } },
    sequelize: { transaction: async callback => {
      try { const result = await callback(transaction); calls.push(['commit']); return result; }
      catch (error) { calls.push(['rollback']); throw error; }
    } },
  };
  const context = { module: { exports: {} }, require: name => name === '../models' ? models : { Op: {} } };
  vm.runInNewContext(source, context);
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  return { handlers: context.module.exports, calls, response, transaction, lure };
}
test('create uses authenticated owner and same transaction for membership', async () => {
  const s = setup();
  await s.handlers.addLure({ user: { id: 42 }, body: { ...fields, user_id: 999, userId: 999, add_to_tackle_box: true } }, s.response);
  assert.equal(s.response.code, 201);
  assert.equal(s.response.body.user_id, 42);
  assert.equal(s.response.body.brand, 'Acme');
  assert.equal(s.calls[0][2].transaction, s.transaction);
  assert.equal(s.calls[1][2].transaction, s.transaction);
  assert.equal(s.calls[1][1].lure_id, 17);
  assert.equal(s.calls[1][1].user_id, 42);
  assert.equal(s.calls[2][0], 'commit');
});
test('membership failure rejects the transaction and returns failure', async () => {
  const s = setup({ failMembership: true });
  await s.handlers.addLure({ user: { id: 42 }, body: { ...fields, add_to_tackle_box: true } }, s.response);
  assert.equal(s.response.code, 500);
  assert.ok(s.calls.some(([kind]) => kind === 'rollback'));
  assert.ok(!s.calls.some(([kind]) => kind === 'commit'));
});
test('ordinary create does not add membership unless requested', async () => {
  const s = setup();
  await s.handlers.addLure({ user: { id: 42 }, body: fields }, s.response);
  assert.equal(s.response.code, 201);
  assert.ok(!s.calls.some(([kind]) => kind === 'membership'));
});
test('blank fields and non-boolean membership flag are rejected before writes', async () => {
  for (const body of [{ ...fields, name: ' ' }, { ...fields, add_to_tackle_box: 'false' }]) {
    const s = setup(); await s.handlers.addLure({ user: { id: 42 }, body }, s.response);
    assert.equal(s.response.code, 400); assert.equal(s.calls.length, 0);
  }
});
test('edit updates four allowed fields without changing ownership', async () => {
  const s = setup();
  await s.handlers.editLure({ params: { lureId: '17' }, body: { ...fields, user_id: 999 } }, s.response);
  assert.equal(s.response.code, 200);
  assert.equal(s.lure.user_id, 42); assert.equal(s.lure.name, 'Spoon');
  assert.ok(s.calls.some(([kind]) => kind === 'save'));
});
test('edit rejects invalid IDs, blank fields, and missing lures', async () => {
  for (const [id, body, missing, expected] of [['17oops', fields, false, 400], ['17', { ...fields, size: ' ' }, false, 400], ['17', fields, true, 404]]) {
    const s = setup({ missing }); await s.handlers.editLure({ params: { lureId: id }, body }, s.response);
    assert.equal(s.response.code, expected);
    assert.ok(!s.calls.some(([kind]) => kind === 'save'));
  }
});
