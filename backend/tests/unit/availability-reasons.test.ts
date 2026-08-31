import { describe, it, expect } from 'vitest';
import {
  isDefinitiveUnavailable,
  describeUnavailableReason,
  classifyTransportError,
  type UnavailableReason,
} from '../../src/types/availability';

/**
 * The definitive/transient split decides whether a product gets paused and its
 * owner notified that it is gone. Misclassifying one as the other is the whole
 * bug this replaces: every network failure used to become a silent `unknown`,
 * and every definitive failure reported itself as "404/410" whatever it was.
 */

describe('Unavailable reasons', () => {
  describe('definitive means the page itself is gone', () => {
    const definitive: UnavailableReason[] = [
      'http_404',
      'http_410',
      'redirected_to_error_page',
      'soft_404_title',
      'soft_404_noindex',
      'soft_404_element',
    ];

    it.each(definitive)('%s counts toward pausing', (reason) => {
      expect(isDefinitiveUnavailable(reason)).toBe(true);
    });
  });

  describe('transient means we could not look', () => {
    const transient: UnavailableReason[] = [
      'site_timeout',
      'dns_failure',
      'connection_failure',
      'remote_scraper_failure',
      'bot_or_challenge',
      'unknown_scrape_failure',
    ];

    it.each(transient)('%s must never mark a product gone', (reason) => {
      expect(isDefinitiveUnavailable(reason)).toBe(false);
    });

    it('treats a bot challenge as transient', () => {
      // A retailer serving a CAPTCHA is not evidence the product was removed.
      // Treating it as definitive is how a bot wall silently deletes a user's
      // tracking, which is the failure mode the streak was added to prevent.
      expect(isDefinitiveUnavailable('bot_or_challenge')).toBe(false);
    });
  });

  it('treats an absent reason as not definitive', () => {
    expect(isDefinitiveUnavailable(null)).toBe(false);
    expect(isDefinitiveUnavailable(undefined)).toBe(false);
  });

  describe('classifying a transport error', () => {
    it.each([
      [{ code: 'ENOTFOUND' }, 'dns_failure'],
      [{ code: 'EAI_AGAIN' }, 'dns_failure'],
      [{ message: 'getaddrinfo ENOTFOUND shop.example' }, 'dns_failure'],
      [{ code: 'ECONNABORTED' }, 'site_timeout'],
      [{ code: 'ETIMEDOUT' }, 'site_timeout'],
      [{ message: 'timeout of 30000ms exceeded' }, 'site_timeout'],
      [{ code: 'ECONNREFUSED' }, 'connection_failure'],
      [{ code: 'ECONNRESET' }, 'connection_failure'],
      [{ code: 'EHOSTUNREACH' }, 'connection_failure'],
    ])('%o -> %s', (error, expected) => {
      expect(classifyTransportError(error)).toBe(expected);
    });

    it('falls back rather than guessing', () => {
      expect(classifyTransportError(new Error('something odd'))).toBe('unknown_scrape_failure');
      expect(classifyTransportError(undefined)).toBe('unknown_scrape_failure');
    });

    it('never classifies a transport error as definitive', () => {
      // The safety property: nothing the network does should be able to mark a
      // product as gone.
      for (const e of [{ code: 'ENOTFOUND' }, { code: 'ETIMEDOUT' }, new Error('?')]) {
        expect(isDefinitiveUnavailable(classifyTransportError(e))).toBe(false);
      }
    });
  });

  describe('descriptions are written for a person', () => {
    it('describes each reason without leaking the code', () => {
      const reasons: UnavailableReason[] = [
        'http_404', 'http_410', 'redirected_to_error_page', 'soft_404_title',
        'soft_404_noindex', 'soft_404_element', 'site_timeout', 'dns_failure',
        'connection_failure', 'remote_scraper_failure', 'bot_or_challenge',
        'unknown_scrape_failure',
      ];
      for (const r of reasons) {
        const text = describeUnavailableReason(r);
        expect(text.length).toBeGreaterThan(10);
        expect(text).not.toContain('_');
      }
    });

    it('distinguishes a redirect from a 404', () => {
      // These used to be reported identically as "404/410 Page Not Found".
      expect(describeUnavailableReason('redirected_to_error_page'))
        .not.toBe(describeUnavailableReason('http_404'));
    });

    it('handles an absent reason', () => {
      expect(describeUnavailableReason(null)).toBe('Unknown');
    });
  });
});
