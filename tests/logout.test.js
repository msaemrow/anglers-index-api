const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
process.env.JWT_SECRET_KEY = randomBytes(48).toString('hex');
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_EXPIRATION = '3600';
const tokens = require('../helpers/authTokens');
const createToken = require('../helpers/createToken');

function load(path, dependencies) {
  const context = { module: { exports: {} }, exports: {}, console, require: name => {
    if (name === '../helpers/errors') return require('../helpers/errors');
    if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve(path), 'utf8'), context);
  return Object.keys(context.exports).length ? context.exports : context.module.exports;
}
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('logout revokes only the current session, survives middleware reload, and rejects signature aliases', async () => {
  const revocations = new Map();
  let failReads = false;
  let failWrites = false;
  const models = {
    User: { findByPk: async id => ({ id }) },
    RevokedSession: {
      findByPk: async id => { if (failReads) throw Error('database offline'); return revocations.get(id); },
      upsert: async data => { if (failWrites) throw Error('database offline'); revocations.set(data.id, data); },
      destroy: async () => {},
    },
  };
  const dependencies = { '../models': models, '../helpers/authTokens': tokens };
  let middleware = load('../middleware/authMiddleware', dependencies);
  const controller = load('../controllers/userController', {
    '../models': models, '../config/registration': {}, '../helpers/createToken': createToken, sequelize: { Op: { lte: Symbol('lte') } },
  });
  async function authenticate(token) {
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = response();
    await middleware.addUserToReq(req, res, () => middleware.loginRequired(req, res, () => {}));
    return { req, res };
  }
  const first = createToken({ id: 42 });
  const second = createToken({ id: 42 });
  assert.notEqual(jwt.decode(first).jti, jwt.decode(second).jti);
  const authenticated = await authenticate(first);
  assert.equal(authenticated.res.code, 200);
  failWrites = true;
  const failedLogout = response();
  await controller.logout(authenticated.req, failedLogout);
  assert.equal(failedLogout.code, 503);
  assert.equal((await authenticate(first)).res.code, 200);
  failWrites = false;
  await controller.logout(authenticated.req, response());
  assert.equal(revocations.size, 1);
  assert.equal(revocations.get(jwt.decode(first).jti).user_id, 42);
  assert.equal((await authenticate(first)).res.code, 401);
  assert.equal((await authenticate(second)).res.code, 200);
  // Noncanonical base64url padding can verify as the same signature; the signed jti still blocks it.
  assert.equal((await authenticate(first + '=')).res.code, 401);
  middleware = load('../middleware/authMiddleware', dependencies);
  assert.equal((await authenticate(first)).res.code, 401);
  failReads = true;
  assert.equal((await authenticate(second)).res.code, 503, 'database failure must fail closed');
});
