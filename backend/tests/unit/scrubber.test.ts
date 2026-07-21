import { describe, it, expect } from 'vitest';
import { scrubSensitiveData, scrubUrlCredentials } from '../../src/utils/system/logging/scrubber';

describe('Scrubber Unit Tests', () => {
  describe('scrubUrlCredentials', () => {
    it('should mask credentials in proxy URLs', () => {
      const url = 'http://steven:supersecretpassword@192.168.50.200:8080/some/path';
      const scrubbed = scrubUrlCredentials(url);
      expect(scrubbed).toBe('http://[REDACTED]:[REDACTED]@192.168.50.200:8080/some/path');
    });

    it('should mask credentials in https target URLs', () => {
      const url = 'https://admin:mykey@targetsite.com/auth';
      const scrubbed = scrubUrlCredentials(url);
      expect(scrubbed).toBe('https://[REDACTED]:[REDACTED]@targetsite.com/auth');
    });

    it('should leave URLs without credentials untouched', () => {
      const url = 'https://targetsite.com/auth?user=john';
      const scrubbed = scrubUrlCredentials(url);
      expect(scrubbed).toBe('https://targetsite.com/auth?user=john');
    });
  });

  describe('scrubSensitiveData', () => {
    it('should redact sensitive string values completely if key matches', () => {
      const data = {
        password: 'myPassword123',
        api_key: 'sk_test_5123',
        someOtherKey: 'hello'
      };
      const scrubbed = scrubSensitiveData(data);
      expect(scrubbed.password).toBe('[REDACTED]');
      expect(scrubbed.api_key).toBe('[REDACTED]');
      expect(scrubbed.someOtherKey).toBe('hello');
    });

    it('should scrub credentials in proxy key but preserve the proxy host', () => {
      const data = {
        proxyUrl: 'http://steven:pass123@proxy.com:3128',
        nonSensitive: 'keepme'
      };
      const scrubbed = scrubSensitiveData(data);
      expect(scrubbed.proxyUrl).toBe('http://[REDACTED]:[REDACTED]@proxy.com:3128');
      expect(scrubbed.nonSensitive).toBe('keepme');
    });

    it('should recursively scrub nested objects and arrays', () => {
      const data = {
        nested: {
          token: 'token123',
          items: [
            { password: '123', name: 'Bob' },
            'http://user:pass@host.local'
          ]
        }
      };
      const scrubbed = scrubSensitiveData(data);
      expect(scrubbed.nested.token).toBe('[REDACTED]');
      expect(scrubbed.nested.items[0].password).toBe('[REDACTED]');
      expect(scrubbed.nested.items[0].name).toBe('Bob');
      expect(scrubbed.nested.items[1]).toBe('http://[REDACTED]:[REDACTED]@host.local');
    });

    it('should scrub Error messages and stacks', () => {
      const error = new Error('Proxy connection failed for http://username:password@myproxy.com');
      error.stack = 'Error: Proxy connection failed for http://username:password@myproxy.com\n    at Object.run (index.js:10:5)';
      
      const scrubbed = scrubSensitiveData(error);
      expect(scrubbed).toBeInstanceOf(Error);
      expect(scrubbed.message).toContain('http://[REDACTED]:[REDACTED]@myproxy.com');
      expect(scrubbed.message).not.toContain('password');
      expect(scrubbed.stack).toContain('http://[REDACTED]:[REDACTED]@myproxy.com');
      expect(scrubbed.stack).not.toContain('password');
    });

    it('should preserve boolean values for proxy keys', () => {
      const data = {
        useProxy: true,
        proxyEnabled: false,
        proxyUrl: 'http://username:password@myproxy.com'
      };
      const scrubbed = scrubSensitiveData(data);
      expect(scrubbed.useProxy).toBe(true);
      expect(scrubbed.proxyEnabled).toBe(false);
      expect(scrubbed.proxyUrl).toBe('http://[REDACTED]:[REDACTED]@myproxy.com');
    });
  });
});
