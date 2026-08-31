import { describe, it, expect } from 'vitest';
import { buildDetailChips } from './detailChips';

/**
 * The backend records why a product could not be read, what it did about it,
 * and which way the stock status moved. None of it reached the screen, so an
 * unavailable row read as a generic label while its own data held the
 * explanation (issue #93).
 */

describe('buildDetailChips', () => {
  it('shows the stock transition, not just the new state', () => {
    // "In stock" alone does not say what changed.
    const chips = buildDetailChips({ oldStockStatus: 'out_of_stock', newStockStatus: 'in_stock' });
    expect(chips).toContainEqual({ label: 'Stock', value: 'out of stock → in stock' });
  });

  it('falls back to the new state alone when there is no previous one', () => {
    expect(buildDetailChips({ newStockStatus: 'member_only' }))
      .toContainEqual({ label: 'Stock', value: 'member only' });
  });

  it('does not render a transition from a state to itself', () => {
    const chips = buildDetailChips({ oldStockStatus: 'in_stock', newStockStatus: 'in_stock' });
    expect(chips).toEqual([{ label: 'Stock', value: 'in stock' }]);
  });

  it('surfaces the reason and the action taken', () => {
    // The two fields that make "Tracking Issue" into something actionable.
    const chips = buildDetailChips({
      reason: 'The retailer did not respond in time',
      action: 'Still Retrying',
    });
    expect(chips).toEqual([
      { label: 'Reason', value: 'The retailer did not respond in time' },
      { label: 'Action', value: 'Still Retrying' },
    ]);
  });

  it('shows a failure count only when something has actually failed', () => {
    // "Failed attempts 0" on every row would bury the rows where it matters.
    expect(buildDetailChips({ failureCount: 3 }))
      .toContainEqual({ label: 'Failed attempts', value: '3' });
    expect(buildDetailChips({ failureCount: 0 })).toEqual([]);
  });

  it('renders nothing for a notification carrying no structured data', () => {
    expect(buildDetailChips(undefined)).toEqual([]);
    expect(buildDetailChips(null)).toEqual([]);
    expect(buildDetailChips({})).toEqual([]);
    expect(buildDetailChips({ productId: 1, productName: 'Widget' })).toEqual([]);
  });

  it('ignores fields of the wrong type rather than rendering "[object Object]"', () => {
    // notification.data is untyped JSON from the database.
    expect(buildDetailChips({ reason: { code: 404 }, failureCount: 'three', action: null })).toEqual([]);
  });

  it('keeps a stable order, so rows do not shuffle their chips', () => {
    const chips = buildDetailChips({
      oldStockStatus: 'in_stock',
      newStockStatus: 'not_available',
      reason: 'The product page returned 404 Not Found',
      action: 'Monitoring Paused',
      failureCount: 3,
    });
    expect(chips.map(c => c.label)).toEqual(['Stock', 'Reason', 'Action', 'Failed attempts']);
  });
});
