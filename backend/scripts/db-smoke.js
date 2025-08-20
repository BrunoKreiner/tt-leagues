#!/usr/bin/env node
/*
 DB mode smoke test
 - Without DATABASE_URL: verify SQLite can read/write
 - With DATABASE_URL: connect and run SELECT 1 on Postgres
*/

require('dotenv').config();

(async () => {
  const database = require('../src/models/database');

  const isPg = !!process.env.DATABASE_URL;
  const mode = isPg ? 'Postgres' : 'SQLite';
  console.log(`DB Smoke Test starting in ${mode} mode...`);

  try {
    // Connect using existing abstraction (adds sslmode=require for PG)
    await database.connect();

    if (isPg) {
      // Simple connectivity check
      const row = await database.get('SELECT 1 as one');
      if (!row || (!row.one && row.one !== 1)) {
        throw new Error('Postgres SELECT 1 did not return expected result');
      }
      console.log('Postgres connectivity OK (SELECT 1).');
    } else {
      // Read/write check on SQLite
      await database.run('CREATE TABLE IF NOT EXISTS smoke_test (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT)');
      await database.run('INSERT INTO smoke_test (value) VALUES (?)', ['ok']);
      const row = await database.get('SELECT value FROM smoke_test ORDER BY id DESC LIMIT 1');
      if (!row || row.value !== 'ok') {
        throw new Error('SQLite read/write verification failed');
      }
      console.log('SQLite read/write OK.');
      // Cleanup
      await database.run('DROP TABLE IF EXISTS smoke_test');
    }

    // Close DB if applicable
    try { await database.close(); } catch (_) {}

    console.log('DB Smoke Test: PASS');
    process.exit(0);
  } catch (err) {
    console.error('DB Smoke Test: FAIL');
    console.error(err?.stack || err);
    process.exit(1);
  }
})();
