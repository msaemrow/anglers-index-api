const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sharp = require('sharp');
const upload = require('../middleware/catchPhotoUpload');
test('multipart uploads verify image contents, parse trip fields and enforce file size', async t => {
  const app = express();
  app.use(express.json());
  app.post('/', upload, (req, res) => res.json({ format: req.photoBuffer ? 'jpeg' : null, trip: req.body.new_trip }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const image = await sharp({ create: { width: 5, height: 5, channels: 3, background: 'blue' } }).png().toBuffer();
  const form = new FormData();
  form.append('photo', new Blob([image], { type: 'text/plain' }), '../../fish.txt');
  form.append('new_trip', JSON.stringify({ start_date: '2026-10-13', single_day: true }));
  const result = await fetch(url, { method: 'POST', body: form });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { format: 'jpeg', trip: { start_date: '2026-10-13', single_day: true } });
  for (const content of [Buffer.from('fake JPEG'), Buffer.alloc(10 * 1024 * 1024 + 1)]) {
    const invalid = new FormData(); invalid.append('photo', new Blob([content], { type: 'image/jpeg' }), 'fish.jpg');
    assert.equal((await fetch(url, { method: 'POST', body: invalid })).status, 400);
  }
  const malformed = new FormData(); malformed.append('new_trip', '{bad json');
  assert.equal((await fetch(url, { method: 'POST', body: malformed })).status, 400);
  const json = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(json.status, 200);
});
