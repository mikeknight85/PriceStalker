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

    it('does not corrupt URLs with colons or at-signs in queries or paths', () => {
      const urlWithQuery = 'https://shop.example.com/search?q=a:b@c';
      expect(scrubUrlCredentials(urlWithQuery)).toBe('https://shop.example.com/search?q=a:b@c');

      const urlWithPort = 'https://host:8443/p/1';
      expect(scrubUrlCredentials(urlWithPort)).toBe('https://host:8443/p/1');

      const contactParam = '?contact=sales@shop.com';
      expect(scrubUrlCredentials(contactParam)).toBe('?contact=sales@shop.com');
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
      const result = scrubSensitiveData(input) as Record<string, unknown>;
      expect(result.api_key).toBe('[REDACTED]');
      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.secret_value).toBe('[REDACTED]');
      expect(result.normal_key).toBe('visible');
    });

    it('redacts all fields from notification-credentials catalogue', () => {
      const input = {
        telegram_bot_token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        discord_webhook_url: 'https://discord.com/api/webhooks/123/SECRET-TOKEN-HERE',
        pushover_user_key: 'uQiRzpo4DXghDmr9QzzfQu27cmVRsG',
        pushover_app_token: 'azGDORePK8gMaC0QOYAMyEEuzJnyUi',
        ntfy_password: 'supersecretpassword',
        gotify_app_token: 'A1B2C3D4E5F6G7',
        webhook_url: 'https://hooks.example.com/t/SECRET-TOKEN-HERE',
        webhook_headers: '{"Authorization":"Bearer sk-live-REALKEY"}',
        apprise_config_key: 'my-secret-config-key',
        apprise_urls: 'tgram://bottoken/ChatID'
      };
      const result = scrubSensitiveData(input) as Record<string, unknown>;
      expect(result.telegram_bot_token).toBe('[REDACTED]');
      expect(result.discord_webhook_url).toBe('[REDACTED]');
      expect(result.pushover_user_key).toBe('[REDACTED]');
      expect(result.pushover_app_token).toBe('[REDACTED]');
      expect(result.ntfy_password).toBe('[REDACTED]');
      expect(result.gotify_app_token).toBe('[REDACTED]');
      expect(result.webhook_url).toBe('[REDACTED]');
      expect(result.webhook_headers).toBe('[REDACTED]');
      expect(result.apprise_config_key).toBe('[REDACTED]');
      expect(result.apprise_urls).toBe('[REDACTED]');
    });

    it('redacts private_key, passphrase, and session_cookie', () => {
      const input = {
        private_key: '-----BEGIN RSA PRIVATE KEY-----...',
        passphrase: 'cert-passphrase',
        session_cookie: 'session_id=abc123secret'
      };
      const result = scrubSensitiveData(input) as Record<string, unknown>;
      expect(result.private_key).toBe('[REDACTED]');
      expect(result.passphrase).toBe('[REDACTED]');
      expect(result.session_cookie).toBe('[REDACTED]');
    });

    it('redacts email keys and values', () => {
      const input = {
        email: 'operator@example.com',
        user_email: 'test@pricestalker.local',
        username: 'operator1'
      };
      const result = scrubSensitiveData(input) as Record<string, unknown>;
      expect(result.email).toBe('[REDACTED_EMAIL]');
      expect(result.user_email).toBe('[REDACTED_EMAIL]');
      expect(result.username).toBe('operator1');
    });

    it('preserves proxy boolean while scrubbing proxy URL credentials', () => {
      const input = {
        use_proxy: true,
        proxy_url: 'http://user:pass@proxy.example.com:3128'
      };
      const result = scrubSensitiveData(input) as Record<string, unknown>;
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
      const result = scrubSensitiveData(input) as {
        logs: Array<{ message: string; token: string }>;
        config: { telegram_token: string };
      };
      expect(result.logs[0].message).toBe('Notification failed for [REDACTED_EMAIL]');
      expect(result.logs[0].token).toBe('[REDACTED]');
      expect(result.config.telegram_token).toBe('[REDACTED]');
    });

    it('scrubs Error message and stack traces', () => {
      const err = new Error('Failed to connect to http://user:pass@service.internal/api');
      const scrubbed = scrubSensitiveData(err) as Error;
      expect(scrubbed.message).toContain('http://[REDACTED]:[REDACTED]@service.internal/api');
      expect(scrubbed.message).not.toContain('pass');
    });

    it('safely handles circular / self-referential structures via WeakSet', () => {
      const circular: Record<string, unknown> = {
        name: 'test-circular',
        secret_key: 'supersecret'
      };
      circular.self = circular;

      const result = scrubSensitiveData(circular) as Record<string, unknown>;
      expect(result.name).toBe('test-circular');
      expect(result.secret_key).toBe('[REDACTED]');
      expect(result.self).toBe('[CIRCULAR]');
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
