const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { processPhoto, storePhoto, readPhoto, removePhoto, photoPath, isPhotoKey } = require('../services/catchPhotos');
const { createMasterAnglerCertificate } = require('../services/masterAnglerCertificate');
test('processes, privately stores, renders in a certificate, and removes a photo', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'catch-photo-test-'));
  const previous = process.env.PHOTO_STORAGE_PATH;
  process.env.PHOTO_STORAGE_PATH = root;
  t.after(async () => { if (previous === undefined) delete process.env.PHOTO_STORAGE_PATH; else process.env.PHOTO_STORAGE_PATH = previous; await fs.rm(root, { recursive: true, force: true }); });
  const input = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#386ba0' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const processed = await processPhoto(input);
  const meta = await sharp(processed).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 1000); assert.equal(meta.height, 2000);
  assert.equal(meta.exif, undefined); assert.equal(meta.orientation, undefined);
  const key = await storePhoto(processed);
  assert.ok(isPhotoKey(key)); assert.equal(path.isAbsolute(key), false);
  assert.deepEqual(await readPhoto(key), processed);
  assert.equal((await fs.stat(photoPath(key))).mode & 0o777, 0o600);
  const pdf = await createMasterAnglerCertificate({ id: 42, fish_image: key, species: { name: 'Walleye' }, user: { username: 'Angler' } });
  assert.match(pdf.toString('latin1'), /\/Subtype \/Image/);
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
  await removePhoto(key);
  await assert.rejects(readPhoto(key), { code: 'ENOENT' });
  await removePhoto(key);
});
test('rejects corrupt, unsupported, empty and oversized files and unsafe paths', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>');
  for (const buffer of [Buffer.from('fake jpg'), svg, Buffer.alloc(0), Buffer.alloc(10 * 1024 * 1024 + 1)])
    await assert.rejects(processPhoto(buffer), error => error.status === 400);
  for (const key of ['../photo.jpg', '/etc/passwd', 'catches/../../photo.jpg', 'https://example.com/photo.jpg', 'catches/fish.jpg']) {
    assert.equal(isPhotoKey(key), false);
    assert.throws(() => photoPath(key), error => error.status === 404);
  }
});
