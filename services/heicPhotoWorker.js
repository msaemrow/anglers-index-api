const { parentPort, workerData } = require('node:worker_threads');
const sharp = require('sharp');
const libheif = require('libheif-js');

async function convert() {
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(new Uint8Array(workerData));
  try {
    // HEIC files may contain auxiliary images. Store only the primary photograph.
    const image = images.find(item => item.is_primary()) || images[0];
    if (!image) throw Error('Invalid HEIC image');
    const width = image.get_width();
    const height = image.get_height();
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width * height > 40000000)
      throw Error('HEIC dimensions exceed the photo limit');
    const pixels = await new Promise((resolve, reject) => {
      image.display({ width, height, data: new Uint8ClampedArray(width * height * 4) }, result => {
        if (!result) reject(Error('Invalid HEIC image')); else resolve(result.data);
      });
    });
    // libheif applies container rotation/mirroring. Raw pixels carry no EXIF data.
    const jpeg = await sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), { raw: { width, height, channels: 4 } })
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 }).toBuffer();
    parentPort.postMessage(jpeg);
  } finally {
    for (const image of images) image.free();
    if (decoder.decoder) libheif.heif_context_free(decoder.decoder);
  }
}
convert().catch(() => parentPort.postMessage({ error: 'Invalid HEIC photo' }));
