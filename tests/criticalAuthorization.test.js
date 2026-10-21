const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');

function load(path, dependencies) {
  const context = { process: { env: { JWT_SECRET_KEY: "test-only" } }, module: { exports: {} }, exports: {}, require: name => {
    if (name === '../helpers/errors') return require('../helpers/errors');
    if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve(path), 'utf8'), context);
  return Object.keys(context.exports).length ? context.exports : context.module.exports;
}

test('HTTP routes enforce authentication, tackle box ownership, and admin-only lure deletion', async t => {
  const calls = [];
  const models = {
    RevokedSession: { findByPk: async () => null, upsert: async () => {}, destroy: async () => {} },
    User: { findByPk: async id => id === 99 ? null : { id, is_admin: id === 1 } },
    Lure: { findByPk: async id => { calls.push(['lure', id]); return { destroy: async () => calls.push(['deleteLure']) }; } },
    TackleBox: {
      findAll: async options => { calls.push(['list', options.where]); return []; },
      findOne: async options => { calls.push(['find', options.where]); return null; },
      create: async data => { calls.push(['create', data]); },
      destroy: async options => { calls.push(['remove', options.where]); return 1; },
    },
  };
  const auth = load('../middleware/authMiddleware', {
    '../helpers/authTokens': { verifyToken: token => {
      if (!['1', '42', '99'].includes(token)) throw Error('Invalid or expired token');
      return { user_id: Number(token), jti: "11111111-1111-4111-8111-111111111111", exp: Math.floor(Date.now() / 1000) + 3600 };
    } },
    '../models': models,
    dotenv: { config() {} },
  });
  const tackle = load('../controllers/tackleBoxController', { '../models': models });
  const lure = load('../controllers/lureController', { '../models': models, sequelize: { Op: {} } });
  const dependencies = { express, '../middleware/authMiddleware': auth };
  const app = express();
  app.use(express.json());
  app.use('/tackle-box', load('../routes/tackleBoxRoutes', { ...dependencies, '../controllers/tackleBoxController': tackle }));
  app.use('/lures', load('../routes/lureRoutes', { ...dependencies, '../controllers/lureController': lure }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(method, path, token, body) {
    return fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}),
    });
  }
  const operations = [
    ['GET', '/tackle-box/42'],
    ['POST', '/tackle-box', { user_id: 42, lure_id: 17 }],
    ['DELETE', '/tackle-box', { user_id: 42, lure_id: 17 }],
    ['DELETE', '/lures/delete/17'],
  ];
  for (const token of [undefined, 'invalid', '99']) {
    for (const [method, path, body] of operations) {
      assert.equal((await request(method, path, token, body)).status, 401);
    }
  }
  assert.equal(calls.length, 0, 'unauthenticated requests must not access application data');
  for (const token of ['42', '1']) {
    for (const method of ['GET', 'POST', 'DELETE']) {
      const path = method === 'GET' ? '/tackle-box/7' : '/tackle-box';
      assert.equal((await request(method, path, token, method === 'GET' ? undefined : { user_id: 7, lure_id: 17 })).status, 403);
    }
  }
  assert.equal((await request('DELETE', '/lures/delete/17', '42')).status, 403);
  assert.equal(calls.length, 0, 'denied requests must not read or mutate application data');
  for (const [method, path, body] of operations.slice(0, 3)) {
    assert.equal((await request(method, path, '42', body)).status, method === 'POST' ? 201 : 200);
  }
  for (const [kind, where] of calls) {
    assert.equal(where.user_id, 42, `${kind} must use the authenticated owner`);
  }
  assert.equal((await request('DELETE', '/lures/delete/17', '1')).status, 200);
  assert.equal(calls.at(-1)[0], 'deleteLure');
});

test('personal reads and account routes enforce verified identity and ownership', async t => {
  const calls = [];
  const account = id => ({ id: Number(id), is_admin: Number(id) === 1, username: 'angler',
    toJSON: () => ({ id: Number(id), username: 'angler' }),
    save: async () => calls.push(['saveUser']), destroy: async () => calls.push(['deleteUser']) });
  const models = {
    RevokedSession: { findByPk: async () => null, upsert: async () => {}, destroy: async () => {} },
    User: {
      findByPk: async (id, options) => {
        if (options) calls.push(['profile', id]);
        return Number(id) === 99 ? null : account(id);
      },
      findAll: async () => { calls.push(['users']); return []; },
    },
    FishCatch: {
      findAll: async options => { calls.push(['catches', options.where]); return [{ toJSON: () => ({ id: 17, user_id: 42 }) }]; },
      findOne: async options => {
        calls.push(['catch', options.where]);
        return options.where.user_id && options.where.user_id !== 42 ? null : { id: 17, user_id: 42, toJSON: () => ({ id: 17, user_id: 42 }) };
      },
      count: async () => 0,
    },
    MasterAngler: { count: async () => 0, findOne: async () => null },
    Lure: { count: async () => 0 },
    Species: { findAll: async options => { calls.push(['species', options.include?.[0].where]); return []; } },
  };
  const auth = load('../middleware/authMiddleware', {
    '../models': models, dotenv: { config() {} },
    '../helpers/authTokens': { verifyToken: token => {
      if (!['1', '7', '42', '99'].includes(token)) throw Error('Invalid token');
      return { user_id: Number(token), jti: "11111111-1111-4111-8111-111111111111", exp: Math.floor(Date.now() / 1000) + 3600 };
    } },
  });
  const users = load('../controllers/userController', {
    '../models': models, sequelize: { Op: {} }, bcrypt: {}, '../helpers/createToken': () => 'token',
    '../config/registration': { isSignupEnabled: () => false },
  });
  const fish = load('../controllers/fishCatchController', {
    '../models': models, sequelize: { Op: {} }, axios: {}, '../services/catchWeather': {},
    '../services/masterAnglerReview': { serializeAward: fish => fish.toJSON(), awardFields: () => ({}) },
  });
  const species = load('../controllers/speciesController', { '../models': models, sequelize: { Op: {} } });
  const shared = { express, '../middleware/authMiddleware': auth };
  const app = express();
  app.use(express.json());
  app.use('/users', load('../routes/userRoutes', { ...shared, '../controllers/userController': users }));
  const noop = (req, res) => res.json({});
  app.use('/fishcatch', load('../routes/fishCatchRoutes', {
    ...shared, '../controllers/fishCatchController': fish,
    '../middleware/catchPhotoUpload': noop, '../controllers/catchPhotoController': { getPhoto: noop, savePhoto: noop },
    '../controllers/catchAnalysisController': { getCatchAnalysis: noop },
  }));
  app.use('/species', load('../routes/speciesRoutes', { ...shared, '../controllers/speciesController': species }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(method, path, token, body) {
    return fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}),
    });
  }
  for (const token of [undefined, 'invalid', '99']) {
    for (const [method, path] of [
      ['GET', '/users'], ['GET', '/users/42'], ['PATCH', '/users/42'], ['DELETE', '/users/42'],
      ['POST', '/users/logout'], ['GET', '/fishcatch?user_id=42'], ['GET', '/fishcatch/17'],
      ['GET', '/species?includeCaughtSpecies=true&userId=42'],
    ]) assert.equal((await request(method, path, token)).status, 401, `${method} ${path}`);
  }
  assert.equal(calls.length, 0);
  for (const [method, path] of [
    ['GET', '/users'], ['GET', '/users/7'], ['PATCH', '/users/7'], ['DELETE', '/users/7'],
    ['GET', '/fishcatch?user_id=7'], ['GET', '/species?includeCaughtSpecies=true&userId=7'],
    ['GET', '/users/42oops'], ['PATCH', '/users/42oops'], ['DELETE', '/users/42oops'],
  ]) assert.equal((await request(method, path, '42', {})).status, 403, `${method} ${path}`);
  assert.equal(calls.length, 0, 'cross-user requests must not touch application data');
  assert.equal((await request('GET', '/fishcatch/17', '7')).status, 404);
  assert.equal(calls.at(-1)[1].user_id, 7, 'detail query must include ownership');
  for (const path of ['/fishcatch', '/fishcatch?catch_id=17', '/fishcatch?user_id=42']) {
    const response = await request('GET', path, '42');
    assert.equal(response.status, 200);
    assert.equal((await response.json())[0].user_id, 42);
    assert.equal(calls.at(-1)[1].user_id, 42);
  }
  assert.equal((await request('GET', '/fishcatch/17', '42')).status, 200);
  assert.equal((await request('GET', '/fishcatch/17', '1')).status, 200, 'admins can review individual catches');
  assert.equal((await request('GET', '/users/42', '42')).status, 200);
  assert.equal((await request('PATCH', '/users/42', '42', { first_name: 'Matt' })).status, 200);
  assert.ok(calls.some(([kind]) => kind === 'saveUser'));
  assert.equal((await request('POST', '/users/logout', '42')).status, 200);
  assert.equal((await request('GET', '/users', '1')).status, 200);
  assert.equal((await request('GET', '/users/42', '1')).status, 200);
  assert.equal((await request('GET', '/species')).status, 200, 'catalog stays available without a session');
  for (const path of ['/species?includeCaughtSpecies=true', '/species?includeCaughtSpecies=true&userId=42']) {
    assert.equal((await request('GET', path, '42')).status, 200);
    assert.equal(calls.at(-1)[1].user_id, 42);
  }
  assert.equal((await request('POST', '/users/login', undefined, {})).status, 400, 'login remains reachable');
  assert.equal((await request('POST', '/users/signup', undefined, {})).status, 403, 'public signup is disabled');
  const signupCalls = calls.length;
  for (const token of [undefined, '42', '1']) {
    assert.equal((await request('POST', '/users/signup', token, {
      username: 'newuser', password: 'strong-password-for-test', first_name: 'New', last_name: 'User', email: 'new@example.com', is_admin: true,
    })).status, 403);
  }
  assert.equal(calls.length, signupCalls, 'disabled registration must not touch user data');
  assert.equal((await request('DELETE', '/users/42', '42')).status, 200);
  assert.ok(calls.some(([kind]) => kind === 'deleteUser'));
});
