const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const migration = require('../migrations/20261104000000-personal-bests');

// Use only a disposable database: this test creates and drops its own schema.
test('personal best migration backfills and maintains records across catch mutations', {
  skip: !process.env.PERSONAL_BEST_TEST_URL,
}, async () => {
  const schema = `pb_test_${process.pid}`;
  const db = new Sequelize(process.env.PERSONAL_BEST_TEST_URL, { logging: false,
    define: { schema }, dialectOptions: { options: `-c search_path=${schema}` } });
  try {
    await db.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};
      CREATE TABLE users (id integer PRIMARY KEY);
      INSERT INTO users VALUES (1), (2);
      CREATE TABLE fish_catches (id serial PRIMARY KEY, user_id integer, species_id integer,
        length real, deleted_at timestamptz);
      INSERT INTO fish_catches (user_id, species_id, length) VALUES (1,1,10),(1,1,20),(2,1,15),(1,2,0);`);
    const qi = db.getQueryInterface();
    const scoped = { sequelize: db,
      addColumn: (table, ...args) => qi.addColumn({ tableName: table, schema }, ...args),
      removeColumn: (table, ...args) => qi.removeColumn({ tableName: table, schema }, ...args) };
    await migration.up(scoped, Sequelize);
    const best = async () => (await db.query('SELECT id FROM fish_catches WHERE personal_best ORDER BY id'))[0].map(r => r.id);
    assert.deepEqual(await best(), [2,3]);
    await db.query('INSERT INTO fish_catches (user_id,species_id,length) VALUES (1,1,20)');
    assert.deepEqual(await best(), [2,3]);
    await db.query('INSERT INTO fish_catches (user_id,species_id,length) VALUES (1,1,25)');
    assert.deepEqual(await best(), [3,6]);
    await db.query('UPDATE fish_catches SET length=5 WHERE id=6');
    assert.deepEqual(await best(), [2,3]);
    await db.query('UPDATE fish_catches SET deleted_at=now() WHERE id=2');
    assert.deepEqual(await best(), [3,5]);
    await db.query('UPDATE fish_catches SET species_id=2 WHERE id=5');
    assert.deepEqual(await best(), [1,3,5]);
    await db.query('DELETE FROM fish_catches WHERE id=5');
    assert.deepEqual(await best(), [1,3]);
    await Promise.all([30,35,32].map(length => db.query('INSERT INTO fish_catches (user_id,species_id,length) VALUES (1,1,:length)', { replacements: { length } })));
    const [rows] = await db.query('SELECT length FROM fish_catches WHERE personal_best AND user_id=1');
    assert.deepEqual(rows.map(r => r.length), [35]);
    await migration.down(scoped);
  } finally {
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await db.close();
  }
});
