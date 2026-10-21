const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { isSignupEnabled } = require('../config/registration');

test('public signup defaults closed and requires an explicit true flag', () => {
  for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
    assert.equal(isSignupEnabled({ ALLOW_PUBLIC_SIGNUP: value }), false);
  }
  assert.equal(isSignupEnabled({ ALLOW_PUBLIC_SIGNUP: 'true' }), true);
});

test('disabled signup blocks all account creation; enabling restores normal signup without admin injection', async () => {
  let enabled = false;
  let created;
  const context = { exports: {}, require: name => {
    if (name === '../helpers/errors') return require('../helpers/errors');
    if (name === '../config/registration') return { isSignupEnabled: () => enabled };
    if (name === '../helpers/createToken') return () => 'signed-token';
    if (name === 'sequelize') return { Op: {} };
    if (name === '../models') return { User: {
      findOne: async () => null,
      create: async data => { created = data; return { ...data, id: 42, is_admin: false }; },
    } };
    throw Error(`Unexpected dependency: ${name}`);
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/userController'), 'utf8'), context);
  const body = { username: 'angler', first_name: 'Test', last_name: 'Angler', password: 'test-password', email: 'test@example.com', is_admin: true };
  async function signup(body) {
    const res = { status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; } };
    await context.exports.signup({ body }, res);
    return res;
  }
  assert.equal((await signup(body)).code, 403);
  assert.equal(created, undefined);
  enabled = true;
  assert.equal((await signup({})).code, 400);
  const res = await signup(body);
  assert.equal(res.code, 201);
  assert.equal(res.body.token, 'signed-token');
  assert.equal(res.body.user.is_admin, false);
  assert.equal(created.is_admin, undefined);
  assert.equal(created.username, 'angler');
  enabled = false;
  assert.equal((await signup(body)).code, 403);
});
