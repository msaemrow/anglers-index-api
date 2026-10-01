const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../controllers/speciesController'), 'utf8');

async function create(body, addSpecies) {
  const context = { exports: {}, require: name => name === '../models' ? { Species: { addSpecies } } : {} };
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
