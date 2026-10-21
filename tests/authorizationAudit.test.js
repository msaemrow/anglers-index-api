const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');

function load(path, dependencies) {
  const context = { module: { exports: {} }, exports: {}, process: { env: {} }, require: name => {
    if (name === '../helpers/errors') return require('../helpers/errors');
    if (name === 'dotenv') return { config() {} };
    if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve(path), 'utf8'), context);
  return Object.keys(context.exports).length ? context.exports : context.module.exports;
}

test('every protected route rejects anonymous access and catalog/admin writes reject ordinary users', async t => {
  const calls = [];
  const lure = { id: 17, brand: 'Acme', name: 'Spoon', color: 'silver', size: 'small' };
  const models = {
    User: { findByPk: async id => ({ id, is_admin: id === 1 }) },
    RevokedSession: { findByPk: async () => null },
    Lure: {
      findAll: async options => { calls.push(options); return [lure]; },
      findByPk: async (id, options) => { calls.push(options); return lure; },
    },
    sequelize: {},
  };
  const auth = load('../middleware/authMiddleware', {
    '../models': models, '../helpers/authTokens': { verifyToken(token) {
      if (!['42', '1'].includes(token)) throw Error('Invalid');
      return { user_id: Number(token) };
    } },
  });
  const dependencies = {
    '../models': models, sequelize: { Op: {} }, axios: {},
    '../services/masterAnglerReview': {}, '../services/catchWeather': {},
    '../services/catchPhotos': {}, '../services/trips': require('../services/trips'),
    '../config/registration': { isSignupEnabled: () => false }, '../helpers/createToken': () => 'token',
  };
  const app = express();
  app.use(express.json());
  const controllerNames = ['user', 'fishCatch', 'lure', 'lake', 'species', 'masterAngler', 'tackleBox', 'trip'];
  const controllers = Object.fromEntries(controllerNames.map(name => [name, load(`../controllers/${name}Controller`, dependencies)]));
  const extra = {
    '../controllers/catchPhotoController': load('../controllers/catchPhotoController', dependencies),
    '../controllers/catchAnalysisController': load('../controllers/catchAnalysisController', dependencies),
    '../middleware/catchPhotoUpload': () => assert.fail('Unauthorized uploads must not be processed'),
  };
  const prefixes = { user: '/users', fishCatch: '/fishcatch', lure: '/lures', lake: '/lakes', species: '/species', masterAngler: '/masterangler', tackleBox: '/tackle-box', trip: '/trips' };
  for (const name of Object.keys(prefixes)) {
    app.use(prefixes[name], load(`../routes/${name}Routes`, { express, '../middleware/authMiddleware': auth, [`../controllers/${name}Controller`]: controllers[name], ...extra }));
  }
  app.get('/dashboard', auth.addUserToReq, auth.loginRequired, () => assert.fail('Anonymous dashboard request passed'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(method, path, token) {
    return fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  }
  const protectedRoutes = [
    ['GET', '/users'], ['GET', '/users/42'], ['PATCH', '/users/42'], ['DELETE', '/users/42'], ['POST', '/users/logout'],
    ['GET', '/fishcatch'], ['GET', '/fishcatch/17'], ['PATCH', '/fishcatch/17'], ['DELETE', '/fishcatch/17'], ['POST', '/fishcatch'],
    ['GET', '/fishcatch/17/photo'], ['POST', '/fishcatch/17/photo'], ['DELETE', '/fishcatch/17/photo'], ['GET', '/fishcatch/analysis'], ['POST', '/fishcatch/weather'],
    ['GET', '/tackle-box/42'], ['POST', '/tackle-box'], ['DELETE', '/tackle-box'],
    ['GET', '/trips'], ['GET', '/trips/17'], ['POST', '/trips'], ['DELETE', '/trips/17'], ['POST', '/trips/17/catches'],
    ['POST', '/lures'], ['POST', '/masterangler/17/certificate'], ['GET', '/dashboard'],
  ];
  const adminRoutes = [
    ['PUT', '/lures/17'], ['DELETE', '/lures/delete/17'],
    ['POST', '/lakes'], ['PUT', '/lakes/17'], ['DELETE', '/lakes/17'],
    ['POST', '/species'], ['PUT', '/species/17'], ['DELETE', '/species/17'],
    ['GET', '/masterangler'], ['PATCH', '/masterangler/17'], ['POST', '/masterangler'],
  ];
  for (const [method, path] of protectedRoutes) assert.equal((await request(method, path)).status, 401, `${method} ${path}`);
  for (const [method, path] of adminRoutes) {
    assert.ok([401, 403].includes((await request(method, path)).status), `${method} ${path}`);
    assert.equal((await request(method, path, '42')).status, 403, `${method} ${path}`);
  }
  assert.equal(calls.length, 0, 'denied requests must not query catalog data');
  assert.equal((await request('GET', '/lures?user_id=7')).status, 401);
  assert.equal((await request('GET', '/lures?user_id=7', '42')).status, 403);
  assert.equal(calls.length, 0);
  for (const path of ['/lures?lures_only=Y', '/lures/17', '/lures?user_id=42&lures_only=Y']) {
    const res = await request('GET', path, path.includes('user_id') ? '42' : undefined);
    assert.equal(res.status, 200);
    assert.doesNotMatch(await res.text(), /email|username|user_id|owner/);
    assert.deepEqual(Array.from(calls.at(-1).attributes), ['id', 'brand', 'name', 'color', 'size']);
    assert.equal(calls.at(-1).include, undefined);
  }
  assert.equal(calls.at(-1).where.user_id, 42);
});

test('catch writes reject other owners before changes and preserve owner/admin operations', async () => {
  const mutations = [];
  const fish = { id: 17, user_id: 7, toJSON: () => ({ id: 17, user_id: 7 }),
    update: async data => mutations.push(['update', data]), destroy: async () => mutations.push(['delete']) };
  const controller = load('../controllers/fishCatchController', {
    '../models': { FishCatch: { findByPk: async () => fish }, MasterAngler: { findOne: async () => null },
      sequelize: { transaction: callback => callback({ LOCK: { UPDATE: 'UPDATE' } }) } },
    sequelize: {}, axios: {}, '../services/catchWeather': {},
    '../services/masterAnglerReview': { awardFields: () => ({}), syncSubmission: async () => null },
    '../services/catchPhotos': { removePhoto: async () => mutations.push(['photo']) },
  });
  const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  for (const name of ['updateFishCatch', 'deleteFishCatch']) {
    const res = response();
    await controller[name]({ user: { id: 42 }, params: { catch_id: '17' }, body: { length: 20 } }, res);
    assert.equal(res.code, 403);
  }
  assert.equal(mutations.length, 0);
  for (const user of [{ id: 7 }, { id: 42, is_admin: true }]) {
    const res = response();
    await controller.updateFishCatch({ user, params: { catch_id: '17' }, body: { length: 20 } }, res);
    assert.equal(res.body.id, 17);
  }
  assert.equal(mutations.length, 2);
});
