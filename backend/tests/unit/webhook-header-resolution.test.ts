import { describe, it, expect } from 'vitest';
import {
  parseWebhookHeaders,
  resolveWebhookHeaders,
  webhookSendsPlainText,
  DEFAULT_WEBHOOK_CONTENT_TYPE,
} from '../../src/services/notifications/webhook-headers';

describe('webhook-headers resolution & boundary conditions', () => {
  describe('parseWebhookHeaders', () => {
    it('successfully parses valid JSON object headers and stringifies values', () => {
      const json = JSON.stringify({
        Authorization: 'Bearer secret-token',
        'X-RateLimit': 100,
        'X-Debug': true,
      });

      const parsed = parseWebhookHeaders(json);
      expect(parsed).toEqual({
        Authorization: 'Bearer secret-token',
        'X-RateLimit': '100',
        'X-Debug': 'true',
      });
    });

    it('throws SyntaxError on malformed JSON string', () => {
      expect(() => parseWebhookHeaders('{ invalid-json')).toThrow(SyntaxError);
    });

    it('throws "Headers must be a JSON object" for non-object JSON values', () => {
      expect(() => parseWebhookHeaders('null')).toThrow(/Headers must be a JSON object/);
      expect(() => parseWebhookHeaders('["header1", "header2"]')).toThrow(/Headers must be a JSON object/);
      expect(() => parseWebhookHeaders('"just a string"')).toThrow(/Headers must be a JSON object/);
      expect(() => parseWebhookHeaders('12345')).toThrow(/Headers must be a JSON object/);
      expect(() => parseWebhookHeaders('false')).toThrow(/Headers must be a JSON object/);
    });
  });

  describe('resolveWebhookHeaders', () => {
    it('returns default Content-Type and sendsJson: true when input is null, undefined, or empty', () => {
      const resNull = resolveWebhookHeaders(null);
      expect(resNull).toEqual({
        headers: { 'Content-Type': DEFAULT_WEBHOOK_CONTENT_TYPE },
        sendsJson: true,
      });

      const resUndefined = resolveWebhookHeaders(undefined);
      expect(resUndefined).toEqual({
        headers: { 'Content-Type': DEFAULT_WEBHOOK_CONTENT_TYPE },
        sendsJson: true,
      });

      const resEmpty = resolveWebhookHeaders('');
      expect(resEmpty).toEqual({
        headers: { 'Content-Type': DEFAULT_WEBHOOK_CONTENT_TYPE },
        sendsJson: true,
      });
    });

    it('merges custom headers while retaining default Content-Type when not specified', () => {
      const json = JSON.stringify({
        Authorization: 'Basic dXNlcjpwYXNz',
        'X-Custom-Header': 'CustomValue',
      });

      const resolved = resolveWebhookHeaders(json);
      expect(resolved.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Basic dXNlcjpwYXNz',
        'X-Custom-Header': 'CustomValue',
      });
      expect(resolved.sendsJson).toBe(true);
    });

    it('overrides default Content-Type case-insensitively without duplicate keys', () => {
      // Lowercase content-type
      const resLower = resolveWebhookHeaders(JSON.stringify({ 'content-type': 'text/plain' }));
      expect(resLower.headers).toEqual({ 'content-type': 'text/plain' });
      expect(resLower.sendsJson).toBe(false);

      // Uppercase CONTENT-TYPE
      const resUpper = resolveWebhookHeaders(JSON.stringify({ 'CONTENT-TYPE': 'text/xml' }));
      expect(resUpper.headers).toEqual({ 'CONTENT-TYPE': 'text/xml' });
      expect(resUpper.sendsJson).toBe(false);

      // Mixed-case Content-Type with custom subtype
      const resMixed = resolveWebhookHeaders(
        JSON.stringify({ 'Content-Type': 'application/vnd.api+json; charset=utf-8' })
      );
      expect(resMixed.headers).toEqual({
        'Content-Type': 'application/vnd.api+json; charset=utf-8',
      });
      expect(resMixed.sendsJson).toBe(true);
    });

    it('correctly isolates media type from parameters (e.g. text/plain; profile="json" is NOT JSON)', () => {
      const trickyHeader = JSON.stringify({
        'Content-Type': 'text/plain; profile="json"',
      });
      const resolved = resolveWebhookHeaders(trickyHeader);
      // Media type is text/plain, so sendsJson must be false despite "json" appearing in the parameters!
      expect(resolved.sendsJson).toBe(false);
    });
  });

  describe('webhookSendsPlainText', () => {
    it('returns false for null, undefined, empty, or whitespace strings', () => {
      expect(webhookSendsPlainText(null)).toBe(false);
      expect(webhookSendsPlainText(undefined)).toBe(false);
      expect(webhookSendsPlainText('')).toBe(false);
      expect(webhookSendsPlainText('   ')).toBe(false);
    });

    it('returns false safely without throwing when JSON is invalid', () => {
      expect(webhookSendsPlainText('not valid json')).toBe(false);
      expect(webhookSendsPlainText('[1, 2, 3]')).toBe(false);
    });

    it('returns true when media type is plain text or not JSON', () => {
      expect(webhookSendsPlainText(JSON.stringify({ 'Content-Type': 'text/plain' }))).toBe(true);
      expect(webhookSendsPlainText(JSON.stringify({ 'content-type': 'text/csv; header=present' }))).toBe(true);
      expect(webhookSendsPlainText(JSON.stringify({ 'Content-Type': 'application/xml' }))).toBe(true);
    });

    it('returns false when media type is JSON or default', () => {
      expect(webhookSendsPlainText(JSON.stringify({ 'Content-Type': 'application/json' }))).toBe(false);
      expect(webhookSendsPlainText(JSON.stringify({ 'Content-Type': 'application/problem+json' }))).toBe(false);
      expect(webhookSendsPlainText(JSON.stringify({ 'X-Other': 'value' }))).toBe(false);
    });
  });
});
