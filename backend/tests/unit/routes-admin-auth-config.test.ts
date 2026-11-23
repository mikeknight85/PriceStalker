import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const authConfigRepositoryMock = {
  get: vi.fn(),
  getAdminView: vi.fn(),
  update: vi.fn(),
};

const invalidateOidcClientMock = vi.fn();

vi.mock('../../src/services/domain/auth/repositories/auth-config.repository', () => ({
  authConfigRepository: authConfigRepositoryMock,
}));

vi.mock('../../src/services/domain/auth/oidc', () => ({
  invalidateOidcClient: invalidateOidcClientMock,
}));

describe('Admin Auth Config Routes (/api/admin/auth)', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const router = (await import('../../src/routes/admin/auth-config')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/admin/auth', router);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('GET /api/admin/auth', () => {
    it('returns the admin view of the auth config', async () => {
      authConfigRepositoryMock.getAdminView.mockResolvedValueOnce({
        policy: 'local',
        oidc_enabled: false,
        has_client_secret: false,
      });

      const res = await fetch(`${baseUrl}/api/admin/auth`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        policy: 'local',
        oidc_enabled: false,
        has_client_secret: false,
      });
      expect(authConfigRepositoryMock.getAdminView).toHaveBeenCalled();
    });
  });

  describe('PUT /api/admin/auth', () => {
    it('returns 400 for invalid policy value', async () => {
      const res = await fetch(`${baseUrl}/api/admin/auth`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: 'invalid-policy' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('policy must be one of: local, oidc, both');
    });

    it('returns 400 when enabling OIDC without issuer or client ID', async () => {
      authConfigRepositoryMock.get.mockResolvedValueOnce({
        oidc_issuer_url: null,
        oidc_client_id: null,
      });

      const res = await fetch(`${baseUrl}/api/admin/auth`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oidc_enabled: true }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Cannot enable OIDC without both issuer URL and client ID');
    });

    it('updates auth config, clears secret on empty string, and invalidates OIDC client', async () => {
      authConfigRepositoryMock.get.mockResolvedValueOnce({
        oidc_issuer_url: 'https://idp.example.com',
        oidc_client_id: 'client-123',
      });
      authConfigRepositoryMock.getAdminView.mockResolvedValueOnce({
        policy: 'both',
        oidc_enabled: true,
        has_client_secret: false,
      });

      const res = await fetch(`${baseUrl}/api/admin/auth`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy: 'both',
          oidc_enabled: true,
          oidc_client_secret: '', // Cleared
        }),
      });

      expect(res.status).toBe(200);
      expect(authConfigRepositoryMock.update).toHaveBeenCalledWith({
        policy: 'both',
        oidc_enabled: true,
        oidc_client_secret: null,
      });
      expect(invalidateOidcClientMock).toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/auth/test-discovery', () => {
    it('returns 400 when issuer_url is missing', async () => {
      const res = await fetch(`${baseUrl}/api/admin/auth/test-discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('issuer_url is required');
    });

    it('handles discovery endpoint test successfully', async () => {
      const originalFetch = globalThis.fetch;
      const mockDiscoveryResponse = {
        issuer: 'https://idp.example.com',
        authorization_endpoint: 'https://idp.example.com/auth',
        token_endpoint: 'https://idp.example.com/token',
        jwks_uri: 'https://idp.example.com/jwks',
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
        if (typeof input === 'string' && input.includes('.well-known/openid-configuration')) {
          return new Response(JSON.stringify(mockDiscoveryResponse), { status: 200 });
        }
        return originalFetch(input, init);
      });

      try {
        const res = await fetch(`${baseUrl}/api/admin/auth/test-discovery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issuer_url: 'https://idp.example.com/' }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual({
          ok: true,
          ...mockDiscoveryResponse,
        });
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('returns 400 when required fields are missing from discovery document', async () => {
      const originalFetch = globalThis.fetch;
      const incompleteDiscovery = {
        issuer: 'https://idp.example.com',
        // Missing token_endpoint, authorization_endpoint, jwks_uri
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
        if (typeof input === 'string' && input.includes('.well-known/openid-configuration')) {
          return new Response(JSON.stringify(incompleteDiscovery), { status: 200 });
        }
        return originalFetch(input, init);
      });

      try {
        const res = await fetch(`${baseUrl}/api/admin/auth/test-discovery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issuer_url: 'https://idp.example.com' }),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(data.error).toContain('Discovery document missing required fields');
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});
