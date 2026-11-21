export interface TimelineSegment {
  status: string;
  startPercent: number;
  widthPercent: number;
}

export interface FlatStockEvent {
  id: string | number;
  productId: number;
  storeName: string;
  storeUrl: string;
  status: string;
  recordedAt: string;
}

export function isAvailableStatus(status?: string): boolean {
  if (!status) return false;
  return status === 'in_stock' || status === 'pre_order' || status === 'member_only';
}

export function formatStatusLabel(status?: string): string {
  switch (status) {
    case 'in_stock':
      return 'In Stock';
    case 'out_of_stock':
      return 'Out of Stock';
    case 'pre_order':
      return 'Pre-Order';
    case 'member_only':
      return 'Member Only';
    case 'not_available':
      return 'Unavailable';
    case 'unknown':
      return 'Unknown';
    default:
      return status ? status.replace(/_/g, ' ') : 'Unknown';
  }
}

/**
 * Computes percentage-based timeline segments for a single store over `days`
 */
export function computeStoreSegments(
  history: any[] | undefined,
  days: number = 30,
  fallbackStatus: string = 'in_stock'
): TimelineSegment[] {
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const totalMs = now.getTime() - periodStart.getTime();

  if (!history || history.length === 0) {
    return [{ status: fallbackStatus || 'in_stock', startPercent: 0, widthPercent: 100 }];
  }

  const sorted = [...history].sort((a, b) => {
    const tA = new Date(a.recorded_at || a.changed_at || 0).getTime();
    const tB = new Date(b.recorded_at || b.changed_at || 0).getTime();
    return tA - tB;
  });

  const segments: TimelineSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const entryTime = new Date(entry.recorded_at || entry.changed_at || now);
    const nextEntry = sorted[i + 1];
    const nextTime = nextEntry ? new Date(nextEntry.recorded_at || nextEntry.changed_at || now) : now;

    const segmentStart = entryTime < periodStart ? periodStart : entryTime;
    const segmentEnd = nextTime;

    if (segmentEnd <= periodStart) continue;

    const startPercent = ((segmentStart.getTime() - periodStart.getTime()) / totalMs) * 100;
    const widthPercent = ((segmentEnd.getTime() - segmentStart.getTime()) / totalMs) * 100;

    segments.push({
      status: entry.stock_status || entry.status || fallbackStatus,
      startPercent: Math.max(0, startPercent),
      widthPercent: Math.min(100 - startPercent, widthPercent),
    });
  }

  if (segments.length === 0) {
    return [{ status: fallbackStatus || 'in_stock', startPercent: 0, widthPercent: 100 }];
  }

  if (segments[0].startPercent > 0) {
    segments.unshift({
      status: segments[0].status,
      startPercent: 0,
      widthPercent: segments[0].startPercent,
    });
  }

  return segments;
}

/**
 * Computes the unified combined product availability timeline
 * (In stock if ANY store has stock at time t, Out of stock if ALL stores are out of stock)
 */
export function computeCombinedSegments(
  storeTimelines: Array<{ segments: TimelineSegment[] }>
): TimelineSegment[] {
  if (storeTimelines.length === 0) {
    return [{ status: 'unknown', startPercent: 0, widthPercent: 100 }];
  }

  // Gather all transition points (percentages between 0 and 100)
  const cuts = new Set<number>([0, 100]);
  storeTimelines.forEach(st => {
    st.segments.forEach(seg => {
      cuts.add(Math.max(0, Math.min(100, seg.startPercent)));
      cuts.add(Math.max(0, Math.min(100, seg.startPercent + seg.widthPercent)));
    });
  });

  const sortedCuts = Array.from(cuts).sort((a, b) => a - b);
  const rawIntervals: TimelineSegment[] = [];

  for (let i = 0; i < sortedCuts.length - 1; i++) {
    const start = sortedCuts[i];
    const end = sortedCuts[i + 1];
    const width = end - start;
    if (width < 0.05) continue;

    const mid = (start + end) / 2;

    // Check availability across all stores at mid
    let anyIn = false;
    let anyPreOrder = false;
    let allOut = true;

    storeTimelines.forEach(st => {
      const activeSeg = st.segments.find(s => mid >= s.startPercent && mid <= s.startPercent + s.widthPercent);
      const status = activeSeg?.status || 'unknown';
      if (status === 'in_stock' || status === 'member_only') {
        anyIn = true;
        allOut = false;
      } else if (status === 'pre_order') {
        anyPreOrder = true;
        allOut = false;
      } else if (status !== 'out_of_stock') {
        allOut = false;
      }
    });

    const combinedStatus = anyIn ? 'in_stock' : anyPreOrder ? 'pre_order' : allOut ? 'out_of_stock' : 'unknown';

    rawIntervals.push({
      status: combinedStatus,
      startPercent: start,
      widthPercent: width,
    });
  }

  // Merge adjacent intervals with matching status
  const merged: TimelineSegment[] = [];
  rawIntervals.forEach(curr => {
    const prev = merged[merged.length - 1];
    if (prev && prev.status === curr.status) {
      prev.widthPercent += curr.widthPercent;
    } else {
      merged.push({ ...curr });
    }
  });

  return merged.length > 0 ? merged : [{ status: 'in_stock', startPercent: 0, widthPercent: 100 }];
}
