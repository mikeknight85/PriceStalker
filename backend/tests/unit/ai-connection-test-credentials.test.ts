import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { systemSettingsRepository } from '../../src/models';
import type { AISettings } from '../../src/models/types';

/**
 * Which credential a connection test actually uses (issues #196, #198).
 *
 * The admin UI is handed a masked key when REDACT_API_KEYS=true and posts that
 * masked string back when someone presses Test Connection, so the endpoint has
 * to recognise the placeholder and resolve the stored key behind it. It must
 * not go further than that: a request with no key at all is still a 400, not a
 * silent test of whatever happens to be saved.
 */

vi.mock('../../src/models', () => ({
  systemSettingsRepository: {
    getAISettings: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    getAll: vi.fn(),
  },
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const testGeminiConnection = vi.fn();
vi.mock('../../src/services/ai', () => ({
  testGeminiConnection: (...args: unknown[]) => testGeminiConnection(...args),
}));

const repo = vi.mocked(systemSettingsRepository);

/**
 * Stores only the fields a test cares about. `Partial<AISettings>` still checks
 * every field name and type, and the widening happens once here at the mock
 * boundary rather than at every call site.
 */
function storedSettings(fields: Partial<AISettings>): AISettings {
  return fields as AISettings;
}

const testsRouter = (await import('../../src/routes/admin/settings/ai/tests')).default;

const app = express();
app.use(express.json());
app.use('/api/admin/settings/ai', testsRouter);
const server = app.listen(0);
const { port } = server.address() as AddressInfo;

afterAll(() => {
  server.close();
});

async function postGeminiTest(body: Record<string, unknown>) {
  const response = await fetch(`http://127.0.0.1:${port}/api/admin/settings/ai/test-gemini`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

describe('AI connection test credential resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testGeminiConnection.mockResolvedValue('pong');
  });

  it('resolves the stored key when the UI posts back the masked one', async () => {
    repo.getAISettings.mockResolvedValue(storedSettings({ gemini_api_key: 'AIzaReallyStoredKey' }));

    const result = await postGeminiTest({ api_key: 'AIza...dKey', model: 'gemini-2.5-flash' });

    expect(result.status).toBe(200);
    expect(testGeminiConnection).toHaveBeenCalledWith('AIzaReallyStoredKey', 'gemini-2.5-flash');
  });

  it('resolves a key masked wholesale, not only the ellipsis form', async () => {
    repo.getAISettings.mockResolvedValue(storedSettings({ gemini_api_key: 'AIzaReallyStoredKey' }));

    const result = await postGeminiTest({ api_key: '********' });

    expect(result.status).toBe(200);
    expect(testGeminiConnection).toHaveBeenCalledWith('AIzaReallyStoredKey', undefined);
  });

  it('passes an unmasked key through untouched, without reading settings', async () => {
    const result = await postGeminiTest({ api_key: 'AIzaTypedInFreshly' });

    expect(result.status).toBe(200);
    expect(testGeminiConnection).toHaveBeenCalledWith('AIzaTypedInFreshly', undefined);
    expect(repo.getAISettings).not.toHaveBeenCalled();
  });

  it('still answers 400 when no key is supplied at all', async () => {
    // Deliberate: an empty field means "no credential", not "use the saved
    // one". Treating the two the same would turn a cleared field into a test of
    // a key the caller never named, and report success for a provider they
    // believe they have just unconfigured.
    repo.getAISettings.mockResolvedValue(storedSettings({ gemini_api_key: 'AIzaReallyStoredKey' }));

    const result = await postGeminiTest({});

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: 'API key is required' });
    expect(testGeminiConnection).not.toHaveBeenCalled();
  });

  it('answers 400 when the key is masked and nothing is stored', async () => {
    repo.getAISettings.mockResolvedValue(storedSettings({ gemini_api_key: null }));

    const result = await postGeminiTest({ api_key: 'AIza...dKey' });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: 'API key is required' });
    expect(testGeminiConnection).not.toHaveBeenCalled();
  });
});
