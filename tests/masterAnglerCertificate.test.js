const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../controllers/masterAnglerController'), 'utf8');
function setup({ fish = { id: 42, user_id: 7, master_angler: true }, user = { id: 7 }, id = '42', fail = false } = {}) {
  let generated = 0;
  let queried = 0;
  const models = { FishCatch: { findByPk: async catchId => { queried++; assert.equal(catchId, 42); return fish; } } };
  const context = { exports: {}, process: { env: {} }, console: { error() {} }, require: name => {
    if (name === '../models') return models;
    if (name === 'aws-sdk') return { S3: class {} };
    if (name === '../services/masterAnglerCertificate') return { createMasterAnglerCertificate: async data => { generated++; assert.equal(data, fish); if (fail) throw Error('PDF failed'); return Buffer.from('%PDF-1.7'); } };
    return {};
  } };
  vm.runInNewContext(source, context);
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, set(headers) { this.headers = headers; }, send(body) { this.body = body; return this; } };
  return { res, counts: () => ({ generated, queried }), run: () => context.exports.generateCertificate({ user, params: { id } }, res) };
}
test('owner downloads a flagged catch without a review', async () => {
  const { run, res, counts } = setup(); await run();
  assert.equal(res.code, 200);
  assert.ok(Buffer.isBuffer(res.body));
  assert.equal(res.headers['Content-Type'], 'application/pdf');
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.match(res.headers['Content-Disposition'], /master_angler_42_certificate.pdf/);
  assert.equal(counts().generated, 1);
});
test('admin may generate a certificate for a flagged catch', async () => {
  const { run, res } = setup({ user: { id: 99, is_admin: true } }); await run(); assert.equal(res.code, 200);
});
test('rejects missing login, invalid IDs, unflagged catches, and other owners', async () => {
  for (const [options, code] of [
    [{ user: null }, 401], [{ id: '../42' }, 400], [{ fish: null }, 404],
    [{ fish: { id: 42, user_id: 7, master_angler: false } }, 403],
    [{ user: { id: 99 } }, 403],
  ]) {
    const { run, res, counts } = setup(options); await run();
    assert.equal(res.code, code); assert.equal(counts().generated, 0);
    if (code === 400 || code === 401) assert.equal(counts().queried, 0);
  }
});
test('PDF failures return a retryable error without PDF headers', async () => {
  const { run, res } = setup({ fail: true }); await run(); assert.equal(res.code, 500); assert.equal(res.headers, undefined);
});
test('certificate route authenticates the token and allows non-admin owners', () => {
  const registrations = [];
  const router = { post: (...args) => registrations.push(args), get() {}, patch() {} };
  const auth = { addUserToReq() {}, loginRequired() {}, adminRequired() {} };
  const controller = { generateCertificate() {} };
  const context = { module: { exports: {} }, require: name => {
    if (name === 'express') return { Router: () => router };
    if (name === 'multer') return () => ({ single() {} });
    if (name.includes('authMiddleware')) return auth;
    return controller;
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../routes/masterAnglerRoutes'), 'utf8'), context);
  assert.deepEqual(registrations.find(args => args[0] === '/:id/certificate').slice(1), [auth.addUserToReq, auth.loginRequired, controller.generateCertificate]);
});
