const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const jwt = require('jsonwebtoken');
const { readAuthConfig } = require('../config/auth');
const secret = require('node:crypto').randomBytes(48).toString('hex');

// Each test file runs in its own process; never use the local deployment secret.
process.env.JWT_SECRET_KEY = secret;
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_EXPIRATION = '3600';
const { verifyToken } = require('../helpers/authTokens');
const createToken = require('../helpers/createToken');

test('configuration rejects absent/placeholder secrets, unsupported algorithms, and unsafe lifetimes', () => {
  for (const value of [undefined, '', 'short', 'your_default_secret_key', 'x'.repeat(64), 'replace_me_with_a_long_random_secret_123456']) {
    assert.throws(() => readAuthConfig({ JWT_SECRET_KEY: value }), /JWT_SECRET_KEY/);
  }
  for (const value of ['none', 'HS512', 'RS256', '']) {
    assert.throws(() => readAuthConfig({ JWT_SECRET_KEY: secret, JWT_ALGORITHM: value }), /JWT_ALGORITHM/);
  }
  for (const value of ['', '0', '-1', '1h', '3600junk', '1.5', '86401', '9007199254740992']) {
    assert.throws(() => readAuthConfig({ JWT_SECRET_KEY: secret, JWT_EXPIRATION: value }), /JWT_EXPIRATION/);
  }
  assert.equal(readAuthConfig({ JWT_SECRET_KEY: secret }).expiration, 86400);
  assert.equal(readAuthConfig({ JWT_SECRET_KEY: secret, JWT_EXPIRATION: '60' }).expiration, 60);
});

test('application refuses unsafe configuration before database initialization', () => {
  const result = spawnSync(process.execPath, ['index.js'], {
    cwd: require('node:path').resolve(__dirname, '..'),
    env: { ...process.env, JWT_SECRET_KEY: '' }, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /JWT_SECRET_KEY must/);
  assert.doesNotMatch(result.stdout, /Server started|connected to DB/);
});

test('tokens created for existing users verify with the same configuration', () => {
  const token = createToken({ id: 42, username: 'angler', is_admin: false });
  const payload = verifyToken(token);
  assert.equal(payload.user_id, 42);
  assert.equal(payload.username, 'angler');
  assert.equal(payload.exp - payload.iat, 3600);
  assert.equal(jwt.decode(token, { complete: true }).header.alg, 'HS256');
});

test('verification rejects forged, expired, wrong-algorithm and incomplete claims', () => {
  const now = Math.floor(Date.now() / 1000);
  const sign = (payload, options = {}) => jwt.sign({ jti: require('node:crypto').randomUUID(), ...payload }, secret, { algorithm: 'HS256', ...options });
  for (const token of [
    jwt.sign({ user_id: 42 }, 'another-secret', { expiresIn: 60 }),
    sign({ user_id: 42 }, { algorithm: 'HS512', expiresIn: 60 }),
    sign({ user_id: 42 }, { algorithm: 'none', expiresIn: 60 }),
    sign({ user_id: 42, iat: now - 100, exp: now - 1 }),
    sign({ user_id: 42 }),
    sign({ user_id: 42, jti: undefined }, { expiresIn: 60 }),
    sign({ user_id: '42' }, { expiresIn: 60 }),
    sign({ user_id: -1 }, { expiresIn: 60 }),
    sign({ user_id: 42 }, { expiresIn: 3601 }),
    sign({ user_id: 42, iat: now + 60, exp: now + 120 }),
    sign({ user_id: 42, exp: now + 60 }, { noTimestamp: true }),
    'malformed',
  ]) assert.throws(() => verifyToken(token));
});

test('both authentication entry points reject malformed headers and deleted users', async () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  let lookups = 0;
  const context = { module: { exports: {} }, require: name => {
    if (name === '../helpers/errors') return require('../helpers/errors');
    if (name === '../helpers/authTokens') return { verifyToken };
    if (name === '../models') return { RevokedSession: { findByPk: async () => null }, User: { findByPk: async id => {
      lookups++;
      return id === 42 ? { id, is_admin: false } : null;
    } } };
    throw Error(`Unexpected dependency: ${name}`);
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../middleware/authMiddleware'), 'utf8'), context);
  const middleware = context.module.exports;
  const token = createToken({ id: 42, username: 'angler' });
  async function run(header, handler = middleware.tokenRequired) {
    const req = { headers: { authorization: header } };
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    let passed = false;
    await handler(req, res, () => { passed = true; });
    return { req, res, passed };
  }
  for (const header of [undefined, token, `Basic ${token}`, `Bearer ${token} extra`, ['Bearer', token], 'Bearer invalid']) {
    assert.equal((await run(header)).res.code, 401);
  }
  assert.equal(lookups, 0);
  assert.equal((await run(`Bearer ${createToken({ id: 99 })}`)).res.code, 401);
  for (const handler of [middleware.tokenRequired, middleware.addUserToReq]) {
    const result = await run(`Bearer ${token}`, handler);
    assert.equal(result.passed, true);
    assert.equal(result.req.user.id, 42);
  }
});
