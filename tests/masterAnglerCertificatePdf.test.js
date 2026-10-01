const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMasterAnglerCertificate } = require('../services/masterAnglerCertificate');

test('renders a complete single-page landscape certificate', async () => {
  const pdf = await createMasterAnglerCertificate({
    id: 42, date: '2026-09-30', length: 28.5, weight: 8.2,
    user: { first_name: 'Sample', last_name: 'Angler' },
    species: { name: 'Walleye' }, lake: { name: 'Clear Lake', state: 'IA' },
  });
  const source = pdf.toString('latin1');
  assert.ok(source.startsWith('%PDF-'));
  assert.ok(source.trimEnd().endsWith('%%EOF'));
  assert.match(source, /\/MediaBox \[0 0 792 612\]/);
  assert.equal((source.match(/\/Type \/Page\b/g) || []).length, 1);
});

test('missing optional data and long names do not create extra pages', async () => {
  const pdf = await createMasterAnglerCertificate({ id: 9, user: { first_name: 'Long name '.repeat(10) }, species: { name: 'Long species '.repeat(8) } });
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
});
