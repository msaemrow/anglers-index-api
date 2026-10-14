const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const { Worker } = require('node:worker_threads');
let activeHeicWorkers = 0;
async function processHeic(buffer) {
  if (activeHeicWorkers >= 2) throw Object.assign(new Error('Photo processing is busy. Please try again.'), { status: 503 });
  activeHeicWorkers++;
  let worker;
  let timeout;
  try {
    return await new Promise((resolve, reject) => {
      worker = new Worker(path.join(__dirname, 'heicPhotoWorker.js'), { workerData: buffer, resourceLimits: { maxOldGenerationSizeMb: 256 }, stdout: true, stderr: true });
      timeout = setTimeout(() => reject(Error('HEIC conversion timed out')), 20000);
      worker.once('message', result => result.error ? reject(Error(result.error)) : resolve(Buffer.from(result)));
      worker.once('error', reject);
      worker.once('exit', () => reject(Error('HEIC worker exited before conversion')));
    });
  } finally {
    clearTimeout(timeout);
    if (worker) await worker.terminate();
    activeHeicWorkers--;
  }
}
function isHeic(buffer) {
  if (buffer.length < 16 || buffer.toString('ascii', 4, 8) !== 'ftyp') return false;
  const boxSize = buffer.readUInt32BE(0);
  if (boxSize < 16 || boxSize > buffer.length) return false;
  const brands = [buffer.toString('ascii', 8, 12)];
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) brands.push(buffer.toString('ascii', offset, offset + 4));
  return brands.some(brand => ['heic', 'heix', 'hevc', 'hevx'].includes(brand));
}
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const storageRoot = () => path.resolve(process.env.PHOTO_STORAGE_PATH || path.join(__dirname, '..', 'uploads'));
const isPhotoKey = key => typeof key === 'string' && /^catches\/[0-9a-f-]{36}\.jpg$/.test(key);
function photoPath(key) {
  if (!isPhotoKey(key)) throw Object.assign(new Error('No stored catch photo.'), { status: 404 });
  return path.join(storageRoot(), key);
}
async function processPhoto(buffer) {
  if (!buffer?.length || buffer.length > MAX_PHOTO_BYTES)
    throw Object.assign(new Error('Choose a photo smaller than 10 MB.'), { status: 400 });
  try {
    if (isHeic(buffer)) return await processHeic(buffer);
    const image = sharp(buffer, { limitInputPixels: 40000000, animated: false });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw Error('Unsupported image');
    // Re-encoding strips metadata; rotate applies EXIF orientation before removing it.
    return await image.rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch (error) {
    if (error.status === 503) throw error;
    throw Object.assign(new Error('Choose a valid JPEG, PNG, WebP, or HEIC photo (up to 40 megapixels).'), { status: 400 });
  }
}
async function storePhoto(buffer) {
  const key = `catches/${randomUUID()}.jpg`;
  await fs.mkdir(path.join(storageRoot(), 'catches'), { recursive: true, mode: 0o700 });
  await fs.writeFile(photoPath(key), buffer, { flag: 'wx', mode: 0o600 });
  return key;
}
async function removePhoto(key) {
  if (!isPhotoKey(key)) return;
  try { await fs.unlink(photoPath(key)); }
  catch (error) { if (error.code !== 'ENOENT') console.warn('Unable to remove catch photo', { code: error.code }); }
}
async function readPhoto(key) { return fs.readFile(photoPath(key)); }
module.exports = { MAX_PHOTO_BYTES, isPhotoKey, photoPath, processPhoto, storePhoto, removePhoto, readPhoto };
