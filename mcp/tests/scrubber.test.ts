import { describe, it, expect } from 'vitest';
import {
  scrubSensitiveData,
  scrubUrlCredentials,
  scrubEmails,
  formatScrubbedJson
} from '../src/utils/scrubber.js';

describe('MCP Scrubber Unit Tests', () => {
  describe('scrubUrlCredentials', () => {
    it('masks credentials in URLs', () => {
      const url = 'http://admin:secret123@192.168.1.50:8080/data';
      expect(scrubUrlCredentials(url)).toBe('http://[REDACTED]:[REDACTED]@192.168.1.50:8080/data');
    });

    it('leaves clean URLs untouched', () => {
      const url = 'https://example.com/products/view?id=42';
      expect(scrubUrlCredentials(url)).toBe(url);
    });
  });

  describe('scrubEmails', () => {
    it('masks email addresses in strings', () => {
      const str = 'Scrape failed for user admin@pricestalker.internal with timeout';
      expect(scrubEmails(str)).toBe('Scrape failed for user [REDACTED_EMAIL] with timeout');
    });
  });

  describe('scrubSensitiveData', () => {
    it('redacts sensitive keys', () => {
      const input = {
        api_key: 'ps_live_abcdef123456',
        password: 'supersecretpassword',
        token: 'eyJhbGciOi...',
        secret_value: 'xyz',
        normal_key: 'visible'
      };
      const result = scrubSensitiveData(input);
      expect(result.api_key).toBe('[REDACTED]');
      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.secret_value).toBe('[REDACTED]');
      expect(result.normal_key).toBe('visible');
    });

    it('redacts email keys and values', () => {
      const input = {
        email: 'operator@example.com',
        user_email: 'test@pricestalker.local',
        username: 'operator1'
      };
      const result = scrubSensitiveData(input);
      expect(result.email).toBe('[REDACTED_EMAIL]');
      expect(result.user_email).toBe('[REDACTED_EMAIL]');
      expect(result.username).toBe('operator1');
    });

    it('preserves proxy boolean while scrubbing proxy URL credentials', () => {
      const input = {
        use_proxy: true,
        proxy_url: 'http://user:pass@proxy.example.com:3128'
      };
      const result = scrubSensitiveData(input);
      expect(result.use_proxy).toBe(true);
      expect(result.proxy_url).toBe('http://[REDACTED]:[REDACTED]@proxy.example.com:3128');
    });

    it('recursively scrubs nested objects and arrays', () => {
      const input = {
        logs: [
          { message: 'Notification failed for notify@example.com', token: 'secret_bot_token' }
        ],
        config: {
          telegram_token: 'bot12345:token'
        }
      };
      const result = scrubSensitiveData(input);
      expect(result.logs[0].message).toBe('Notification failed for [REDACTED_EMAIL]');
      expect(result.logs[0].token).toBe('[REDACTED]');
      expect(result.config.telegram_token).toBe('[REDACTED]');
    });

    it('scrubs Error message and stack traces', () => {
      const err = new Error('Failed to connect to http://user:pass@service.internal/api');
      const scrubbed = scrubSensitiveData(err);
      expect(scrubbed.message).toContain('http://[REDACTED]:[REDACTED]@service.internal/api');
      expect(scrubbed.message).not.toContain('pass');
    });
  });

  describe('formatScrubbedJson', () => {
    it('serializes scrubbed data to formatted JSON string', () => {
      const input = { token: 'abc', name: 'Product 1' };
      const json = formatScrubbedJson(input);
      expect(json).toContain('"token": "[REDACTED]"');
      expect(json).toContain('"name": "Product 1"');
    });
  });
});
