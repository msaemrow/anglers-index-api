const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const { processPhoto, storePhoto, removePhoto } = require('../services/catchPhotos');
const { createMasterAnglerCertificate } = require('../services/masterAnglerCertificate');
// Generated locally: convert -size 32x16 gradient:blue-red -quality 85 catch.heic
const fixture = path.join(__dirname, 'fixtures', 'catch.heic');
test('a real HEIC becomes a JPEG without metadata and embeds in the certificate', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'heic-photo-test-'));
  const previous = process.env.PHOTO_STORAGE_PATH;
  process.env.PHOTO_STORAGE_PATH = root;
  t.after(async () => { if (previous === undefined) delete process.env.PHOTO_STORAGE_PATH; else process.env.PHOTO_STORAGE_PATH = previous; await fs.rm(root, { recursive: true, force: true }); });
  const jpeg = await processPhoto(await fs.readFile(fixture));
  const metadata = await sharp(jpeg).metadata();
  assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.width, 32); assert.equal(metadata.height, 16);
  assert.equal(metadata.exif, undefined);
  const pixels = await sharp(jpeg).raw().toBuffer();
  assert.ok(pixels[2] > pixels[0]); // top is blue
  const bottom = (32 * 15) * 3;
  assert.ok(pixels[bottom] > pixels[bottom + 2]); // bottom is red
  const key = await storePhoto(jpeg);
  const pdf = await createMasterAnglerCertificate({ id: 42, fish_image: key });
  assert.match(pdf.toString('latin1'), /\/Subtype \/Image/);
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
  await removePhoto(key);
});
test('rejects damaged HEIC containers and images exceeding the pixel limit', async () => {
  const sample = await fs.readFile(fixture);
  const oversized = Buffer.from(sample);
  const dimensions = oversized.indexOf('ispe');
  assert.ok(dimensions > 0);
  oversized.writeUInt32BE(50000, dimensions + 8);
  oversized.writeUInt32BE(50000, dimensions + 12);
  for (const input of [sample.subarray(0, 32), oversized])
    await assert.rejects(processPhoto(input), error => error.status === 400);
});
