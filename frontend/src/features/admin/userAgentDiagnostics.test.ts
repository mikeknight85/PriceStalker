import { describe, it, expect } from 'vitest';
import { diagnoseRetailerUserAgent, DEFAULT_CHROME_VERSION, PRESET_USER_AGENTS } from './components/constants';

describe('User-Agent Diagnostics and Presets', () => {
  it('identifies canonical Chrome 154 as clean with no warnings', () => {
    const diag = diagnoseRetailerUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
      true
    );
    expect(diag.isMismatchedEngine).toBe(false);
    expect(diag.isOutdated).toBe(false);
    expect(diag.browserFamily).toBe('chromium');
    expect(diag.majorVersion).toBe(154);
    expect(diag.message).toBeUndefined();
  });

  it('flags Chromium versions older than Chrome 140 as outdated', () => {
    const diag = diagnoseRetailerUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      false
    );
    expect(diag.isOutdated).toBe(true);
    expect(diag.majorVersion).toBe(121);
    expect(diag.message).toContain('older than modern anti-bot baselines');
  });

  it('flags engine mismatch when Browser Scraper is paired with Safari User-Agent', () => {
    const diag = diagnoseRetailerUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15',
      true
    );
    expect(diag.isMismatchedEngine).toBe(true);
    expect(diag.browserFamily).toBe('safari');
    expect(diag.message).toContain('Browser Scraper runs Chromium');
  });

  it('permits Safari User-Agent when Browser Scraper is disabled (plain HTTP)', () => {
    const diag = diagnoseRetailerUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15',
      false
    );
    expect(diag.isMismatchedEngine).toBe(false);
    expect(diag.isOutdated).toBe(false);
    expect(diag.browserFamily).toBe('safari');
    expect(diag.message).toBeUndefined();
  });

  it('handles null, undefined, and empty string without warning (inherits system default)', () => {
    const diag = diagnoseRetailerUserAgent(null, true);
    expect(diag.isMismatchedEngine).toBe(false);
    expect(diag.isOutdated).toBe(false);
    expect(diag.message).toBeUndefined();

    const emptyDiag = diagnoseRetailerUserAgent('   ', true);
    expect(emptyDiag.isMismatchedEngine).toBe(false);
    expect(emptyDiag.isOutdated).toBe(false);
  });

  it('preset user agents include canonical version 154', () => {
    expect(DEFAULT_CHROME_VERSION).toBe('154.0.0.0');
    const canonical = PRESET_USER_AGENTS.find((p) => p.label.includes('Canonical'));
    expect(canonical).toBeDefined();
    expect(canonical?.value).toContain('Chrome/154.0.0.0');
  });
});
