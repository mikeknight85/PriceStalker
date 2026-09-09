import { describe, it, expect } from 'vitest';
import { pricesMatch } from '../../src/services/scraper/arbitrators/utils';

/**
 * Findings from the arbitration and stock audit in #167. All six held; these
 * cover the ones reachable without a full scrape.
 */

describe('pricesMatch is bounded in absolute terms', () => {
  // The tolerance exists to group one price scraped several ways, and to
  // absorb rounding. A bare 5% rule did the opposite as prices rose.
  it.each([
    [1000, 1040],
    [1000, 1051],
    [850, 880],
    [2500, 2600],
  ])('treats %s and %s as different prices', (a, b) => {
    expect(pricesMatch(a, b)).toBe(false);
  });

  it('still groups the same price written differently', () => {
    expect(pricesMatch(1099, 1099)).toBe(true);
    expect(pricesMatch(1099, 1099.01)).toBe(true);
  });

  it('still absorbs rounding on cheap items', () => {
    // The relative rule is already tight down here, and narrowing it would
    // split groups that belong together.
    expect(pricesMatch(0.99, 1.00)).toBe(true);
    expect(pricesMatch(19.99, 20.00)).toBe(true);
  });

  it('is symmetric', () => {
    expect(pricesMatch(1000, 1040)).toBe(pricesMatch(1040, 1000));
    expect(pricesMatch(19.99, 20.00)).toBe(pricesMatch(20.00, 19.99));
  });

  it('is true for identical prices, including zero', () => {
    expect(pricesMatch(0, 0)).toBe(true);
    expect(pricesMatch(49.99, 49.99)).toBe(true);
  });

  it('never calls a difference larger than the cap a match, however large the price', () => {
    // The cap is what fixes the high end: without it, 5% of a big number is a
    // big number, and consensus merged genuinely different prices.
    expect(pricesMatch(100000, 100010)).toBe(false);
  });

  it('leaves ordinary mid-range grouping alone', () => {
    // The cap is 5.00, not the 1.00 the issue proposed: 1.00 would also split
    // these, which existing consensus tests rely on and which is legitimate
    // grouping. Above ~20 the relative rule would never apply again.
    expect(pricesMatch(100, 104)).toBe(true);
    expect(pricesMatch(100, 96)).toBe(true);
    expect(pricesMatch(100, 106)).toBe(false);
  });
});
