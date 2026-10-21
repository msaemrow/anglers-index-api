const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { isEligible, eligibilityIssues, markIneligible, DENIAL_REASONS } = require('../services/masterAnglerReview');
const fish = { id: 42, user_id: 7, length: 20, witness: 'Jane', fish_image: 'catches/11111111-1111-4111-8111-111111111111.jpg', species: { master_angler_length: 20 } };
test('eligibility requires length, a genuine witness entry, and a non-placeholder photo', () => {
  assert.equal(isEligible(fish), true);
  for (const patch of [{ length: 19.9 }, { length: null }, { witness: ' NA ' }, { witness: '' }, { witness: 'n/a' }, { fish_image: '/static/images/stock-fish.jpg' }, { fish_image: '' }, { fish_image: 'https://example.com/photo.jpg' }, { fish_image: '/photos/fish.jpg' }, { fish_image: 'javascript:alert(1)' }, { species: { master_angler_length: 0 } }])
    assert.equal(isEligible({ ...fish, ...patch }), false);
});
function setup({ status = 'pending', eligible = true, missing = false } = {}) {
  let saved;
  let catchUpdate;
  const entry = { catch_id: 42, status, update: async data => { saved = data; return entry; } };
  const models = {
    sequelize: { transaction: async fn => fn({ LOCK: { UPDATE: 'UPDATE' } }) },
    MasterAngler: { findByPk: async () => missing ? null : entry },
    FishCatch: { findByPk: async () => ({ ...fish, length: eligible ? 20 : 1, update: async data => { catchUpdate = data; } }) },
  };
  const context = { exports: {}, process: { env: {} }, require: name => {
    if (name === '../helpers/errors') return require('../helpers/errors');
    if (name === '../models') return models;
    if (name === '../services/masterAnglerReview') return { isEligible, eligibilityIssues, markIneligible, DENIAL_REASONS };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/masterAnglerController'), 'utf8'), context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
  return { res, saved: () => saved, catchUpdate: () => catchUpdate, run: body => context.exports.updateMasterAnglerSubmission({ params: { id: 1 }, user: { id: 99 }, body }, res) };
}
test('approval records reviewer and clears denial reason', async () => {
  const ctx = setup(); await ctx.run({ status: 'approved', denial_reason: 'ignored' });
  assert.equal(ctx.res.statusCode, 200); assert.equal(ctx.saved().status, 'approved');
  assert.equal(ctx.catchUpdate().master_angler, true);
  assert.equal(ctx.saved().reviewed_by, 99); assert.equal(ctx.saved().denial_reason, null);
});
test('denial requires a predefined reason and stores it', async () => {
  for (const reason of [undefined, 'arbitrary']) {
    const ctx = setup(); await ctx.run({ status: 'denied', denial_reason: reason });
    assert.equal(ctx.res.statusCode, 400); assert.equal(ctx.saved(), undefined);
  }
  const ctx = setup(); await ctx.run({ status: 'denied', denial_reason: DENIAL_REASONS[0] });
  assert.equal(ctx.saved().denial_reason, DENIAL_REASONS[0]);
  assert.equal(ctx.catchUpdate().master_angler, false);
});
test('stale, missing, or ineligible catches cannot be reviewed', async () => {
  for (const [options, code] of [[{ status: 'approved' }, 409], [{ eligible: false }, 409], [{ missing: true }, 404]]) {
    const ctx = setup(options); await ctx.run({ status: 'approved' });
    assert.equal(ctx.res.statusCode, code);
    assert.equal(ctx.saved()?.status, options.eligible === false ? 'not_eligible' : undefined);
  }
});
test('queue and decision routes require authenticated admins', () => {
  const registrations = [];
  const router = { post() {}, get: (...args) => registrations.push(args), patch: (...args) => registrations.push(args) };
  const auth = { addUserToReq() {}, loginRequired() {}, adminRequired() {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../routes/masterAnglerRoutes'), 'utf8'), {
    module: { exports: {} }, require: name => name === '../helpers/errors' ? require('../helpers/errors') : name === 'express' ? { Router: () => router } : name === 'multer' ? () => ({ single() {} }) : name.includes('authMiddleware') ? auth : {},
  });
  for (const route of registrations) assert.deepEqual(route.slice(1, 4), [auth.addUserToReq, auth.loginRequired, auth.adminRequired]);
});

test('denied catches lose both eligibility and award flags even with a stale legacy flag', () => {
  const { awardFields } = require('../services/masterAnglerReview');
  for (const status of ['pending', 'approved', 'denied']) {
    const result = awardFields({ master_angler: true }, { status });
    assert.equal(result.master_angler, status === 'approved');
    assert.equal(result.approved_master_angler, status === 'approved');
    assert.equal(result.eligible_master_angler, status === 'pending');
  }
});

test('saving a denied catch preserves its decision and never requeues it', async () => {
  let created = false;
  let deleted = false;
  let saved = false;
  const context = { module: { exports: {} }, require: name => name === '../helpers/errors' ? require('../helpers/errors') : name === './catchPhotos' ? require('../services/catchPhotos') : ({
    MasterAngler: {
      findOne: async () => ({ status: 'denied', denial_reason: DENIAL_REASONS[0] }),
      destroy: async () => { deleted = true; },
      create: async () => { created = true; },
    },
  }) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../services/masterAnglerReview'), 'utf8'), context);
  const catchData = { ...fish, master_angler: true, save: async () => { saved = true; } };
  await context.module.exports.syncSubmission(catchData, {});
  assert.equal(catchData.master_angler, false);
  assert.equal(saved, true);
  assert.equal(created, false);
  assert.equal(deleted, false);
});

function syncSetup(previousStatus, overrides = {}) {
  let created;
  let updated;
  let archived = false;
  const previous = previousStatus ? {
    id: 1, status: previousStatus,
    update: async data => { updated = data; return { id: 1, ...data }; },
    destroy: async () => { archived = true; },
  } : null;
  const context = { module: { exports: {} }, require: name => name === '../helpers/errors' ? require('../helpers/errors') : name === './catchPhotos' ? require('../services/catchPhotos') : ({
    MasterAngler: {
      findOne: async () => previous,
      create: async data => { created = data; return { id: 2, ...data }; },
    },
    Species: { findByPk: async () => fish.species },
  }) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../services/masterAnglerReview'), 'utf8'), context);
  const catchData = { ...fish, ...overrides, save: async () => {} };
  return {
    run: options => context.module.exports.syncSubmission(catchData, {}, options),
    data: () => ({ created, updated, archived, catchData }),
  };
}
test('eligible new catches are pending and missing criteria produce not_eligible', async () => {
  for (const [patch, status] of [[{}, 'pending'], [{ witness: 'NA' }, 'not_eligible'], [{ length: 19 }, 'not_eligible'], [{ fish_image: 'www.google.com' }, 'not_eligible']]) {
    const ctx = syncSetup(null, patch);
    const review = await ctx.run();
    assert.equal(review.status, status);
    assert.equal(ctx.data().catchData.master_angler, false);
  }
});
test('adding and removing evidence moves the same submission between eligibility states', async () => {
  const eligible = syncSetup('not_eligible');
  assert.equal((await eligible.run()).status, 'pending');
  assert.equal(eligible.data().created, undefined);
  const incomplete = syncSetup('pending', { witness: '' });
  assert.equal((await incomplete.run()).status, 'not_eligible');
  assert.equal(incomplete.data().archived, false);
});
test('an approved catch edit requires a fresh review while reconciliation preserves approval', async () => {
  const edit = syncSetup('approved');
  assert.equal((await edit.run()).status, 'pending');
  assert.equal(edit.data().archived, true);
  const reconcile = syncSetup('approved');
  assert.equal((await reconcile.run({ preserveApproval: true })).status, 'approved');
  assert.equal(reconcile.data().catchData.master_angler, true);
  assert.equal(reconcile.data().updated, undefined);
});
test('serialized catch status matches the persisted review without applying read-time eligibility filters', () => {
  const { serializeAward } = require('../services/masterAnglerReview');
  for (const status of ['not_eligible', 'pending', 'approved', 'denied']) {
    const result = serializeAward({ toJSON: () => ({ id: 1, masterAnglerEntries: [{ status }] }) });
    assert.equal(result.master_angler_status, status);
    assert.equal(result.eligible_master_angler, status === 'pending');
    assert.equal(result.approved_master_angler, status === 'approved');
    assert.equal(result.masterAnglerEntries, undefined);
  }
});

test('ineligible pending catches are automatically removed instead of denied', async () => {
  const ctx = setup({ eligible: false });
  await ctx.run({ status: 'denied', denial_reason: DENIAL_REASONS[0] });
  assert.equal(ctx.res.statusCode, 409);
  assert.equal(ctx.saved().status, 'not_eligible');
  assert.equal(ctx.saved().reviewed, false);
  assert.equal(ctx.catchUpdate().master_angler, false);
});
test('approval errors explain the failing requirement without recording a decision', async () => {
  const ctx = setup({ eligible: false });
  await ctx.run({ status: 'approved' });
  assert.equal(ctx.res.statusCode, 409);
  assert.match(ctx.res.body.error, /at least 20 inches/);
  assert.equal(ctx.saved().status, 'not_eligible');
  assert.equal(ctx.catchUpdate().master_angler, false);
});
test('eligibility explains legacy photos and missing witness evidence', () => {
  assert.deepEqual(eligibilityIssues(fish), []);
  const issues = eligibilityIssues({ ...fish, witness: 'NA', fish_image: '/photos/old.jpg' });
  assert.ok(issues.some(issue => /witness/.test(issue)));
  assert.ok(issues.some(issue => /Upload a catch photo/.test(issue)));
});

test('queue reconciliation persists ineligibility and rechecks locked data without changing completed decisions', async () => {
  for (const scenario of ['stale', 'eligible', 'fixed', 'approved', 'denied']) {
    const writes = [];
    let transactions = 0;
    const candidate = { id: 3, catch_id: fish.id, catch: { ...fish, length: scenario === 'eligible' ? 20 : 1 } };
    const lockedFish = { ...fish, length: scenario === 'fixed' ? 20 : 1,
      update: async data => writes.push(['fish', data]) };
    const submission = { status: ['approved', 'denied'].includes(scenario) ? scenario : 'pending',
      update: async data => writes.push(['submission', data]) };
    const models = {
      MasterAngler: {
        findAll: async options => { assert.equal(options.where.status, 'pending'); assert.equal(options.where.user_id, 7); return [candidate]; },
        findByPk: async () => submission,
      },
      FishCatch: { findByPk: async () => lockedFish },
      sequelize: { transaction: async fn => { transactions++; return fn({ LOCK: { UPDATE: 'UPDATE' } }); } },
    };
    const context = { module: { exports: {} }, require: name => name === '../helpers/errors' ? require('../helpers/errors') : name === '../models' ? models : require('../services/catchPhotos') };
    vm.runInNewContext(fs.readFileSync(require.resolve('../services/masterAnglerReview'), 'utf8'), context);
    await context.module.exports.reconcilePendingSubmissions({ userId: 7 });
    assert.equal(transactions, scenario === 'eligible' ? 0 : 1);
    assert.equal(writes.length, scenario === 'stale' ? 2 : 0);
    if (scenario === 'stale') {
      assert.equal(writes[0][1].master_angler, false);
      assert.equal(writes[1][1].status, 'not_eligible');
      assert.equal(writes[1][1].reviewed, false);
      assert.equal(writes[1][1].reviewed_by, null);
    }
  }
});
