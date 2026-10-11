import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../../src/middleware/auth';

/**
 * What `authMiddleware` does with a system API token (issue #217).
 *
 * The behaviour being pinned down is the removal of `|| 1`. A token with no
 * linked user used to be promoted to user 1 -- whoever that happens to be on
 * the installation -- and from there through `adminMiddleware` if user 1 was an
 * administrator, which on most installations they are. It now fails.
 */

const verifyToken = vi.fn();
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

vi.mock('../../src/services/domain/token', async () => {
  const scopes = await import('../../src/services/domain/token/scopes');
  return { systemApiTokenService: { verifyToken }, ...scopes };
});

vi.mock('../../src/utils/system/logger', () => ({ logger: log }));

const fakeRes = () => {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
};

const call = async (token: string) => {
  const { authMiddleware } = await import('../../src/middleware/auth');
  const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
  const res = fakeRes();
  const next = vi.fn();
  await authMiddleware(req, res, next);
  return { req, res, next };
};

const validRow = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  admin_id: 7,
  token_hash: 'never-leaves-the-service',
  label: 'Uptime monitor',
  description: null,
  created_at: new Date(),
  expires_at: null,
  last_used_at: null,
  scopes: ['mcp:read'],
  token_prefix: 'ps_ab12cd34',
  ...overrides,
});

describe('authMiddleware with a system API token', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    delete process.env.ADMIN_API_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('puts the token scopes on the request', async () => {
    verifyToken.mockResolvedValue({ outcome: 'valid', token: validRow() });

    const { req, next } = await call('ps_ab12cd34abc');

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe(7);
    expect(req.isSystemToken).toBe(true);
    expect(req.tokenScopes).toEqual(['mcp:read']);
  });

  it('rejects a token that is not linked to a user instead of becoming user 1', async () => {
    verifyToken.mockResolvedValue({ outcome: 'unlinked', label: 'Ancient cron job' });

    const { req, res, next } = await call('ps_ab12cd34abc');

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(req.userId).toBeUndefined();
  });

  it('rejects an expired token with a clear answer', async () => {
    verifyToken.mockResolvedValue({ outcome: 'expired', label: 'Old token' });

    const { res, next } = await call('ps_ab12cd34abc');

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: 'Token expired' });
  });

  it('falls through to the JWT check when the value is not one of ours', async () => {
    verifyToken.mockResolvedValue({ outcome: 'no-match' });

    const { res, next } = await call('definitely-not-a-token');

    expect(next).not.toHaveBeenCalled();
    // Rejected as a bad JWT, which is what it is -- not a 500.
    expect(res.statusCode).toBe(401);
  });

  it('gives the emergency env token full access', async () => {
    process.env.ADMIN_API_TOKEN = 'bootstrap-value';

    const { req, next } = await call('bootstrap-value');

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.tokenScopes).toEqual(['*']);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('does not log the presented token', async () => {
    verifyToken.mockResolvedValue({ outcome: 'valid', token: validRow() });

    await call('ps_ab12cd34secret');

    const serialised = JSON.stringify([...log.info.mock.calls, ...log.warn.mock.calls]);
    expect(serialised).not.toContain('ps_ab12cd34secret');
  });
});
