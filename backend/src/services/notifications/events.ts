import { NotificationPayload } from './types';

/**
 * One description of each event, rendered by every provider (issue #92).
 *
 * Each of the seven providers used to carry its own if/else chain over the
 * event type, and every one of them ended in an `else` that meant "back in
 * stock". That was fine while three events existed. Six exist now, so the
 * chains had quietly become wrong in the same way in six places:
 *
 *   - Telegram sent an empty message for `product_restored` and
 *     `price_announced` -- `formatDefaultMessage` returned '', and the Telegram
 *     API rejects an empty `text`, so the notification was never delivered.
 *   - Discord, Pushover, Gotify and ntfy announced `product_restored` as
 *     "Back in Stock!", which is a different claim about a different thing.
 *   - The unavailable wording said "Monitoring has been paused" unconditionally,
 *     including on the transient-failure path that explicitly does not pause.
 *
 * The fix is structural rather than seven parallel patches: the wording lives
 * here once, and `describeEvent` is exhaustive over the union, so adding a
 * seventh event type is a compile error until it has wording. A provider now
 * chooses presentation -- an embed, a header, a priority -- never meaning.
 */

/** Symbols for currencies that have one people actually recognise. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥',
  INR: '₹', KRW: '₩', THB: '฿', ZAR: 'R', BRL: 'R$',
  SEK: 'kr', NOK: 'kr', DKK: 'kr',
  AUD: '$', NZD: '$', CAD: '$', SGD: '$', HKD: '$',
};

/**
 * Formats an amount, or returns null when there is no amount to format.
 *
 * Returning null rather than a string is deliberate: the caller decides what
 * absence reads as, which differs per event. "Back in stock" with no price
 * should not say "back in stock at N/A" -- it should not mention price at all.
 *
 * Zero is a real price. The previous `price ? ... : 'N/A'` guards reported a
 * free item as having no price.
 */
export function formatMoney(amount?: number | null, currency?: string | null): string | null {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return null;

  const value = amount.toFixed(2);
  if (!currency) return value;

  // An unknown currency is shown by its ISO code, never dressed as dollars.
  // The template path stopped inventing USD when unresolved currencies moved to
  // manual confirmation; the default-message path was still doing it.
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()];
  return symbol ? `${symbol}${value}` : `${currency} ${value}`;
}

/** "out_of_stock" reads badly in a sentence; "out of stock" does not. */
export function humaniseStockStatus(status?: string | null): string | null {
  if (!status || status === 'unknown') return null;
  return status.replace(/_/g, ' ');
}

export interface EventField {
  name: string;
  value: string;
  inline: boolean;
}

export interface EventPresentation {
  /** Heading: in-app title, Discord embed title, ntfy Title header. */
  title: string;
  /** Prefix for the channels that already carry one. Never the whole meaning. */
  emoji: string;
  /** One line saying what happened. */
  headline: string;
  /** Optional second line: the consequence, or what happens next. */
  detail?: string;
  /** ntfy tag names. */
  tags: string[];
  /** Discord embed colour. */
  color: number;
  /** Structured summary, for Discord embeds and the webhook payload. */
  fields: EventField[];
}

/**
 * " at Digitec", or nothing.
 *
 * Only populated when the product is tracked at more than one store, so a
 * single-store alert reads exactly as it did before this existed.
 */
function atStore(payload: NotificationPayload): string {
  return payload.storeName ? ` at ${payload.storeName}` : '';
}

export function describeEvent(payload: NotificationPayload): EventPresentation {
  const price = formatMoney(payload.newPrice, payload.currency);
  const previous = humaniseStockStatus(payload.oldStockStatus);
  const store = atStore(payload);

  switch (payload.type) {
    case 'price_drop': {
      const oldPrice = formatMoney(payload.oldPrice, payload.currency);
      const drop = payload.oldPrice !== undefined && payload.newPrice !== undefined
        ? formatMoney(payload.oldPrice - payload.newPrice, payload.currency)
        : null;

      return {
        title: 'Price Drop Alert!',
        emoji: '🔔',
        headline: oldPrice && price
          ? `Price dropped from ${oldPrice} to ${price}${drop ? ` (-${drop})` : ''}${store}`
          : `The price has dropped${store}`,
        tags: ['moneybag', 'chart_with_downwards_trend'],
        color: 0x10b981,
        fields: [
          { name: 'Old Price', value: oldPrice ?? 'unknown', inline: true },
          { name: 'New Price', value: price ?? 'unknown', inline: true },
        ],
      };
    }

    case 'target_price': {
      const target = formatMoney(payload.targetPrice, payload.currency);
      return {
        title: 'Target Price Reached!',
        emoji: '🎯',
        headline: price && target
          ? `Price is now ${price}${store}, at or below your target of ${target}`
          : `The price reached your target${store}`,
        tags: ['dart', 'white_check_mark'],
        color: 0xf59e0b,
        fields: [
          { name: 'Current Price', value: price ?? 'unknown', inline: true },
          { name: 'Your Target', value: target ?? 'unknown', inline: true },
        ],
      };
    }

    case 'back_in_stock':
      return {
        title: 'Back in Stock!',
        emoji: '🎉',
        // A product can come back in stock before a price is extracted. Saying
        // "available at N/A" is worse than not mentioning price.
        // "available at Digitec for CHF 49.90" rather than two "at"s.
        headline: price
          ? `This item is now available${store ? `${store} for ${price}` : ` at ${price}`}`
          : `This item is now available${store}`,
        detail: previous ? `Previously ${previous}.` : undefined,
        tags: ['package', 'tada'],
        color: 0x6366f1,
        fields: [
          { name: 'Price', value: price ?? 'not listed', inline: true },
          { name: 'Status', value: 'Available', inline: true },
        ],
      };

    case 'price_announced':
      return {
        title: 'Price Announced',
        emoji: '🏷️',
        headline: price
          ? `A price has been announced${store}: ${price}`
          : `A price has been announced${store}`,
        tags: ['label'],
        color: 0x3b82f6,
        fields: [{ name: 'Price', value: price ?? 'unknown', inline: true }],
      };

    case 'not_available': {
      // The reason and the consequence both travel on the payload now. They
      // were hardcoded to "404/410" and "Monitoring has been paused", so a
      // timeout was reported as a dead page, and the transient-failure path --
      // which deliberately keeps retrying -- told the user monitoring had
      // stopped when it had not.
      const reason = payload.reason || 'The product page could not be read';
      const paused = payload.paused !== false;
      return {
        title: 'Product Unavailable',
        emoji: '⚠️',
        headline: reason,
        detail: paused
          ? 'Monitoring has been paused. You can resume it from the dashboard.'
          : 'Still retrying.',
        tags: ['warning'],
        color: 0x6b7280,
        fields: [
          { name: 'Reason', value: reason, inline: true },
          { name: 'Action', value: paused ? 'Monitoring paused' : 'Still retrying', inline: true },
        ],
      };
    }

    case 'product_restored':
      return {
        title: 'Available Again',
        emoji: '✅',
        headline: 'The product page is reachable again',
        detail: 'Monitoring has resumed.',
        tags: ['white_check_mark'],
        color: 0x10b981,
        fields: [{ name: 'Action', value: 'Monitoring resumed', inline: true }],
      };

    default: {
      // Exhaustiveness. Adding an event type without wording for it fails the
      // build here rather than shipping as a silent "Back in Stock!".
      const unhandled: never = payload.type;
      throw new Error(`Notification event type has no wording: ${String(unhandled)}`);
    }
  }
}

/**
 * The plain-text body every channel that sends prose starts from.
 *
 * Providers add their own furniture -- a URL line, an emoji prefix, an embed --
 * but the sentences describing the event are the same everywhere.
 */
export function eventBody(payload: NotificationPayload): string {
  const event = describeEvent(payload);
  return [payload.productName, '', event.headline, event.detail]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}
