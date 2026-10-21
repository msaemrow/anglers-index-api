const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createRateLimiters, applyRouteLimits, readTrustedProxies } = require('../middleware/rateLimits');

async function serve(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}

test('general limiter returns JSON, retry headers and resets after its window', async t => {
  const app = express();
  const { api } = createRateLimiters({ api: { limit: 2, windowMs: 200 } });
  app.use(api);
  app.get('/', (req, res) => res.json({ ok: true }));
  const request = await serve(t, app);
  assert.equal((await request('/')).status, 200);
  assert.equal((await request('/')).status, 200);
  const response = await request('/');
  assert.equal(response.status, 429);
  assert.ok(response.headers.get('retry-after'));
  assert.ok(response.headers.get('ratelimit'));
  assert.match((await response.json()).error, /Too many requests/);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal((await request('/')).status, 200);
});

test('login account limits share normalized usernames across IPs and do not count successes', async t => {
  const app = express();
  app.set('trust proxy', 'loopback');
  app.use(express.json());
  const limits = createRateLimiters({ 'login-account': { limit: 2 } });
  applyRouteLimits(app, limits);
  let checks = 0;
  app.post('/users/login', (req, res) => { checks++; res.status(req.body.password === 'valid' ? 200 : 401).json({}); });
  const request = await serve(t, app);
  async function login(username, password, ip) {
    return request('/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ username, password }) });
  }
  for (let i = 0; i < 3; i++) assert.equal((await login('angler', 'valid', '192.0.2.1')).status, 200);
  assert.equal((await login('angler', 'bad', '192.0.2.1')).status, 401);
  assert.equal((await login(' ANGLER ', 'bad', '192.0.2.2')).status, 401);
  assert.equal((await login('angler', 'valid', '192.0.2.3')).status, 429);
  assert.equal(checks, 5, 'blocked login must not reach password verification');
  assert.equal((await login('someone-else', 'valid', '192.0.2.3')).status, 200);
});

test('IP login, signup, photo/catch, and weather limits run before expensive handlers', async t => {
  const app = express();
  app.use(express.json());
  const limits = createRateLimiters(Object.fromEntries(['login-ip', 'signup', 'upload', 'weather'].map(name => [name, { limit: 1 }])));
  applyRouteLimits(app, limits);
  let handled = 0;
  app.use((req, res) => { handled++; res.json({}); });
  const request = await serve(t, app);
  for (const path of ['/users/login', '/users/signup', '/fishcatch', '/fishcatch/weather']) {
    assert.equal((await request(path, { method: 'POST' })).status, 200);
    assert.equal((await request(path, { method: 'POST' })).status, 429);
  }
  assert.equal((await request('/fishcatch/17/photo', { method: 'POST' })).status, 429, 'photo and catch creation share an upload budget');
  assert.equal(handled, 4);
});

test('proxy trust is off by default and accepts only explicit proxy networks', () => {
  assert.equal(readTrustedProxies({}), false);
  assert.deepEqual(readTrustedProxies({ TRUSTED_PROXIES: 'loopback,10.0.0.2/32' }), ['loopback', '10.0.0.2/32']);
  for (const value of ['true', '1', '0.0.0.0/0', '::/0', '10.0.0.2/33']) assert.throws(() => readTrustedProxies({ TRUSTED_PROXIES: value }));
});
