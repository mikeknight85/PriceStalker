import { NotificationPayload } from './types';
import { logger } from '../../utils/system/logger';
import { describeEvent, eventBody, formatMoney, humaniseStockStatus } from './events';

/**
 * Kept for callers that want a bare symbol.
 *
 * It no longer falls back to '$'. Defaulting an unresolved currency to dollars
 * is how a CHF price arrived in a notification reading "$49.90"; the rest of
 * the app stopped guessing when unresolved currencies moved to manual
 * confirmation, and `formatMoney` shows the ISO code instead.
 */
export function getCurrencySymbol(currency?: string): string {
  switch (currency) {
    case 'USD': case 'AUD': case 'NZD': case 'CAD': case 'SGD': case 'HKD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'CHF': return 'CHF ';
    case 'JPY': case 'CNY': return '¥';
    case 'INR': return '₹';
    case 'KRW': return '₩';
    case 'THB': return '฿';
    case 'ZAR': return 'R';
    case 'BRL': return 'R$';
    case 'SEK': case 'NOK': case 'DKK': return 'kr';
    default: return '';
  }
}

/** "out_of_stock" reads badly in a notification; "Out of stock" does not. */
function formatStockStatus(status?: string): string {
  const words = humaniseStockStatus(status);
  if (!words) return 'unknown';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Simple template engine to replace {{variable}} with real data.
 */
export function interpolateTemplate(template: string, payload: NotificationPayload): string {
  const currencySymbol = getCurrencySymbol(payload.currency);
  
  const variables: Record<string, string> = {
    'product_name': payload.productName,
    'product_url': payload.productUrl,
    'product_id': payload.productId ? String(payload.productId) : 'N/A',
    'current_price': payload.newPrice !== undefined && payload.newPrice !== null
      ? payload.newPrice.toFixed(2)
      : 'unavailable',
    'old_price': payload.oldPrice !== undefined && payload.oldPrice !== null
      ? payload.oldPrice.toFixed(2)
      : 'unavailable',
    // An unknown currency must not masquerade as USD. The rest of the app
    // stopped doing this when unresolved currencies moved to manual
    // confirmation; the notification path was still guessing.
    'currency': payload.currency || '',
    'currency_symbol': currencySymbol,
    'type': payload.type.replace(/_/g, ' '),
    'old_stock_status': formatStockStatus(payload.oldStockStatus),
    'new_stock_status': formatStockStatus(payload.newStockStatus),
    // A price with its currency attached, so a template does not have to
    // assemble one and get the unknown-currency case wrong.
    'price': formatMoney(payload.newPrice, payload.currency) ?? 'unavailable',
    'reason': payload.reason || '',
    // Empty for a single-store product, so a template using it reads naturally
    // either way rather than rendering a stray label.
    'store': payload.storeName || '',
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  
  result = result.replace(/\\n/g, '\n');
  return result;
}

/**
 * The default message for channels that send plain prose (Telegram).
 *
 * This used to be an if/else chain over the event type with no branch for
 * `product_restored` or `price_announced`, falling through to `return ''`.
 * Telegram's API rejects an empty `text`, so those two events were never
 * delivered to Telegram at all -- they were logged as a send failure with no
 * indication that the message itself was the problem.
 */
export function formatDefaultMessage(payload: NotificationPayload): string {
  const event = describeEvent(payload);
  return `${event.emoji} ${event.title}\n\n` +
    `📦 ${payload.productName}\n\n` +
    `${event.headline}` + (event.detail ? `\n${event.detail}` : '') + `\n\n` +
    `🔗 ${payload.productUrl}`;
}

export async function executeProviderRequest(providerName: string, requestFn: () => Promise<void>): Promise<boolean> {
  try {
    await requestFn();
    logger.info(`Notify | ${providerName} | Sent`, 'Notifications');
    return true;
  } catch (error) {
    logger.error(`Notify | ${providerName} | Failed: ${error}`, 'Notifications', error);
    return false;
  }
}

/**
 * Title and body for the channels that send a title/message pair (Pushover,
 * Gotify).
 *
 * The title used to come from a ternary chain whose final branch was
 * 'Back in Stock!', so a restored product and an announced price were both
 * announced as back in stock -- on the custom-template path too, where the
 * user's own wording arrived under a title contradicting it.
 */
export function getNotificationContent(payload: NotificationPayload, template?: string | null): { title: string, message: string } {
  const event = describeEvent(payload);
  return {
    title: event.title,
    message: template ? interpolateTemplate(template, payload) : eventBody(payload),
  };
}

/**
 * Default email wording per event, used only when the user has not configured
 * their own template.
 *
 * The single default was `Product: {{product_name}} / Price: {{current_price}}`
 * for every event, so a back-in-stock alert arrived as a bare price line saying
 * nothing about stock, and an unavailable alert reported a price for a product
 * that could not be reached (issue #92).
 *
 * A user's own template is never overridden -- it is their choice, and the
 * variables to make one event-aware (`{{type}}`, `{{new_stock_status}}`) now
 * exist for exactly that.
 */
export function defaultEmailTemplate(type: NotificationPayload['type']): { subject: string; body: string } {
  switch (type) {
    case 'price_drop':
      return {
        subject: 'Price drop: {{product_name}}',
        body: '{{product_name}} dropped from {{old_price}} to {{current_price}} {{currency}}.\n\n{{product_url}}',
      };
    case 'target_price':
      return {
        subject: 'Target price reached: {{product_name}}',
        body: '{{product_name}} is now {{current_price}} {{currency}}, at or below your target.\n\n{{product_url}}',
      };
    case 'price_announced':
      return {
        subject: 'Price announced: {{product_name}}',
        body: '{{product_name}} now has a price: {{current_price}} {{currency}}.\n\n{{product_url}}',
      };
    case 'back_in_stock':
      return {
        subject: 'Back in stock: {{product_name}}',
        body: '{{product_name}} is available again.\n\nCurrent price: {{price}}\n\n{{product_url}}',
      };
    case 'not_available':
      return {
        subject: 'Unavailable: {{product_name}}',
        body: '{{product_name}} could not be read.\n\n{{reason}}\n\n{{product_url}}',
      };
    case 'product_restored':
      return {
        subject: 'Available again: {{product_name}}',
        body: '{{product_name}} is reachable again and monitoring has resumed.\n\n{{product_url}}',
      };
    default:
      return {
        subject: 'PriceStalker alert: {{product_name}}',
        body: '{{product_name}}\n\n{{product_url}}',
      };
  }
}
