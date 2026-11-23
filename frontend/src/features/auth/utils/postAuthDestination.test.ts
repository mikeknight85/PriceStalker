import { describe, it, expect, beforeEach, vi } from 'vitest';
import { postAuthDestination } from './postAuthDestination';

describe('postAuthDestination', () => {
  beforeEach(() => {
    // Provide a standard window.location origin in Node test environment
    vi.stubGlobal('window', {
      location: new URL('http://localhost:8080'),
    });
  });

  it('returns /products fallback when redirect query param is missing or empty', () => {
    expect(postAuthDestination('')).toBe('/products');
    expect(postAuthDestination('?other=123')).toBe('/products');
    expect(postAuthDestination('?redirect=')).toBe('/products');
  });

  it('allows safe local relative destinations', () => {
    expect(postAuthDestination('?redirect=/products/42')).toBe('/products/42');
    expect(postAuthDestination('?redirect=/settings/notifications?channel=telegram#test')).toBe(
      '/settings/notifications?channel=telegram#test'
    );
  });

  it('rejects external open redirects and falls back to /products', () => {
    expect(postAuthDestination('?redirect=https://evil.example.com/steal-token')).toBe('/products');
    expect(postAuthDestination('?redirect=http://attacker.com/malicious')).toBe('/products');
    expect(postAuthDestination('?redirect=//evil.example.com')).toBe('/products');
  });

  it('rejects non-http or malformed protocols', () => {
    expect(postAuthDestination('?redirect=javascript:alert(1)')).toBe('/products');
    expect(postAuthDestination('?redirect=data:text/html,bad')).toBe('/products');
  });
});
