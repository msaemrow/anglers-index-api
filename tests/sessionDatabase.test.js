const { test } = require('node:test');
const assert = require('node:assert/strict');

test('PostgreSQL persists logout revocation across authentication middleware reload', {
  skip: process.env.RUN_DB_SECURITY_TESTS !== 'true',
}, async t => {
  process.env.JWT_SECRET_KEY = require('node:crypto').randomBytes(48).toString('hex');
  process.env.JWT_ALGORITHM = 'HS256';
  process.env.JWT_EXPIRATION = '3600';
  const { User, RevokedSession, sequelize } = require('../models');
  let cleanupId;
  t.after(async () => {
    try { if (cleanupId) await RevokedSession.destroy({ where: { id: cleanupId } }); }
    finally { await sequelize.close(); }
  });
  const user = await User.findOne({ attributes: ['id'] });
  assert.ok(user, 'This opt-in test requires an existing local account; it never creates or modifies users.');
  const createToken = require('../helpers/createToken');
  const { verifyToken } = require('../helpers/authTokens');
  const first = createToken({ id: user.id });
  const second = createToken({ id: user.id });
  const id = verifyToken(first).jti;
  cleanupId = id;
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  async function authenticate(token) {
    const middleware = require('../middleware/authMiddleware');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = response();
    await middleware.addUserToReq(req, res, () => middleware.loginRequired(req, res, () => {}));
    return { req, res };
  }
  const initial = await authenticate(first);
  assert.equal(initial.res.code, 200);
  const res = response();
  await require('../controllers/userController').logout(initial.req, res);
  assert.equal(res.code, 200);
  assert.ok(await RevokedSession.findByPk(id));
  delete require.cache[require.resolve('../middleware/authMiddleware')];
  assert.equal((await authenticate(first)).res.code, 401);
  assert.equal((await authenticate(second)).res.code, 200);
});
