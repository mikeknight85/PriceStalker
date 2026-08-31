/**
 * Turns the structured data stored on a notification into the chips shown
 * under its message (issue #93).
 *
 * The backend has always recorded why a product could not be read, what it did
 * about it, and which way the stock status moved. None of it was rendered, so
 * an unavailable row showed a generic label while its own data held the
 * explanation the user needed.
 *
 * Separate from the component so the decisions about what to show -- and what
 * to leave out -- are testable without a DOM.
 */

export interface DetailChip {
  label: string;
  value: string;
}

const humanise = (value: string) => value.replace(/_/g, ' ');

export function buildDetailChips(data: unknown): DetailChip[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;

  const chips: DetailChip[] = [];

  const oldStatus = typeof d.oldStockStatus === 'string' ? d.oldStockStatus : undefined;
  const newStatus = typeof d.newStockStatus === 'string' ? d.newStockStatus : undefined;

  // The transition is the point. "In stock" alone does not say what changed,
  // and the issue asks specifically for the old and new states.
  if (oldStatus && newStatus && oldStatus !== newStatus) {
    chips.push({ label: 'Stock', value: `${humanise(oldStatus)} → ${humanise(newStatus)}` });
  } else if (newStatus) {
    chips.push({ label: 'Stock', value: humanise(newStatus) });
  }

  if (typeof d.reason === 'string' && d.reason) {
    chips.push({ label: 'Reason', value: d.reason });
  }
  if (typeof d.action === 'string' && d.action) {
    chips.push({ label: 'Action', value: d.action });
  }

  // Zero failures is not worth a chip -- it is the normal state, and showing
  // "Failed attempts 0" on every row would bury the rows where it matters.
  if (typeof d.failureCount === 'number' && d.failureCount > 0) {
    chips.push({ label: 'Failed attempts', value: String(d.failureCount) });
  }

  return chips;
}
