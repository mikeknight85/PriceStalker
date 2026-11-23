import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const tokenService = {
  listTokens: vi.fn(),
  describeScopes: vi.fn(),
  createSystemToken: vi.fn(),
  deleteToken: vi.fn(),
};

vi.mock('../../src/services/domain/token', () => ({
  systemApiTokenService: tokenService,
}));

describe('Admin Tokens Routes', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const router = (await import('../../src/routes/admin/tokens')).default;
    const app = express();
    app.use(express.json());
    // Simulate admin authentication middleware
    app.use((req: any, _res: any, next: any) => {
      req.userId = 1;
      next();
    });
    app.use('/api/admin/tokens', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/admin/tokens lists all system tokens', async () => {
    const mockTokens = [{ id: 1, label: 'Backup Script', scopes: ['*'] }];
    tokenService.listTokens.mockResolvedValue(mockTokens);

    const res = await fetch(`${baseUrl}/api/admin/tokens`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockTokens);
    expect(tokenService.listTokens).toHaveBeenCalledTimes(1);
  });

  it('GET /api/admin/tokens/scopes describes available scopes', async () => {
    const mockScopes = [{ scope: '*', label: 'Full Access' }];
    tokenService.describeScopes.mockReturnValue(mockScopes);

    const res = await fetch(`${baseUrl}/api/admin/tokens/scopes`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ scopes: mockScopes });
  });

  describe('POST /api/admin/tokens', () => {
    it('returns 400 when label is missing', async () => {
      const res = await fetch(`${baseUrl}/api/admin/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'No label' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Label is required');
    });

    it('creates system token with default full scopes when omitted', async () => {
      tokenService.createSystemToken.mockResolvedValue({
        token: 'pt_secret_token_123',
        systemToken: { id: 5, label: 'Default Token' },
      });

      const res = await fetch(`${baseUrl}/api/admin/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Default Token' }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.token).toBe('pt_secret_token_123');
      expect(tokenService.createSystemToken).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Default Token',
          admin_id: 1,
          scopes: ['*'],
        })
      );
    });

    it('creates system token with explicit requested scopes', async () => {
      tokenService.createSystemToken.mockResolvedValue({
        token: 'pt_mcp_token_456',
        systemToken: { id: 6, label: 'MCP Reader' },
      });

      const res = await fetch(`${baseUrl}/api/admin/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'MCP Reader',
          scopes: ['mcp:read'],
        }),
      });
      expect(res.status).toBe(201);
      expect(tokenService.createSystemToken).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'MCP Reader',
          scopes: ['mcp:read'],
        })
      );
    });
  });

  describe('DELETE /api/admin/tokens/:id', () => {
    it('returns 400 for non-numeric token ID', async () => {
      const res = await fetch(`${baseUrl}/api/admin/tokens/abc`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid token ID');
    });

    it('returns 404 when token does not exist', async () => {
      tokenService.deleteToken.mockResolvedValue(false);

      const res = await fetch(`${baseUrl}/api/admin/tokens/999`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Token not found');
    });

    it('deletes token successfully', async () => {
      tokenService.deleteToken.mockResolvedValue(true);

      const res = await fetch(`${baseUrl}/api/admin/tokens/12`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('System API token deleted successfully');
      expect(tokenService.deleteToken).toHaveBeenCalledWith(12);
    });
  });
});
