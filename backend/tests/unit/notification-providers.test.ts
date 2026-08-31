import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: { post: vi.fn().mockResolvedValue({ status: 200, data: {} }) },
}));

const sentMail: any[] = [];
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (mail: any) => { sentMail.push(mail); return {}; },
    }),
  },
}));

import axios from 'axios';
import type { NotificationPayload } from '../../src/services/notifications/types';
import { NOTIFICATION_EVENT_TYPES } from '../../src/models/types/notification';
import { describeEvent, formatMoney } from '../../src/services/notifications/events';
import { DiscordProvider } from '../../src/services/notifications/providers/discord';
import { TelegramProvider } from '../../src/services/notifications/providers/telegram';
import { PushoverProvider } from '../../src/services/notifications/providers/pushover';
import { NtfyProvider } from '../../src/services/notifications/providers/ntfy';
import { GotifyProvider } from '../../src/services/notifications/providers/gotify';
import { WebhookProvider } from '../../src/services/notifications/providers/webhook';
import { EmailProvider } from '../../src/services/notifications/providers/email';

/**
 * Every provider carried its own if/else over the event type, and every chain
 * ended in an `else` meaning "back in stock". Six event types exist, so the
 * chains were wrong in the same way in seven places (issue #92).
 *
 * These tests run the whole matrix -- each provider against each event -- so a
 * provider that stops covering an event fails here rather than announcing a
 * dead product as back in stock in someone's Telegram.
 */

const post = axios.post as unknown as ReturnType<typeof vi.fn>;

const base: NotificationPayload = {
  productName: 'Lockere Jersey Boxershorts (3er Pack)',
  productUrl: 'https://shop.example.com/p/1',
  type: 'back_in_stock',
  productId: 409,
};

/** Every provider, driven through one uniform call. */
const PROVIDERS: { name: string; send: (p: NotificationPayload, tpl?: string | null) => Promise<boolean> }[] = [
  { name: 'telegram', send: (p, t) => new TelegramProvider('tok', 'chat', t).send(p) },
  { name: 'discord', send: (p, t) => new DiscordProvider('https://discord.example/hook', t).send(p) },
  { name: 'pushover', send: (p, t) => new PushoverProvider('user', 'app', t).send(p) },
  { name: 'ntfy', send: (p, t) => new NtfyProvider('topic', null, null, null, t).send(p) },
  { name: 'gotify', send: (p, t) => new GotifyProvider('https://gotify.example', 'tok', t).send(p) },
  { name: 'webhook', send: (p, t) => new WebhookProvider('https://hook.example', null, t).send(p) },
];

/** Everything a provider put on the wire, as one searchable string. */
function wireText(): string {
  const bodies = post.mock.calls.map(call => JSON.stringify(call[1] ?? ''));
  const headers = post.mock.calls.map(call => JSON.stringify(call[2]?.headers ?? {}));
  return [...bodies, ...headers, ...sentMail.map(m => JSON.stringify(m))].join('\n');
}

beforeEach(() => {
  post.mockClear();
  sentMail.length = 0;
});

describe('every provider covers every event', () => {
  for (const type of NOTIFICATION_EVENT_TYPES) {
    describe(type, () => {
      const payload: NotificationPayload = { ...base, type, newPrice: 19.99, currency: 'CHF' };

      for (const provider of PROVIDERS) {
        it(`${provider.name} sends something non-empty`, async () => {
          // Telegram rejects an empty `text` with a 400. formatDefaultMessage
          // returned '' for product_restored and price_announced, so those two
          // events were never delivered to Telegram at all.
          await expect(provider.send(payload)).resolves.toBe(true);
          expect(post).toHaveBeenCalledTimes(1);

          const body = JSON.stringify(post.mock.calls[0][1] ?? '');
          expect(body.length).toBeGreaterThan(2);
          expect(body).toContain('Boxershorts');
        });

        if (type !== 'back_in_stock') {
          it(`${provider.name} does not call it back in stock`, async () => {
            await provider.send(payload);
            expect(wireText().toLowerCase()).not.toContain('back in stock');
          });
        }
      }

      it('email sends a subject and body that name the event', async () => {
        await new EmailProvider('smtp.example', 25, 'a@example.com', 'b@example.com', null, null).send(payload);
        expect(sentMail).toHaveLength(1);
        expect(sentMail[0].subject).toBeTruthy();
        expect(sentMail[0].text).toBeTruthy();
        if (type !== 'back_in_stock') {
          expect(`${sentMail[0].subject} ${sentMail[0].text}`.toLowerCase()).not.toContain('back in stock');
        }
      });
    });
  }
});

describe('back in stock, across the cases the issue lists', () => {
  const cases: { label: string; payload: NotificationPayload }[] = [
    { label: 'a valid price', payload: { ...base, newPrice: 49.99, currency: 'AUD' } },
    { label: 'no price at all', payload: { ...base } },
    { label: 'a price of zero', payload: { ...base, newPrice: 0, currency: 'EUR' } },
    { label: 'a currency with no symbol', payload: { ...base, newPrice: 49.99, currency: 'CHF' } },
    { label: 'a price but no currency', payload: { ...base, newPrice: 49.99 } },
    { label: 'previously out_of_stock', payload: { ...base, newPrice: 5, currency: 'EUR', oldStockStatus: 'out_of_stock' } },
    { label: 'previously pre_order', payload: { ...base, newPrice: 5, currency: 'EUR', oldStockStatus: 'pre_order' } },
    { label: 'previously not_available', payload: { ...base, newPrice: 5, currency: 'EUR', oldStockStatus: 'not_available' } },
    { label: 'previously member_only', payload: { ...base, newPrice: 5, currency: 'EUR', oldStockStatus: 'member_only' } },
  ];

  for (const { label, payload } of cases) {
    for (const provider of PROVIDERS) {
      it(`${provider.name} with ${label} contains no undefined and invents no currency`, async () => {
        await provider.send(payload);
        const wire = wireText();

        // "Product is back in stock at undefined USD" -- the report that
        // opened the issue.
        expect(wire).not.toContain('undefined');
        expect(wire).not.toContain('NaN');

        // An unknown or non-dollar currency must never render as dollars.
        if (payload.currency && payload.currency !== 'AUD') {
          expect(wire).not.toMatch(/\$\d/);
        }
        if (!payload.currency && payload.newPrice !== undefined) {
          expect(wire).not.toMatch(/[$€£]\s?\d/);
        }
      });
    }
  }
});

describe('an unavailable alert says what actually happened', () => {
  const payload: NotificationPayload = {
    ...base,
    type: 'not_available',
    reason: 'The request timed out',
    paused: false,
  };

  for (const provider of PROVIDERS) {
    it(`${provider.name} does not claim monitoring stopped when it has not`, async () => {
      // The transient-failure path notifies with paused=false and keeps
      // retrying. Every channel used to say "Monitoring has been paused"
      // regardless, and reported the cause as a 404 whatever it was.
      await provider.send(payload);
      const wire = wireText();
      expect(wire.toLowerCase()).not.toContain('monitoring has been paused');
      expect(wire).not.toContain('404');
    });
  }

  it('carries the real reason rather than a hardcoded one', async () => {
    await new NtfyProvider('topic', null, null, null, null).send(payload);
    expect(wireText()).toContain('The request timed out');
  });

  it('does say monitoring stopped when it has', async () => {
    await new NtfyProvider('topic', null, null, null, null).send({ ...payload, paused: true });
    expect(wireText().toLowerCase()).toContain('monitoring has been paused');
  });
});

describe('a custom template still gets the right heading', () => {
  // A template replaces the body the user writes, not the heading their client
  // shows in the notification tray -- which was 'Back in Stock!' for every
  // event that was not a price drop or a target price.
  for (const provider of PROVIDERS) {
    it(`${provider.name} does not head a restored product with "Back in Stock"`, async () => {
      await provider.send({ ...base, type: 'product_restored' }, '{{product_name}} update');
      expect(wireText().toLowerCase()).not.toContain('back in stock');
    });
  }
});

describe('the webhook payload is machine-readable', () => {
  it('carries the stock transition, not just the event name', async () => {
    await new WebhookProvider('https://hook.example').send({
      ...base, newPrice: 49.99, currency: 'AUD', oldStockStatus: 'out_of_stock', newStockStatus: 'in_stock',
    });
    expect(post.mock.calls[0][1]).toMatchObject({
      event: 'back_in_stock',
      price: 49.99,
      currency: 'AUD',
      oldStockStatus: 'out_of_stock',
      newStockStatus: 'in_stock',
    });
  });

  it('reports an unresolved currency as null rather than USD', async () => {
    // A wrong value is worse than an absent one for something being parsed.
    await new WebhookProvider('https://hook.example').send({ ...base, newPrice: 49.99 });
    expect((post.mock.calls[0][1] as any).currency).toBeNull();
  });
});

describe('formatMoney', () => {
  it('uses a symbol where one is recognised', () => {
    expect(formatMoney(19.9, 'EUR')).toBe('€19.90');
    expect(formatMoney(19.9, 'GBP')).toBe('£19.90');
  });

  it('uses the ISO code where none is', () => {
    expect(formatMoney(19.9, 'CHF')).toBe('CHF 19.90');
    expect(formatMoney(19.9, 'PLN')).toBe('PLN 19.90');
  });

  it('returns null for a missing amount, so callers can omit price entirely', () => {
    expect(formatMoney(undefined, 'EUR')).toBeNull();
    expect(formatMoney(null, 'EUR')).toBeNull();
  });

  it('treats zero as a real price', () => {
    expect(formatMoney(0, 'EUR')).toBe('€0.00');
  });

  it('omits the currency rather than guessing one', () => {
    expect(formatMoney(19.9)).toBe('19.90');
  });
});

describe('describeEvent', () => {
  it('gives every event its own title', () => {
    const titles = NOTIFICATION_EVENT_TYPES.map(type => describeEvent({ ...base, type }).title);
    expect(new Set(titles).size).toBe(NOTIFICATION_EVENT_TYPES.length);
  });

  it('does not mention price when there is none', () => {
    const event = describeEvent({ ...base, type: 'back_in_stock' });
    expect(event.headline).toBe('This item is now available');
  });

  it('names the previous status when one is known', () => {
    const event = describeEvent({ ...base, oldStockStatus: 'member_only' });
    expect(event.detail).toBe('Previously member only.');
  });

  it('says nothing about a previous status of unknown', () => {
    expect(describeEvent({ ...base, oldStockStatus: 'unknown' }).detail).toBeUndefined();
  });
});

describe('Telegram and product names containing markup characters', () => {
  it('does not send the default message as HTML', async () => {
    // Telegram rejects unescaped &, < and > in HTML parse mode with a 400, so
    // every alert for a product named like this silently failed to arrive.
    await new TelegramProvider('tok', 'chat').send({
      ...base, productName: 'Sony WH-1000XM5 <Black> & Case',
    });
    const body = post.mock.calls[0][1] as any;
    expect(body.parse_mode).toBeUndefined();
    expect(body.text).toContain('Sony WH-1000XM5 <Black> & Case');
  });

  it('still honours HTML in a custom template, which is the user’s choice', async () => {
    await new TelegramProvider('tok', 'chat', '<b>{{product_name}}</b>').send(base);
    expect((post.mock.calls[0][1] as any).parse_mode).toBe('HTML');
  });
});
