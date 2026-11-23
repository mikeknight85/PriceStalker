import { describe, it, expect } from 'vitest';
import { scrubSensitiveData, scrubUrlCredentials } from '../../src/utils/system/logging/scrubber';

describe('Credential Scrubber Edge Cases & Boundaries (AGENTS.md Security Rule)', () => {
  describe('scrubUrlCredentials boundary and malformed URL inputs', () => {
    it('returns non-string values as-is without throwing', () => {
      expect(scrubUrlCredentials(null as any)).toBeNull();
      expect(scrubUrlCredentials(undefined as any)).toBeUndefined();
      expect(scrubUrlCredentials(12345 as any)).toBe(12345);
      expect(scrubUrlCredentials({} as any)).toEqual({});
    });

    it('scrubs credentials from URLs with IPv6 hostnames', () => {
      const url = 'http://admin:secret123@[::1]:8080/metrics';
      expect(scrubUrlCredentials(url)).toBe('http://[REDACTED]:[REDACTED]@[::1]:8080/metrics');
    });

    it('scrubs credentials from URLs with URL-encoded special characters', () => {
      const url = 'https://user%40domain.com:p%40ssword%23!@api.service.internal:8443/checkout';
      expect(scrubUrlCredentials(url)).toBe('https://[REDACTED]:[REDACTED]@api.service.internal:8443/checkout');
    });

    it('scrubs credentials from URLs containing query strings, hashes, and paths', () => {
      const url = 'http://user:pass@proxy.corp.net:3128/fetch?target=https%3A%2F%2Fstore.com#anchor';
      expect(scrubUrlCredentials(url)).toBe(
        'http://[REDACTED]:[REDACTED]@proxy.corp.net:3128/fetch?target=https%3A%2F%2Fstore.com#anchor'
      );
    });

    it('does not touch normal email addresses or plain text without http scheme', () => {
      const text = 'Contact dev:ops@company.org or admin:help@service.net for credentials';
      expect(scrubUrlCredentials(text)).toBe(text);
    });
  });

  describe('scrubSensitiveData case-sensitivity and complex shapes', () => {
    it('returns primitives and falsy values unharmed', () => {
      expect(scrubSensitiveData(null)).toBeNull();
      expect(scrubSensitiveData(undefined)).toBeUndefined();
      expect(scrubSensitiveData(false)).toBe(false);
      expect(scrubSensitiveData(0)).toBe(0);
      expect(scrubSensitiveData('')).toBe('');
    });

    it('detects sensitive keys case-insensitively (uppercase, mixed-case)', () => {
      const payload = {
        PASSWORD: 'superSecretPassword',
        Api_Key: 'api_12345',
        SECRET_TOKEN: 'jwt_tok_999',
        User_Password_Hash: '$2b$10$xyz',
        safeProperty: 'normalValue',
      };

      const result = scrubSensitiveData(payload);
      expect(result.PASSWORD).toBe('[REDACTED]');
      expect(result.Api_Key).toBe('[REDACTED]');
      expect(result.SECRET_TOKEN).toBe('[REDACTED]');
      expect(result.User_Password_Hash).toBe('[REDACTED]');
      expect(result.safeProperty).toBe('normalValue');
    });

    it('preserves boolean proxy keys (useProxy, proxyEnabled) while redacting proxy strings', () => {
      const payload = {
        proxy: true,
        useProxy: false,
        proxyUrl: 'http://user:pass@proxy.example:3128',
      };

      const result = scrubSensitiveData(payload);
      expect(result.proxy).toBe(true);
      expect(result.useProxy).toBe(false);
      expect(result.proxyUrl).toBe('http://[REDACTED]:[REDACTED]@proxy.example:3128');
    });

    it('scrubs arrays containing mixed types and strings with inline URLs', () => {
      const list = [
        'Safe text',
        'http://bob:secret@internal-gateway:8080/status',
        { token: 'secretToken', count: 42 },
      ];

      const result = scrubSensitiveData(list);
      expect(result[0]).toBe('Safe text');
      expect(result[1]).toBe('http://[REDACTED]:[REDACTED]@internal-gateway:8080/status');
      expect(result[2].token).toBe('[REDACTED]');
      expect(result[2].count).toBe(42);
    });
  });
});
