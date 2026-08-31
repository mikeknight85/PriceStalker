import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The level hierarchy is easy to break silently: nothing throws when a sink
 * quietly starts swallowing or storing everything, and the symptom (an empty
 * event log, or a bloated one) only shows up in production. These cases pin
 * down which of the three sinks accepts which level.
 */

const LOG_ENV = ['LOG_LEVEL', 'CONSOLE_LOG_LEVEL', 'FILE_LOG_LEVEL', 'DB_LOG_LEVEL', 'DEBUG'] as const;

const saveToDb = vi.fn();

vi.mock('../../src/utils/system/logging/persistence', () => ({
  saveToDb: (...args: unknown[]) => {
    saveToDb(...args);
    return Promise.resolve();
  },
  initLoggerPersistence: () => {},
}));

// The printer appends to real files; keep the suite off the disk.
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: { ...actual, existsSync: () => true, mkdirSync: () => undefined, appendFileSync: () => undefined },
    existsSync: () => true,
    mkdirSync: () => undefined,
    appendFileSync: () => undefined,
  };
});

async function freshLogger() {
  vi.resetModules();
  return await import('../../src/utils/system/logging/logger');
}

/** Levels that reached the database for a given environment. */
async function persistedLevels(env: Partial<Record<(typeof LOG_ENV)[number], string>>, context?: string) {
  for (const key of LOG_ENV) delete process.env[key];
  Object.assign(process.env, env);

  saveToDb.mockClear();
  const { logger } = await freshLogger();

  logger.debug('debug message', context);
  logger.info('info message', context);
  logger.warn('warn message', context);
  logger.error('error message', context);

  return saveToDb.mock.calls.map((call) => call[0] as string);
}

describe('Log level hierarchy', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  describe('database persistence respects the configured threshold', () => {
    it('stores INFO and above by default', async () => {
      expect(await persistedLevels({})).toEqual(['INFO', 'WARN', 'ERROR']);
    });

    it('stores only ERROR when LOG_LEVEL is error', async () => {
      // The bug this replaces: INFO was written unconditionally, so a user who
      // set LOG_LEVEL=error still had their event log filled with INFO rows.
      expect(await persistedLevels({ LOG_LEVEL: 'error' })).toEqual(['ERROR']);
    });

    it('stores WARN and above when LOG_LEVEL is warn', async () => {
      expect(await persistedLevels({ LOG_LEVEL: 'warn' })).toEqual(['WARN', 'ERROR']);
    });

    it('stores DEBUG when the level allows it', async () => {
      // Previously DEBUG could never reach the database at any setting.
      expect(await persistedLevels({ LOG_LEVEL: 'debug' })).toEqual([
        'DEBUG',
        'INFO',
        'WARN',
        'ERROR',
      ]);
    });

    it('accepts a lowercase level', async () => {
      expect(await persistedLevels({ LOG_LEVEL: 'ERROR' })).toEqual(['ERROR']);
    });
  });

  describe('DB_LOG_LEVEL overrides the global level for the database only', () => {
    it('can keep the database quiet while the console stays verbose', async () => {
      expect(await persistedLevels({ LOG_LEVEL: 'debug', DB_LOG_LEVEL: 'error' })).toEqual(['ERROR']);
    });

    it('can store debug traces without flooding the console', async () => {
      expect(await persistedLevels({ LOG_LEVEL: 'warn', DB_LOG_LEVEL: 'debug' })).toEqual([
        'DEBUG',
        'INFO',
        'WARN',
        'ERROR',
      ]);
    });
  });

  describe('high-volume contexts', () => {
    it('drops routine HTTP, Database and Scheduler chatter', async () => {
      for (const context of ['HTTP', 'Database', 'Scheduler']) {
        expect(await persistedLevels({ LOG_LEVEL: 'debug' }, context)).toEqual(['WARN', 'ERROR']);
      }
    });

    it('still stores problems from those contexts', async () => {
      // An HTTP 500 is exactly what an administrator opens the event log to find.
      expect(await persistedLevels({ LOG_LEVEL: 'error' }, 'HTTP')).toEqual(['ERROR']);
    });

    it('stores every level for an ordinary context', async () => {
      expect(await persistedLevels({ LOG_LEVEL: 'debug' }, 'Scraper')).toEqual([
        'DEBUG',
        'INFO',
        'WARN',
        'ERROR',
      ]);
    });
  });

  describe('isLevelEnabled', () => {
    it('is true when any single sink asks for the level', async () => {
      for (const key of LOG_ENV) delete process.env[key];
      process.env.LOG_LEVEL = 'error';
      process.env.CONSOLE_LOG_LEVEL = 'debug';

      vi.resetModules();
      const { isLevelEnabled } = await import('../../src/utils/system/logging/printer');

      // The old guard checked the global level alone, so a console-only debug
      // override produced no debug output anywhere.
      expect(isLevelEnabled('DEBUG')).toBe(true);
    });

    it('is false when no sink asks for the level', async () => {
      for (const key of LOG_ENV) delete process.env[key];
      process.env.LOG_LEVEL = 'info';

      vi.resetModules();
      const { isLevelEnabled } = await import('../../src/utils/system/logging/printer');

      expect(isLevelEnabled('DEBUG')).toBe(false);
      expect(isLevelEnabled('INFO')).toBe(true);
    });
  });
});
