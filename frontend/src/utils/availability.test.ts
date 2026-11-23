import { describe, it, expect } from 'vitest';
import {
  describeUnavailableReason,
  isDefinitiveUnavailable,
  describeMonitoringState,
} from './availability';

describe('describeUnavailableReason', () => {
  it('returns null for empty or null reason', () => {
    expect(describeUnavailableReason(null)).toBeNull();
    expect(describeUnavailableReason(undefined)).toBeNull();
    expect(describeUnavailableReason('')).toBeNull();
  });

  it('translates known availability reasons to human-friendly messages', () => {
    expect(describeUnavailableReason('http_404')).toBe('The product page returned 404 Not Found');
    expect(describeUnavailableReason('http_410')).toBe('The product page returned 410 Gone');
    expect(describeUnavailableReason('redirected_to_error_page')).toBe(
      'The product URL redirected to an error or home page'
    );
    expect(describeUnavailableReason('soft_404_title')).toBe(
      'The page title indicates the product no longer exists'
    );
    expect(describeUnavailableReason('site_timeout')).toBe('The retailer did not respond in time');
    expect(describeUnavailableReason('bot_or_challenge')).toBe(
      'The retailer served a bot check instead of the product page'
    );
  });

  it('falls back to default description for unknown reason', () => {
    expect(describeUnavailableReason('some_new_unhandled_code')).toBe('The page could not be read');
  });
});

describe('isDefinitiveUnavailable', () => {
  it('returns false for falsy reasons', () => {
    expect(isDefinitiveUnavailable(null)).toBe(false);
    expect(isDefinitiveUnavailable(undefined)).toBe(false);
    expect(isDefinitiveUnavailable('')).toBe(false);
  });

  it('identifies definitive reasons where the page itself is permanently gone', () => {
    expect(isDefinitiveUnavailable('http_404')).toBe(true);
    expect(isDefinitiveUnavailable('http_410')).toBe(true);
    expect(isDefinitiveUnavailable('redirected_to_error_page')).toBe(true);
    expect(isDefinitiveUnavailable('soft_404_title')).toBe(true);
    expect(isDefinitiveUnavailable('soft_404_noindex')).toBe(true);
    expect(isDefinitiveUnavailable('soft_404_element')).toBe(true);
  });

  it('returns false for transient or network-level failures', () => {
    expect(isDefinitiveUnavailable('site_timeout')).toBe(false);
    expect(isDefinitiveUnavailable('dns_failure')).toBe(false);
    expect(isDefinitiveUnavailable('connection_failure')).toBe(false);
    expect(isDefinitiveUnavailable('bot_or_challenge')).toBe(false);
    expect(isDefinitiveUnavailable('unknown_scrape_failure')).toBe(false);
  });
});

describe('describeMonitoringState', () => {
  it('describes paused state distinguishing manual and automatic pause', () => {
    expect(describeMonitoringState({ checking_paused: true, auto_paused: true })).toBe(
      'Paused automatically because the page could not be found. Refresh it manually to check whether it is back'
    );
    expect(describeMonitoringState({ checking_paused: true, auto_paused: false })).toBe(
      'Paused by you'
    );
  });

  it('describes active state with failure streaks', () => {
    expect(describeMonitoringState({ checking_paused: false, failure_streak: 1 })).toBe(
      'Still checking; 1 recent attempt failed'
    );
    expect(describeMonitoringState({ checking_paused: false, failure_streak: 3 })).toBe(
      'Still checking; 3 recent attempts failed'
    );
  });

  it('describes healthy active state', () => {
    expect(describeMonitoringState({})).toBe('Active');
    expect(describeMonitoringState({ checking_paused: false, failure_streak: 0 })).toBe('Active');
  });
});
