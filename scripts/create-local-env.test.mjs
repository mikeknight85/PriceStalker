import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { configureLocalEnvironment } from './create-local-env.mjs';

const temporaryDirectories = [];

function createTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'pricestalker-dev-env-'));
  temporaryDirectories.push(directory);
  return directory;
}

function readEnvironment(directory) {
  return Object.fromEntries(
    readFileSync(join(directory, '.env'), 'utf8')
      .split('\n')
      .flatMap((line) => {
        const separator = line.indexOf('=');
        return separator === -1 ? [] : [[line.slice(0, separator), line.slice(separator + 1)]];
      }),
  );
}

test.after(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
});

test('creates complete, private local development configuration', () => {
  const directory = createTemporaryDirectory();
  const result = configureLocalEnvironment({ directory, requestedPort: '55432' });
  const environment = readEnvironment(directory);
  const databaseUrl = new URL(environment.DATABASE_URL);

  assert.deepEqual(result.changedKeys, [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'JWT_SECRET',
    'DATABASE_URL',
    'LOCAL_POSTGRES_PORT',
  ]);
  assert.equal(environment.POSTGRES_USER, 'postgres');
  assert.match(environment.POSTGRES_PASSWORD, /^[a-f0-9]{64}$/);
  assert.match(environment.JWT_SECRET, /^[a-f0-9]{96}$/);
  assert.equal(environment.LOCAL_POSTGRES_PORT, '55432');
  assert.equal(databaseUrl.username, environment.POSTGRES_USER);
  assert.equal(databaseUrl.password, environment.POSTGRES_PASSWORD);
  assert.equal(databaseUrl.port, environment.LOCAL_POSTGRES_PORT);
  assert.equal(statSync(join(directory, '.env')).mode & 0o077, 0);
});

test('preserves configured values and adds only missing values', () => {
  const directory = createTemporaryDirectory();
  const configuredUrl = 'postgresql://remote-user:remote-password@db.example.com:5432/tracker';
  writeFileSync(join(directory, '.env'), `POSTGRES_PASSWORD=preserved-password\nJWT_SECRET=preserved-jwt\nDATABASE_URL=${configuredUrl}\n`);

  const result = configureLocalEnvironment({ directory });
  const environment = readEnvironment(directory);

  assert.deepEqual(result.changedKeys, ['POSTGRES_USER', 'POSTGRES_DB', 'LOCAL_POSTGRES_PORT']);
  assert.equal(environment.POSTGRES_PASSWORD, 'preserved-password');
  assert.equal(environment.JWT_SECRET, 'preserved-jwt');
  assert.equal(environment.DATABASE_URL, configuredUrl);
  assert.equal(environment.POSTGRES_USER, 'postgres');
  assert.equal(environment.POSTGRES_DB, 'priceghost');
});

test('replaces placeholders and builds a matching local database URL', () => {
  const directory = createTemporaryDirectory();
  writeFileSync(join(directory, '.env'), 'POSTGRES_PASSWORD=replace-with-a-strong-password\nJWT_SECRET=replace-with-a-long-random-string\n');

  configureLocalEnvironment({ directory });
  const environment = readEnvironment(directory);
  const databaseUrl = new URL(environment.DATABASE_URL);

  assert.notEqual(environment.POSTGRES_PASSWORD, 'replace-with-a-strong-password');
  assert.notEqual(environment.JWT_SECRET, 'replace-with-a-long-random-string');
  assert.equal(databaseUrl.password, environment.POSTGRES_PASSWORD);
  assert.equal(databaseUrl.hostname, '127.0.0.1');
});

test('rejects an invalid local PostgreSQL port', () => {
  assert.throws(
    () => configureLocalEnvironment({ directory: createTemporaryDirectory(), requestedPort: '70000' }),
    /LOCAL_POSTGRES_PORT must be a number from 1 to 65535/,
  );
});
