const multer = require('multer');
const { MAX_PHOTO_BYTES, processPhoto } = require('../services/catchPhotos');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 20, fieldSize: 8192 } }).single('photo');
module.exports = function catchPhotoUpload(req, res, next) {
  upload(req, res, async error => {
    if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Choose a photo smaller than 10 MB.' : 'Invalid photo upload. Attach one photo.' });
    try {
      if (req.file) req.photoBuffer = await processPhoto(req.file.buffer);
      if (typeof req.body.new_trip === 'string') req.body.new_trip = JSON.parse(req.body.new_trip);
      next();
    } catch (failure) { return res.status(failure.status || 400).json({ error: failure.status ? failure.message : 'Invalid catch upload.' }); }
  });
};
