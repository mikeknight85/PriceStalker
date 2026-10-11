import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

/**
 * Verification of system API tokens (issue #217).
 *
 * Two behaviours are load-bearing here and neither is visible from the type
 * signature:
 *
 * 1. A token issued since migration 022 is found by its indexed prefix, so one
 *    bcrypt comparison runs instead of one per row in the table.
 * 2. A token issued before it has no recoverable prefix -- only the bcrypt hash
 *    was ever stored -- so it can only be found by comparing against every
 *    prefix-less row. That scan stays, deliberately, for the deprecation grace
 *    period the issue settled on, and it is restricted to exactly those rows.
 */

const repo = {
  create: vi.fn(),
  listAll: vi.fn(),
  findById: vi.fn(),
  deleteById: vi.fn(),
  findByTokenHash: vi.fn(),
  findByPrefix: vi.fn(),
  listWithoutPrefix: vi.fn(),
  updateLastUsed: vi.fn(),
};

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

vi.mock('../../src/models', () => ({
  systemApiTokenRepository: repo,
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: log,
}));

// Cost 4 rather than the production 10: these hashes are built on every run and
// bcrypt's whole point is to be slow.
const hashOf = (token: string) => bcrypt.hashSync(token, 4);

const MODERN_TOKEN = `ps_${'ab12cd34'}${'f'.repeat(56)}`;
const LEGACY_TOKEN = `ps_${'99887766'}${'e'.repeat(56)}`;

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  admin_id: 7,
  token_hash: hashOf(MODERN_TOKEN),
  label: 'Uptime monitor',
  description: null,
  created_at: new Date('2026-01-01'),
  expires_at: null,
  last_used_at: null,
  scopes: ['mcp:read'],
  token_prefix: 'ps_ab12cd34',
  ...overrides,
});

const legacyRow = (overrides: Record<string, unknown> = {}) => ({
  ...row({
    id: 2,
    label: 'Ancient cron job',
    token_hash: hashOf(LEGACY_TOKEN),
    scopes: ['*'],
    token_prefix: null,
  }),
  ...overrides,
});

const service = async () => (await import('../../src/services/domain/token')).systemApiTokenService;

describe('System API token verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findByPrefix.mockResolvedValue([]);
    repo.listWithoutPrefix.mockResolvedValue([]);
    repo.updateLastUsed.mockResolvedValue(undefined);
  });

  it('finds a modern token by its prefix without scanning', async () => {
    repo.findByPrefix.mockResolvedValue([row()]);

    const result = await (await service()).verifyToken(MODERN_TOKEN);

    expect(result.outcome).toBe('valid');
    expect(repo.findByPrefix).toHaveBeenCalledWith('ps_ab12cd34');
    // The whole point: the prefix hit means the legacy scan is never issued.
    expect(repo.listWithoutPrefix).not.toHaveBeenCalled();
    expect(repo.updateLastUsed).toHaveBeenCalledWith(1);
  });

  it('carries the row scopes through on success', async () => {
    repo.findByPrefix.mockResolvedValue([row({ scopes: ['admin:read', 'mcp:read'] })]);

    const result = await (await service()).verifyToken(MODERN_TOKEN);

    expect(result.outcome === 'valid' && result.token.scopes).toEqual(['admin:read', 'mcp:read']);
  });

  it('tries every candidate when two tokens share a prefix', async () => {
    // token_prefix carries no uniqueness constraint on purpose: a collision is
    // vanishingly unlikely, but a UNIQUE index would turn it into a failed
    // token creation instead of a second comparison.
    const other = row({ id: 9, token_hash: hashOf('ps_ab12cd34' + 'a'.repeat(56)) });
    repo.findByPrefix.mockResolvedValue([other, row()]);

    const result = await (await service()).verifyToken(MODERN_TOKEN);

    expect(result.outcome === 'valid' && result.token.id).toBe(1);
  });

  it('falls back to the scan for a token issued before the migration', async () => {
    repo.listWithoutPrefix.mockResolvedValue([legacyRow()]);

    const result = await (await service()).verifyToken(LEGACY_TOKEN);

    expect(result.outcome).toBe('valid');
    expect(result.outcome === 'valid' && result.token.id).toBe(2);
    // It still looks by prefix first -- the presented value is well formed, it
    // is the stored row that cannot be indexed.
    expect(repo.findByPrefix).toHaveBeenCalledWith('ps_99887766');
    expect(repo.listWithoutPrefix).toHaveBeenCalled();
  });

  it('keeps a legacy token working with full access, exactly as before', async () => {
    repo.listWithoutPrefix.mockResolvedValue([legacyRow()]);

    const result = await (await service()).verifyToken(LEGACY_TOKEN);

    expect(result.outcome === 'valid' && result.token.scopes).toEqual(['*']);
  });

  it('still authenticates a legacy token whose value predates the ps_ format', async () => {
    // Nothing guarantees a stored legacy secret looks like today's tokens, so
    // the scan has to be reachable for a value that carries no prefix at all.
    const oddball = 'legacy-token-without-a-prefix';
    repo.listWithoutPrefix.mockResolvedValue([legacyRow({ token_hash: hashOf(oddball) })]);

    const result = await (await service()).verifyToken(oddball);

    expect(result.outcome).toBe('valid');
    expect(repo.findByPrefix).not.toHaveBeenCalled();
  });

  it('logs the deprecation warning exactly once, with no credential in it', async () => {
    repo.listWithoutPrefix.mockResolvedValue([legacyRow()]);

    await (await service()).verifyToken(LEGACY_TOKEN);

    const deprecations = log.warn.mock.calls.filter(([message]: [string]) =>
      String(message).includes('Deprecated system API token')
    );
    expect(deprecations).toHaveLength(1);

    const serialised = JSON.stringify(log.warn.mock.calls) + JSON.stringify(log.info.mock.calls);
    expect(serialised).not.toContain(LEGACY_TOKEN);
    expect(serialised).not.toContain(legacyRow().token_hash);
    // The label is what makes the warning actionable.
    expect(deprecations[0][0]).toContain('Ancient cron job');
  });

  it('does not warn about deprecation for a modern token', async () => {
    repo.findByPrefix.mockResolvedValue([row()]);

    await (await service()).verifyToken(MODERN_TOKEN);

    expect(
      log.warn.mock.calls.filter(([m]: [string]) => String(m).includes('Deprecated'))
    ).toHaveLength(0);
  });

  it('rejects an expired token before anything considers its scopes', async () => {
    repo.findByPrefix.mockResolvedValue([row({ expires_at: new Date('2020-01-01') })]);

    const result = await (await service()).verifyToken(MODERN_TOKEN);

    expect(result.outcome).toBe('expired');
    expect(repo.updateLastUsed).not.toHaveBeenCalled();
  });

  it('rejects a token that is not linked to a user instead of acting as user 1', async () => {
    // This replaces `req.userId = sysToken.admin_id || 1`. A token that names
    // nobody used to silently become whoever user 1 is on the installation.
    repo.findByPrefix.mockResolvedValue([row({ admin_id: null })]);

    const result = await (await service()).verifyToken(MODERN_TOKEN);

    expect(result.outcome).toBe('unlinked');
    expect(repo.updateLastUsed).not.toHaveBeenCalled();
    expect(
      log.warn.mock.calls.some(([m]: [string]) => String(m).includes('not linked to a user'))
    ).toBe(true);
  });

  it('reports no match for an unknown token', async () => {
    const result = await (await service()).verifyToken(`ps_00000000${'0'.repeat(56)}`);
    expect(result.outcome).toBe('no-match');
  });

  it('never scans rows that have a prefix, even for a value that matches nothing', async () => {
    // The CPU-exhaustion vector was that every presented value cost one bcrypt
    // per token in the table. The only set the scan may touch is the one that
    // cannot be indexed.
    await (await service()).verifyToken('not-a-pricestalker-token');

    expect(repo.listAll).not.toHaveBeenCalled();
    expect(repo.listWithoutPrefix).toHaveBeenCalledTimes(1);
  });
});

describe('System API token creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.create.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 42,
      ...row(),
      ...data,
    }));
  });

  it('stores a prefix that matches the token it hands back', async () => {
    const { token, systemToken } = await (await service()).createSystemToken({
      label: 'New integration',
      admin_id: 7,
      scopes: ['mcp:read'],
    });

    const stored = repo.create.mock.calls[0][0];
    expect(stored.token_prefix).toBe(token.slice(0, 11));
    expect(stored.token_prefix).toMatch(/^ps_[0-9a-f]{8}$/);
    expect(stored.scopes).toEqual(['mcp:read']);
    // The hash must never leave the service.
    expect(systemToken).not.toHaveProperty('token_hash');
  });

  it('verifies the token it just issued through the fast path', async () => {
    const svc = await service();
    const { token } = await svc.createSystemToken({
      label: 'Round trip',
      admin_id: 7,
      scopes: ['mcp:read'],
    });
    const stored = repo.create.mock.calls[0][0];

    repo.findByPrefix.mockResolvedValue([row({ ...stored, id: 42 })]);
    repo.listWithoutPrefix.mockResolvedValue([]);

    const result = await svc.verifyToken(token);

    expect(result.outcome).toBe('valid');
    expect(repo.listWithoutPrefix).not.toHaveBeenCalled();
  });

  it('warns when a token is minted with full access', async () => {
    await (await service()).createSystemToken({
      label: 'Legacy shape',
      admin_id: 7,
      scopes: ['*'],
    });

    expect(
      log.warn.mock.calls.some(([m]: [string]) => String(m).includes('full access'))
    ).toBe(true);
  });

  it('does not log the token it generated', async () => {
    const { token } = await (await service()).createSystemToken({
      label: 'Quiet',
      admin_id: 7,
      scopes: ['mcp:read'],
    });

    const serialised = JSON.stringify([...log.info.mock.calls, ...log.warn.mock.calls]);
    expect(serialised).not.toContain(token);
  });
});
