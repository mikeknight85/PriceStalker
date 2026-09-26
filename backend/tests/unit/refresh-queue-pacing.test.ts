import { describe, it, expect, vi } from 'vitest';
import {
  interleaveByRetailer,
  refreshQueueDomain,
} from '../../src/services/domain/product/repositories/product-lookup.repository';
import { createDomainPacer } from '../../src/services/scheduler/tasks/PriceCheckTask';

/**
 * `findDueForRefresh()` had no `ORDER BY` at all, so Postgres returned the heap
 * order -- and that is worse than random. Products added in one sitting share a
 * retailer, sit adjacent in the heap and carry the same default refresh
 * interval, so they come due together and arrive as a block. `PriceCheckTask`
 * then fires the first three of that block concurrently through `pLimit(3)`:
 * three simultaneous requests to one shop.
 *
 * Measured against Akamai on target.com.au (issue #67): three requests 800ms
 * apart were served the product page and the fourth was denied. The denial
 * follows the client, degrades with volume and recovers with silence, so what
 * matters is the shape of the burst.
 */

const at = (domain: string, n: number) => ({ id: n, url: `https://www.${domain}/p/item-${n}` });

describe('refreshQueueDomain', () => {
  it.each([
    ['https://www.target.com.au/p/thing/1', 'target.com.au'],
    ['https://target.com.au/p/thing/1', 'target.com.au'],
    ['https://WWW.TARGET.COM.AU/p/thing/1', 'target.com.au'],
    ['http://kmart.com.au/product/x/2', 'kmart.com.au'],
    ['https://shop.example.com:8443/p/3', 'shop.example.com'],
  ])('%s -> %s', (url, expected) => {
    expect(refreshQueueDomain(url)).toBe(expected);
  });

  it('groups www and bare hosts together, so one shop is one group', () => {
    expect(refreshQueueDomain('https://www.target.com.au/a'))
      .toBe(refreshQueueDomain('https://target.com.au/b'));
  });

  it('does not throw on a URL it cannot parse', () => {
    expect(refreshQueueDomain('not a url')).toBe('not a url');
  });
});

describe('the due queue interleaves retailers', () => {
  it('breaks up a bulk add at one retailer', () => {
    // Eight listings at one shop and two at another: exactly the shape a bulk
    // add produces, and the shape that used to arrive as a block.
    const due = [
      at('target.com.au', 1), at('target.com.au', 2), at('target.com.au', 3),
      at('target.com.au', 4), at('kmart.com.au', 5), at('kmart.com.au', 6),
      at('example.com', 7),
    ];

    const order = interleaveByRetailer(due).map(p => refreshQueueDomain(p.url));

    // The first three -- the ones pLimit(3) starts together -- are three
    // different shops. That is the whole point.
    expect(new Set(order.slice(0, 3)).size).toBe(3);
    expect(order.slice(0, 3)).toEqual(['target.com.au', 'kmart.com.au', 'example.com']);
  });

  it('never puts two listings from the same retailer next to each other while another is waiting', () => {
    const due = [
      at('target.com.au', 1), at('target.com.au', 2), at('target.com.au', 3),
      at('kmart.com.au', 4), at('kmart.com.au', 5), at('kmart.com.au', 6),
    ];

    const order = interleaveByRetailer(due).map(p => refreshQueueDomain(p.url));
    expect(order).toEqual([
      'target.com.au', 'kmart.com.au',
      'target.com.au', 'kmart.com.au',
      'target.com.au', 'kmart.com.au',
    ]);
  });

  it('keeps every product exactly once', () => {
    const due = [
      at('a.com', 1), at('b.com', 2), at('a.com', 3), at('c.com', 4),
      at('a.com', 5), at('b.com', 6), at('a.com', 7),
    ];
    const ids = interleaveByRetailer(due).map(p => p.id);
    expect(ids.length).toBe(due.length);
    expect(new Set(ids).size).toBe(due.length);
    expect([...ids].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('preserves each retailer own order, so the query ORDER BY still decides priority', () => {
    // Within a shop, the longest-waiting product must still go first.
    const due = [at('a.com', 1), at('a.com', 2), at('b.com', 3), at('a.com', 4)];
    const aIds = interleaveByRetailer(due).filter(p => p.url.includes('a.com')).map(p => p.id);
    expect(aIds).toEqual([1, 2, 4]);
  });

  it('is deterministic for a given input', () => {
    const due = [at('a.com', 1), at('b.com', 2), at('a.com', 3), at('b.com', 4)];
    expect(interleaveByRetailer(due)).toEqual(interleaveByRetailer(due));
  });

  it.each([
    ['an empty queue', []],
    ['a single product', [at('a.com', 1)]],
  ])('handles %s', (_label, due) => {
    expect(interleaveByRetailer(due)).toEqual(due);
  });

  it('leaves a single-retailer queue in its query order', () => {
    // Nothing to interleave with; the pacer below is what protects this case.
    const due = [at('a.com', 1), at('a.com', 2), at('a.com', 3)];
    expect(interleaveByRetailer(due).map(p => p.id)).toEqual([1, 2, 3]);
  });
});

describe('the per-domain pacer', () => {
  it('serialises one retailer and spaces its requests out', async () => {
    const pace = createDomainPacer(40, 0);
    const starts: number[] = [];
    let concurrent = 0;
    let peak = 0;

    const task = () => async () => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      starts.push(Date.now());
      await new Promise(resolve => setTimeout(resolve, 5));
      concurrent--;
    };

    const begin = Date.now();
    await Promise.all([
      pace('target.com.au', task()),
      pace('target.com.au', task()),
      pace('target.com.au', task()),
    ]);

    // Never two at once against one shop, which pLimit(3) alone allowed.
    expect(peak).toBe(1);
    expect(starts.length).toBe(3);
    // The first goes straight out; each one after it waits out the gap.
    expect(starts[0] - begin).toBeLessThan(40);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(35);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(35);
  });

  it('lets different retailers run at the same time', async () => {
    const pace = createDomainPacer(500, 0);
    const started: string[] = [];

    const task = (domain: string) => async () => {
      started.push(domain);
      await new Promise(resolve => setTimeout(resolve, 5));
    };

    const begin = Date.now();
    await Promise.all([
      pace('a.com', task('a.com')),
      pace('b.com', task('b.com')),
      pace('c.com', task('c.com')),
    ]);

    // One shop's gap must never hold up another shop: three different domains
    // all go out immediately, well inside the 500ms per-domain gap.
    expect(started.sort()).toEqual(['a.com', 'b.com', 'c.com']);
    expect(Date.now() - begin).toBeLessThan(400);
  });

  it('adds jitter on top of the gap rather than a fixed cadence', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const pace = createDomainPacer(10, 40);
    const starts: number[] = [];
    const task = () => async () => { starts.push(Date.now()); };

    await Promise.all([pace('a.com', task()), pace('a.com', task())]);

    expect(random).toHaveBeenCalled();
    // 10ms gap + 0.5 * 40ms jitter.
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(25);
    random.mockRestore();
  });

  it('keeps the queue moving when one product throws', async () => {
    // A thrown refresh must not stall the rest of that retailer's queue, nor
    // reject the sweep.
    const pace = createDomainPacer(1, 0);
    const ran: number[] = [];
    await Promise.all([
      pace('a.com', async () => { ran.push(1); throw new Error('refresh blew up'); }),
      pace('a.com', async () => { ran.push(2); }),
      pace('a.com', async () => { ran.push(3); }),
    ]);
    expect(ran).toEqual([1, 2, 3]);
  });
});
