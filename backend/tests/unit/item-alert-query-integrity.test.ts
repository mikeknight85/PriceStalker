import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * AGENTS.md Invariant:
 * "Alert settings live on the item, not the listing: target_price,
 * price_drop_threshold and notify_back_in_stock describe what the user wants...
 * Any query returning a product for code that reads those fields must join through
 * ITEM_ALERT_COLUMNS / ITEM_ALERT_JOIN and map rows with withItemAlertSettings
 * (repositories/item-alert-settings.ts)."
 */
describe('Item Alert Architecture Invariants', () => {
  const repoDir = path.resolve(__dirname, '../../src/services/domain/product/repositories');

  it('product-core.repository includes ITEM_ALERT_COLUMNS and ITEM_ALERT_JOIN in queries that read product alert fields', () => {
    const file = fs.readFileSync(path.join(repoDir, 'product-core.repository.ts'), 'utf8');
    expect(file).toContain('ITEM_ALERT_COLUMNS');
    expect(file).toContain('ITEM_ALERT_JOIN');
    expect(file).toContain('withItemAlertSettings');
  });

  it('product-lookup.repository includes ITEM_ALERT_COLUMNS and ITEM_ALERT_JOIN in findDueForRefresh', () => {
    const file = fs.readFileSync(path.join(repoDir, 'product-lookup.repository.ts'), 'utf8');
    expect(file).toContain('ITEM_ALERT_COLUMNS');
    expect(file).toContain('ITEM_ALERT_JOIN');
    expect(file).toContain('asProductWithItemAlerts');
  });

  it('product-dashboard.repository includes ITEM_ALERT_COLUMNS and ITEM_ALERT_JOIN in findDashboardProducts', () => {
    const file = fs.readFileSync(path.join(repoDir, 'product-dashboard.repository.ts'), 'utf8');
    expect(file).toContain('ITEM_ALERT_COLUMNS');
    expect(file).toContain('ITEM_ALERT_JOIN');
    expect(file).toContain('withItemAlertSettings');
  });
});
