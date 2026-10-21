const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup({ owner = 7, admin = false, missing = false, fail = false, remove = false } = {}) {
  const calls = [];
  const fish = { user_id: owner, fish_image: 'old-photo', toJSON() { return { id: 42, fish_image: this.fish_image }; }, async update(data) { this.fish_image = data.fish_image; } };
  const context = { exports: {}, require: name => {
    if (name === '../helpers/errors') return require('../helpers/errors');
    if (name === '../models') return { FishCatch: { findByPk: async () => missing ? null : fish }, sequelize: { transaction: async fn => { const result = await fn({ LOCK: { UPDATE: 'update' } }); if (fail) throw Error('rollback'); return result; } } };
    if (name === '../services/catchPhotos') return { storePhoto: async () => { calls.push('store'); return 'new-photo'; }, removePhoto: async key => calls.push(`remove:${key}`), readPhoto: async key => { calls.push(`read:${key}`); return Buffer.from('photo'); } };
    if (name === '../services/masterAnglerReview') return { syncSubmission: async () => { calls.push('sync'); return { status: remove ? 'not_eligible' : 'pending' }; }, awardFields: (_, review) => ({ master_angler_status: review.status }) };
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/catchPhotoController'), 'utf8'), context);
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, set(headers) { this.headers = headers; }, send(data) { this.data = data; return this; } };
  const req = { params: { catch_id: 42 }, user: { id: 7, is_admin: admin }, photoBuffer: Buffer.from('photo'), method: remove ? 'DELETE' : 'POST' };
  return { calls, res, save: () => context.exports.savePhoto(req, res), read: () => context.exports.getPhoto(req, res) };
}
test('rejects other owners before any storage access and allows admins', async () => {
  for (const method of ['save', 'read']) {
    const denied = setup({ owner: 99 }); await denied[method]();
    assert.equal(denied.res.code, 403); assert.deepEqual(denied.calls, []);
    const admin = setup({ owner: 99, admin: true }); await admin[method](); assert.equal(admin.res.code, 200);
  }
});
test('replacement synchronizes eligibility and removes only the previous photo after commit', async () => {
  const ctx = setup(); await ctx.save();
  assert.deepEqual(ctx.calls, ['store', 'sync', 'remove:old-photo']);
  assert.equal(ctx.res.data.master_angler_status, 'pending');
});
test('rollback removes new file and preserves previous photo', async () => {
  const ctx = setup({ fail: true }); await ctx.save();
  assert.equal(ctx.res.code, 500); assert.deepEqual(ctx.calls, ['store', 'sync', 'remove:new-photo']);
});
test('removal clears stored key and recomputes eligibility', async () => {
  const ctx = setup({ remove: true }); await ctx.save();
  assert.equal(ctx.res.data.fish_image, ''); assert.equal(ctx.res.data.master_angler_status, 'not_eligible');
  assert.deepEqual(ctx.calls, ['sync', 'remove:old-photo']);
});
test('photo responses are private and cannot be cached across sessions', async () => {
  const ctx = setup(); await ctx.read(); assert.equal(ctx.res.headers['Cache-Control'], 'private, no-store'); assert.equal(ctx.res.headers['Content-Type'], 'image/jpeg');
});
