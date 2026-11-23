import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSsoEnabled,
  getRedirectUri,
  getFrontendCompleteUrl,
  storeFlowState,
  consumeFlowState,
  invalidateOidcClient,
  getOidcClient,
  startFlow,
  completeFlow,
} from '../../src/services/domain/auth/oidc';
import { authConfigRepository } from '../../src/services/domain/auth/repositories/auth-config.repository';
import { Issuer, generators } from 'openid-client';

vi.mock('../../src/services/domain/auth/repositories/auth-config.repository', () => ({
  authConfigRepository: {
    get: vi.fn(),
  },
}));

vi.mock('openid-client', () => {
  const mockClientInstance = {
    authorizationUrl: vi.fn().mockReturnValue('https://idp.example.com/auth?client_id=test'),
    callback: vi.fn(),
    userinfo: vi.fn(),
  };

  function MockClient() {
    return mockClientInstance;
  }

  const MockIssuer = {
    discover: vi.fn().mockResolvedValue({
      Client: MockClient,
    }),
  };

  return {
    Issuer: MockIssuer,
    Client: MockClient,
    generators: {
      codeVerifier: vi.fn().mockReturnValue('mock-code-verifier'),
      codeChallenge: vi.fn().mockReturnValue('mock-code-challenge'),
      state: vi.fn().mockReturnValue('mock-state-xyz'),
      nonce: vi.fn().mockReturnValue('mock-nonce-123'),
    },
  };
});

describe('OIDC Domain Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    invalidateOidcClient();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isSsoEnabled', () => {
    it('returns true when ENABLE_SSO is true', () => {
      process.env.ENABLE_SSO = 'true';
      expect(isSsoEnabled()).toBe(true);
    });

    it('returns false when ENABLE_SSO is false or unset', () => {
      process.env.ENABLE_SSO = 'false';
      expect(isSsoEnabled()).toBe(false);
      delete process.env.ENABLE_SSO;
      expect(isSsoEnabled()).toBe(false);
    });
  });

  describe('getRedirectUri', () => {
    it('returns OIDC_REDIRECT_URI_OVERRIDE if configured', () => {
      process.env.OIDC_REDIRECT_URI_OVERRIDE = 'https://custom.example.com/callback';
      expect(getRedirectUri()).toBe('https://custom.example.com/callback');
    });

    it('derives callback URL from PUBLIC_URL', () => {
      process.env.PUBLIC_URL = 'https://app.pricestalker.test/';
      expect(getRedirectUri()).toBe('https://app.pricestalker.test/api/auth/oidc/callback');
    });

    it('throws if neither override nor PUBLIC_URL is provided', () => {
      delete process.env.OIDC_REDIRECT_URI_OVERRIDE;
      delete process.env.PUBLIC_URL;
      expect(() => getRedirectUri()).toThrow('PUBLIC_URL env var is required');
    });
  });

  describe('getFrontendCompleteUrl', () => {
    it('derives sso-complete frontend URL from PUBLIC_URL', () => {
      process.env.PUBLIC_URL = 'https://app.pricestalker.test';
      expect(getFrontendCompleteUrl()).toBe('https://app.pricestalker.test/auth/sso-complete');
    });

    it('throws if PUBLIC_URL is missing', () => {
      delete process.env.PUBLIC_URL;
      expect(() => getFrontendCompleteUrl()).toThrow('PUBLIC_URL env var is required');
    });
  });

  describe('flow state storage', () => {
    it('stores and single-use consumes flow state', () => {
      storeFlowState('state-1', 'verifier-1', 'nonce-1');
      const consumed = consumeFlowState('state-1');
      expect(consumed).toEqual({
        codeVerifier: 'verifier-1',
        nonce: 'nonce-1',
        expiresAt: expect.any(Number),
      });

      // Second consumption must be null
      expect(consumeFlowState('state-1')).toBeNull();
    });

    it('returns null for nonexistent state', () => {
      expect(consumeFlowState('nonexistent')).toBeNull();
    });
  });

  describe('getOidcClient & caching', () => {
    beforeEach(() => {
      process.env.PUBLIC_URL = 'https://app.pricestalker.test';
    });

    it('throws when oidc_enabled is false in DB config', async () => {
      vi.mocked(authConfigRepository.get).mockResolvedValueOnce({
        oidc_enabled: false,
      } as any);

      await expect(getOidcClient()).rejects.toThrow('OIDC is not enabled');
    });

    it('throws when issuer URL or client ID are missing', async () => {
      vi.mocked(authConfigRepository.get).mockResolvedValueOnce({
        oidc_enabled: true,
        oidc_issuer_url: '',
        oidc_client_id: '',
      } as any);

      await expect(getOidcClient()).rejects.toThrow('OIDC issuer URL and client ID are required');
    });

    it('discovers issuer and constructs Client, then reuses cache', async () => {
      const config = {
        oidc_enabled: true,
        oidc_issuer_url: 'https://idp.example.com',
        oidc_client_id: 'stalker-client',
        oidc_client_secret: 'stalker-secret',
      };
      vi.mocked(authConfigRepository.get).mockResolvedValue(config as any);

      const client1 = await getOidcClient();
      expect(Issuer.discover).toHaveBeenCalledWith('https://idp.example.com');

      const client2 = await getOidcClient();
      expect(client2).toBe(client1);
      // Discover called only once due to cache
      expect(Issuer.discover).toHaveBeenCalledTimes(1);

      // Invalidate cache
      invalidateOidcClient();
      const client3 = await getOidcClient();
      expect(Issuer.discover).toHaveBeenCalledTimes(2);
      expect(client3).toBeDefined();
    });
  });

  describe('startFlow', () => {
    beforeEach(() => {
      process.env.PUBLIC_URL = 'https://app.pricestalker.test';
      vi.mocked(authConfigRepository.get).mockResolvedValue({
        oidc_enabled: true,
        oidc_issuer_url: 'https://idp.example.com',
        oidc_client_id: 'stalker-client',
        oidc_client_secret: 'stalker-secret',
        oidc_scopes: 'openid email profile',
      } as any);
    });

    it('generates state, stores it, and returns authorization url', async () => {
      const flow = await startFlow();
      expect(flow.state).toBe('mock-state-xyz');
      expect(flow.authorizationUrl).toBe('https://idp.example.com/auth?client_id=test');

      const stored = consumeFlowState('mock-state-xyz');
      expect(stored?.codeVerifier).toBe('mock-code-verifier');
      expect(stored?.nonce).toBe('mock-nonce-123');
    });
  });

  describe('completeFlow', () => {
    beforeEach(() => {
      process.env.PUBLIC_URL = 'https://app.pricestalker.test';
    });

    it('throws when state is invalid or missing in flowState store', async () => {
      vi.mocked(authConfigRepository.get).mockResolvedValue({
        oidc_enabled: true,
        oidc_issuer_url: 'https://idp.example.com',
        oidc_client_id: 'client',
      } as any);

      const params = new URLSearchParams('code=abc&state=unknown');
      await expect(completeFlow(params, 'unknown')).rejects.toThrow('Invalid or expired OIDC state');
    });

    it('completes flow, parses claims, and validates email_verified', async () => {
      vi.mocked(authConfigRepository.get).mockResolvedValue({
        oidc_enabled: true,
        oidc_issuer_url: 'https://idp.example.com',
        oidc_client_id: 'client',
        oidc_require_email_verified: true,
      } as any);

      storeFlowState('valid-state', 'verif-1', 'nonce-1');

      const client = await getOidcClient();
      vi.mocked(client.callback).mockResolvedValueOnce({
        claims: () => ({
          iss: 'https://idp.example.com',
          sub: 'user-sub-123',
          email: 'user@example.com',
          email_verified: true,
          name: 'Jane Doe',
        }),
      } as any);

      const params = new URLSearchParams('code=valid-code&state=valid-state');
      const claims = await completeFlow(params, 'valid-state');

      expect(claims).toEqual({
        issuer: 'https://idp.example.com',
        subject: 'user-sub-123',
        email: 'user@example.com',
        emailVerified: true,
        name: 'Jane Doe',
      });
    });

    it('fetches userinfo when email is missing from claims', async () => {
      vi.mocked(authConfigRepository.get).mockResolvedValue({
        oidc_enabled: true,
        oidc_issuer_url: 'https://idp.example.com',
        oidc_client_id: 'client',
        oidc_require_email_verified: true,
      } as any);

      storeFlowState('state-userinfo', 'verif-2', 'nonce-2');

      const client = await getOidcClient();
      vi.mocked(client.callback).mockResolvedValueOnce({
        access_token: 'valid-access-token',
        claims: () => ({
          iss: 'https://idp.example.com',
          sub: 'user-sub-456',
        }),
      } as any);

      vi.mocked(client.userinfo).mockResolvedValueOnce({
        email: 'userinfo@example.com',
        email_verified: true,
        preferred_username: 'janedoe',
      });

      const params = new URLSearchParams('code=code&state=state-userinfo');
      const claims = await completeFlow(params, 'state-userinfo');

      expect(claims.email).toBe('userinfo@example.com');
      expect(claims.name).toBe('janedoe');
    });

    it('rejects if email_verified is false and required by config', async () => {
      vi.mocked(authConfigRepository.get).mockResolvedValue({
        oidc_enabled: true,
        oidc_issuer_url: 'https://idp.example.com',
        oidc_client_id: 'client',
        oidc_require_email_verified: true,
      } as any);

      storeFlowState('state-unverified', 'v', 'n');

      const client = await getOidcClient();
      vi.mocked(client.callback).mockResolvedValueOnce({
        claims: () => ({
          iss: 'https://idp.example.com',
          sub: 'sub',
          email: 'unverified@example.com',
          email_verified: false,
        }),
      } as any);

      const params = new URLSearchParams('code=c&state=state-unverified');
      await expect(completeFlow(params, 'state-unverified')).rejects.toThrow(
        'Provider did not assert email_verified'
      );
    });
  });
});
