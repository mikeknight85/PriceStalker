export const REFRESH_INTERVALS = [
  { value: 3600, label: '1 hour' },
  { value: 7200, label: '2 hours' },
  { value: 14400, label: '4 hours' },
  { value: 21600, label: '6 hours' },
  { value: 43200, label: '12 hours' },
  { value: 64800, label: '18 hours' },
  { value: 86400, label: '24 hours' },
];

export const STOCK_COLORS: Record<string, string> = {
  'In Stock': '#10b981',
  'Out of Stock': '#ef4444',
  'Pre-Order': '#f59e0b',
  'Not Available': '#64748b',
  'Member Only': '#8b5cf6',
  'Unknown': '#94a3b8',
};
