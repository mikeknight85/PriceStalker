import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../../src/middleware/auth';

/**
 * Scope matching and the `requireScope` middleware (issue #217).
 *
 * The rule that matters most is the one that is easiest to break by accident:
 * scopes constrain *system tokens only*. A signed-in person holds no scopes,
 * and enforcing them on a browser session would lock every user out of the
 * application while looking like a tightening of security.
 */

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

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

const fakeReq = (overrides: Partial<AuthRequest> = {}): AuthRequest =>
  ({
    method: 'GET',
    originalUrl: '/api/admin/logs',
    userId: 7,
    ...overrides,
  }) as AuthRequest;

describe('scopesSatisfy', () => {
  it("treats '*' as satisfying everything, which is what keeps legacy tokens working", async () => {
    const { scopesSatisfy, SCOPE_ADMIN_SYSTEM, SCOPE_MCP_READ } = await import(
      '../../src/services/domain/token/scopes'
    );

    expect(scopesSatisfy(['*'], [SCOPE_ADMIN_SYSTEM])).toBe(true);
    expect(scopesSatisfy(['*'], [SCOPE_MCP_READ])).toBe(true);
  });

  it('matches exactly, and accepts any one of several required scopes', async () => {
    const { scopesSatisfy, SCOPE_ADMIN_READ, SCOPE_MCP_READ, SCOPE_ADMIN_WRITE } = await import(
      '../../src/services/domain/token/scopes'
    );

    expect(scopesSatisfy([SCOPE_MCP_READ], [SCOPE_ADMIN_READ, SCOPE_MCP_READ])).toBe(true);
    expect(scopesSatisfy([SCOPE_MCP_READ], [SCOPE_ADMIN_WRITE])).toBe(false);
  });

  it('does not expand a namespace', async () => {
    // `admin:*` is deliberately not a grant: a wildcard that grows as the
    // vocabulary grows hands a token privileges nobody consented to.
    const { scopesSatisfy, SCOPE_ADMIN_SYSTEM } = await import(
      '../../src/services/domain/token/scopes'
    );

    expect(scopesSatisfy(['admin:*'], [SCOPE_ADMIN_SYSTEM])).toBe(false);
  });

  it('grants nothing for an empty, missing or unrecognised scope list', async () => {
    const { scopesSatisfy, SCOPE_MCP_READ } = await import(
      '../../src/services/domain/token/scopes'
    );

    expect(scopesSatisfy([], [SCOPE_MCP_READ])).toBe(false);
    expect(scopesSatisfy(undefined, [SCOPE_MCP_READ])).toBe(false);
    expect(scopesSatisfy(['typo:read'], [SCOPE_MCP_READ])).toBe(false);
  });
});

describe('parseScopes', () => {
  it('accepts the vocabulary and de-duplicates', async () => {
    const { parseScopes } = await import('../../src/services/domain/token/scopes');
    expect(parseScopes(['mcp:read', 'mcp:read', 'admin:read'])).toEqual(['mcp:read', 'admin:read']);
  });

  it('rejects an unknown scope rather than silently dropping it', async () => {
    const { parseScopes } = await import('../../src/services/domain/token/scopes');
    expect(() => parseScopes(['mcp:reed'])).toThrow(/Unknown token scope/);
  });

  it('rejects an empty list and a non-list', async () => {
    const { parseScopes } = await import('../../src/services/domain/token/scopes');
    expect(() => parseScopes([])).toThrow(/At least one scope/);
    expect(() => parseScopes('mcp:read')).toThrow(/must be an array/);
  });

  it('answers 400, not 500, when a route lets it escape', async () => {
    const { parseScopes, InvalidTokenScopeError } = await import(
      '../../src/services/domain/token/scopes'
    );
    try {
      parseScopes(['nope']);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTokenScopeError);
      expect((error as InstanceType<typeof InvalidTokenScopeError>).statusCode).toBe(400);
    }
  });
});

describe('requireScope', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets a token through when it holds the required scope', async () => {
    const { requireScope } = await import('../../src/middleware/scope');
    const { SCOPE_ADMIN_READ } = await import('../../src/services/domain/token/scopes');
    const next = vi.fn();
    const res = fakeRes();

    requireScope(SCOPE_ADMIN_READ)(
      fakeReq({ isSystemToken: true, tokenScopes: ['admin:read'] }),
      res,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
  });

  it('answers 403 and names the requirement when it does not', async () => {
    const { requireScope } = await import('../../src/middleware/scope');
    const { SCOPE_ADMIN_SYSTEM } = await import('../../src/services/domain/token/scopes');
    const next = vi.fn();
    const res = fakeRes();

    requireScope(SCOPE_ADMIN_SYSTEM)(
      fakeReq({ isSystemToken: true, tokenScopes: ['mcp:read'], tokenLabel: 'Uptime monitor' }),
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ required_scopes: ['admin:system'] });
  });

  it('logs the denial by label, never by credential', async () => {
    const { requireScope } = await import('../../src/middleware/scope');
    const { SCOPE_ADMIN_SYSTEM } = await import('../../src/services/domain/token/scopes');

    requireScope(SCOPE_ADMIN_SYSTEM)(
      fakeReq({ isSystemToken: true, tokenScopes: ['mcp:read'], tokenLabel: 'Uptime monitor' }),
      fakeRes(),
      vi.fn()
    );

    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0][0]).toContain('Uptime monitor');
    expect(log.warn.mock.calls[0][0]).toContain('admin:system');
  });

  it('keeps a legacy full-access token working on every route', async () => {
    const { requireScope } = await import('../../src/middleware/scope');
    const { SCOPE_ADMIN_SYSTEM } = await import('../../src/services/domain/token/scopes');
    const next = vi.fn();

    requireScope(SCOPE_ADMIN_SYSTEM)(
      fakeReq({ isSystemToken: true, tokenScopes: ['*'] }),
      fakeRes(),
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not apply to a signed-in person', async () => {
    // A JWT carries no scopes and must not be asked for any -- otherwise this
    // middleware locks every user out of the application.
    const { requireScope } = await import('../../src/middleware/scope');
    const { SCOPE_ADMIN_SYSTEM } = await import('../../src/services/domain/token/scopes');
    const next = vi.fn();
    const res = fakeRes();

    requireScope(SCOPE_ADMIN_SYSTEM)(fakeReq({ userId: 3 }), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
  });

  it('denies a system token that carries no scopes at all', async () => {
    const { requireScope } = await import('../../src/middleware/scope');
    const { SCOPE_MCP_READ } = await import('../../src/services/domain/token/scopes');
    const res = fakeRes();

    requireScope(SCOPE_MCP_READ)(fakeReq({ isSystemToken: true }), res, vi.fn());

    expect(res.statusCode).toBe(403);
  });

  it('refuses to be constructed with no requirement', async () => {
    const { requireScope } = await import('../../src/middleware/scope');
    expect(() => requireScope()).toThrow(/at least one scope/);
  });
});

describe('requireScopeByMethod', () => {
  beforeEach(() => vi.clearAllMocks());

  const guard = async () => {
    const { requireScopeByMethod } = await import('../../src/middleware/scope');
    const { SCOPE_MCP_READ, SCOPE_MCP_WRITE } = await import(
      '../../src/services/domain/token/scopes'
    );
    return requireScopeByMethod({ read: [SCOPE_MCP_READ], write: [SCOPE_MCP_WRITE] });
  };

  it('asks for the read scope on a GET', async () => {
    const next = vi.fn();
    (await guard())(
      fakeReq({ method: 'GET', isSystemToken: true, tokenScopes: ['mcp:read'] }),
      fakeRes(),
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('asks for the write scope on a DELETE, so a read token cannot untrack', async () => {
    const res = fakeRes();
    (await guard())(
      fakeReq({ method: 'DELETE', isSystemToken: true, tokenScopes: ['mcp:read'] }),
      res,
      vi.fn()
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ required_scopes: ['mcp:write'] });
  });

  it('treats POST, PUT and PATCH as writes', async () => {
    for (const method of ['POST', 'PUT', 'PATCH']) {
      const res = fakeRes();
      (await guard())(
        fakeReq({ method, isSystemToken: true, tokenScopes: ['mcp:read'] }),
        res,
        vi.fn()
      );
      expect(res.statusCode, method).toBe(403);
    }
  });

  it('treats HEAD and OPTIONS as reads', async () => {
    for (const method of ['HEAD', 'OPTIONS']) {
      const next = vi.fn();
      (await guard())(
        fakeReq({ method, isSystemToken: true, tokenScopes: ['mcp:read'] }),
        fakeRes(),
        next
      );
      expect(next, method).toHaveBeenCalledTimes(1);
    }
  });
});
