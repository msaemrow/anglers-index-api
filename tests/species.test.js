const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../controllers/speciesController'), 'utf8');

async function create(body, addSpecies) {
  const context = { exports: {}, require: name => name === '../helpers/errors' ? require('../helpers/errors') : name === '../models' ? { Species: { addSpecies } } : {} };
  vm.runInNewContext(source, context);
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await context.exports.addFishSpecies({ body }, response);
  return response;
}
test('species creation calls the exported model and returns the new species', async () => {
  const species = { id: 1, name: 'Bass', master_angler_length: 20 };
  const response = await create(species, async (name, length) => {
    assert.equal(name, 'Bass');
    assert.equal(length, 20);
    return species;
  });
  assert.equal(response.code, 201);
  assert.deepEqual(response.body, species);
});
test('species creation preserves missing-field and duplicate errors', async () => {
  const missing = await create({}, () => assert.fail('Should not create incomplete species'));
  assert.equal(missing.code, 400);
  const duplicate = await create({ name: 'Bass', master_angler_length: 20 }, async () => {
    const error = new Error('Duplicate');
    error.name = 'SequelizeUniqueConstraintError';
    throw error;
  });
  assert.equal(duplicate.code, 400);
  assert.equal(duplicate.body.error, 'Fish species already exists');
});

test('species summaries use owner-scoped aggregates for records and all approved catches', async () => {
  let queryOptions;
  const models = {
    Species: { findAll: async () => [1, 2, 3].map(id => ({ toJSON: () => ({ id, name: `Species ${id}` }) })) },
    sequelize: { query: async (sql, options) => {
      queryOptions = options;
      assert.match(sql, /c\.user_id = :userId/);
      assert.match(sql, /c\.deleted_at IS NULL/);
      assert.match(sql, /WHERE c\.personal_best/);
      return [[{ species_id: 1, catch_count: 5, master_angler_count: 3, best_id: 9, best_length: 25, best_date: '2026-11-01' },
        { species_id: 2, catch_count: 1, master_angler_count: 0, best_id: null }]];
    } },
  };
  const context = { exports: {}, require: name => name === '../models' ? models : name === '../helpers/errors' ? require('../helpers/errors') : {} };
  vm.runInNewContext(source, context);
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await context.exports.getAllFishSpecies({ user: { id: 42 }, query: { includeCaughtSpecies: 'true' } }, res);
  assert.equal(res.code, 200);
  assert.equal(queryOptions.replacements.userId, 42);
  assert.equal(res.body[0].master_angler_count, 3);
  assert.equal(res.body[0].personalBest.catchId, 9);
  assert.equal(res.body[1].caught, true);
  assert.equal(res.body[1].personalBest, null);
  assert.equal(res.body[2].caught, false);
  assert.equal(res.body[2].master_angler_count, 0);
});
