const { FishCatch, sequelize } = require('../models');
const { storePhoto, removePhoto, readPhoto } = require('../services/catchPhotos');
const { syncSubmission, awardFields } = require('../services/masterAnglerReview');
const canAccess = (fish, user) => String(fish.user_id) === String(user.id) || user.is_admin;
exports.getPhoto = async (req, res) => {
  try {
    const fish = await FishCatch.findByPk(req.params.catch_id);
    if (!fish) return res.status(404).json({ error: 'Catch not found.' });
    if (!canAccess(fish, req.user)) return res.status(403).json({ error: 'You cannot view this catch photo.' });
    const photo = await readPhoto(fish.fish_image);
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    return res.send(photo);
  } catch (error) { return res.status(error.status || (error.code === 'ENOENT' ? 404 : 500)).json({ error: 'Catch photo unavailable.' }); }
};
exports.savePhoto = async (req, res) => {
  if (req.method !== 'DELETE' && !req.photoBuffer) return res.status(400).json({ error: 'Attach a catch photo.' });
  let newKey;
  let oldKey;
  let committed = false;
  try {
    const result = await sequelize.transaction(async transaction => {
      const fish = await FishCatch.findByPk(req.params.catch_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!fish) return { status: 404, error: 'Catch not found.' };
      if (!canAccess(fish, req.user)) return { status: 403, error: 'You can only change photos on your own catches.' };
      oldKey = fish.fish_image;
      newKey = req.method === 'DELETE' ? '' : await storePhoto(req.photoBuffer);
      await fish.update({ fish_image: newKey }, { transaction });
      const review = await syncSubmission(fish, transaction);
      return { ...fish.toJSON(), ...awardFields(fish, review), master_angler_review: review };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    committed = true;
    await removePhoto(oldKey);
    return res.json(result);
  } catch { return res.status(500).json({ error: 'Unable to save the catch photo. Please try again.' }); }
  finally { if (!committed && newKey) await removePhoto(newKey); }
};
