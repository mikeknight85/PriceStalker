import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The version shown in the user menu. It decorates a menu, so nothing here may
 * throw, and it is read during an incident, so it must not quietly lie.
 */

const original = process.env.APP_VERSION;

async function load() {
  vi.resetModules();
  return import('../../src/utils/system/app-version');
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  if (original === undefined) delete process.env.APP_VERSION;
  else process.env.APP_VERSION = original;
  vi.restoreAllMocks();
});

describe('APP_VERSION', () => {
  it("reports the backend package's own version", async () => {
    delete process.env.APP_VERSION;
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    const { APP_VERSION } = await load();
    expect(APP_VERSION).toBe(pkg.version);
  });

  it('does not fall back to the placeholder when a real version exists', async () => {
    delete process.env.APP_VERSION;
    const { APP_VERSION } = await load();
    expect(APP_VERSION).not.toBe('unknown');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('lets an explicit override win, for images built differently', async () => {
    process.env.APP_VERSION = '9.9.9-custom';
    expect((await load()).APP_VERSION).toBe('9.9.9-custom');
  });

  it('ignores a blank override rather than reporting an empty version', async () => {
    process.env.APP_VERSION = '   ';
    expect((await load()).APP_VERSION).not.toBe('');
    expect((await load()).APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('says "unknown" rather than throwing when the file cannot be read', async () => {
    // A version banner is not worth failing startup over.
    delete process.env.APP_VERSION;
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('EACCES'); });
    expect((await load()).APP_VERSION).toBe('unknown');
  });

  it('says "unknown" rather than throwing on malformed JSON', async () => {
    delete process.env.APP_VERSION;
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{ not json' as any);
    expect((await load()).APP_VERSION).toBe('unknown');
  });

  it('does not depend on the working directory', async () => {
    // Resolved by walking up from the module, not from process.cwd(): a version
    // reading "unknown" because the process was started from elsewhere is the
    // kind of small lie that wastes an afternoon during an incident.
    delete process.env.APP_VERSION;
    const cwd = process.cwd();
    try {
      process.chdir('/');
      expect((await load()).APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    } finally {
      process.chdir(cwd);
    }
  });
});
