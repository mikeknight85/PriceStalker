/**
 * Re-exported from the shared module: Settings and Admin configure the *default*
 * interval from the same list, and neither should import out of this feature
 * (issue #239).
 */
export { REFRESH_INTERVALS } from '../../utils/refreshInterval';

export const STOCK_COLORS: Record<string, string> = {
  'In Stock': '#10b981',
  'Out of Stock': '#ef4444',
  'Pre-Order': '#f59e0b',
  'Not Available': '#64748b',
  'Member Only': '#8b5cf6',
  'Unknown': '#94a3b8',
};
