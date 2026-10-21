const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const { sendError, logError, publicError, requestContext, errorHandler } = require('../helpers/errors');
const secret = 'INTERNAL_SECRET_SENTINEL';

test('unexpected and database failures never expose internal messages or sensitive exception properties', t => {
  const records = [];
  t.mock.method(console, 'error', line => records.push(JSON.parse(line)));
  const req = { requestId: 'test-id', method: 'POST', route: { path: '/users/login' }, body: { password: secret }, headers: { authorization: secret }, query: { key: secret } };
  for (const [name, expected] of [['Error', 500], ['AxiosError', 500], ['SequelizeDatabaseError', 500], ['SequelizeValidationError', 400], ['SequelizeUniqueConstraintError', 409], ['SequelizeForeignKeyConstraintError', 409]]) {
    const error = Object.assign(new Error(secret), { name, sql: secret, config: { url: secret }, status: 400, code: '23505' });
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    sendError(res, error, req);
    assert.equal(res.code, expected);
    assert.doesNotMatch(JSON.stringify(res.body), /INTERNAL_SECRET/);
  }
  assert.equal(records.length, 6);
  assert.equal(records[0].requestId, 'test-id');
  assert.equal(records[0].route, '/users/login');
  assert.doesNotMatch(JSON.stringify(records), /INTERNAL_SECRET|password|authorization|sql|config/);
  const unknown = Object.assign(new Error(secret), { name: secret, code: secret + '\n' });
  logError(unknown, req);
  assert.equal(records.at(-1).errorType, 'Error');
  assert.equal(records.at(-1).code, undefined);
});

test('Express final handler produces safe JSON for parsing, CORS, async failures, and oversized bodies in all environments', async t => {
  t.mock.method(console, 'error', () => {});
  const app = express();
  app.set('env', 'development'); // Development responses must also avoid stack traces.
  app.use(requestContext);
  app.use(cors({ origin(origin, callback) { callback(origin ? publicError(403, 'Origin is not allowed.') : null, true); } }));
  app.use(express.json({ limit: 100 }));
  app.post('/json', (req, res) => res.json({ ok: true }));
  app.get('/failure', async () => { throw Error(secret); });
  app.get('/untrusted-status', () => { throw Object.assign(Error(secret), { status: 400 }); });
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cases = [
    ['/json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: `{"${secret}":` }, 400],
    ['/json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: secret.repeat(30) }) }, 413],
    ['/json', { method: 'POST', headers: { Origin: 'https://untrusted.example' } }, 403],
    ['/failure', {}, 500], ['/untrusted-status', {}, 500],
  ];
  for (const [path, options, status] of cases) {
    const res = await fetch(base + path, options);
    assert.equal(res.status, status);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.match(res.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
    assert.doesNotMatch(await res.text(), /INTERNAL_SECRET|stack|<!DOCTYPE|SyntaxError/);
  }
});

test('controller database/provider failures return safe responses rather than raw exception messages', async t => {
  t.mock.method(console, 'error', () => {});
  const fs = require('node:fs');
  const vm = require('node:vm');
  const fail = async () => { throw Object.assign(new Error(secret), { status: 400 }); };
  const model = { findAll: fail, findByPk: fail, findOne: fail, create: fail };
  const dependencies = {
    '../helpers/errors': require('../helpers/errors'),
    '../models': { User: model, Lure: model, Species: model, Lake: model, FishCatch: model,
      MasterAngler: model, TackleBox: model, sequelize: { transaction: fail } },
    sequelize: { Op: {} }, axios: { get: fail }, dotenv: { config() {} },
    '../config/registration': { isSignupEnabled: () => true }, '../helpers/createToken': () => 'token',
    '../services/masterAnglerReview': {}, '../services/catchWeather': {},
  };
  const cases = {
    user: ['signup', 'login', 'getAllUsers', 'getUserById', 'updateUser', 'deleteUser'],
    lure: ['getLures', 'getLureById', 'deleteLure'],
    fishCatch: ['getAllFishCatches', 'getFishCatchById', 'updateFishCatch', 'deleteFishCatch', 'getWeather'],
    species: ['getAllFishSpecies', 'updateFishSpecies', 'deleteFishSpecies'],
    lake: ['getLakes', 'getLakeById', 'deleteLake', 'updateLake'],
  };
  for (const [file, handlers] of Object.entries(cases)) {
    const context = { exports: {}, module: { exports: {} }, process: { env: {} }, require: name => {
      if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve(`../controllers/${file}Controller`), 'utf8'), context);
    const controller = Object.keys(context.exports).length ? context.exports : context.module.exports;
    for (const name of handlers) {
      const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await controller[name]({ user: { id: 42, is_admin: true }, query: {},
        params: { user_id: '42', catch_id: '17', lureId: '17', lakeId: '17', speciesId: '17' },
        body: name === 'updateFishCatch' ? { length: 20 } : { username: 'angler', password: 'test', email: 'test@example.com', first_name: 'Test', last_name: 'Angler', master_angler_length: 20, lat: 40, long: -90, dt: 1000 },
      }, res);
      assert.equal(res.code, 500, `${file}.${name}`);
      assert.doesNotMatch(JSON.stringify(res.body), /INTERNAL_SECRET/, `${file}.${name}`);
    }
  }
});
