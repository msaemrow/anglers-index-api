const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(query = {}, fail = false) {
  let options;
  const context = { exports: {}, require: name => name === '../helpers/errors' ? require('../helpers/errors') : name === '../models' ? {
    FishCatch: { findAll: async value => { options = value; if (fail) throw Error('private database error'); return Array.from({ length: 501 }, (_, i) => ({ id: i + 1 })); } }, Lake: {}, Species: {},
  } : require(name) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/catchAnalysisController'), 'utf8'), context);
  const res = { statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  return { res, options: () => options, run: () => context.exports.getCatchAnalysis({ user: { id: 42 }, query }, res) };
}
test('analysis scopes records to session user, bounds pages, and exposes weather', async () => {
  const fixture = setup({ user_id: '999', after: '10' }); await fixture.run();
  const options = fixture.options();
  assert.equal(options.where.user_id, 42);
  assert.equal(options.where.id[require('sequelize').Op.gt], 10);
  assert.equal(options.limit, 501);
  assert.ok(options.attributes.includes('temperature'));
  assert.equal(fixture.res.body.catches.length, 500);
  assert.equal(fixture.res.body.next, 500);
});
test('invalid cursors never reach database and failures hide internals', async () => {
  for (const after of ['bad', '-1', '1.2']) {
    const fixture = setup({ after }); await fixture.run();
    assert.equal(fixture.res.statusCode, 400); assert.equal(fixture.options(), undefined);
  }
  const fixture = setup({}, true); await fixture.run();
  assert.equal(fixture.res.statusCode, 500);
  assert.equal(fixture.res.body.error, 'Unable to load catch analysis.');
});
