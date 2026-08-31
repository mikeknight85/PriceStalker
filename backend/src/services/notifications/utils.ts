import { NotificationPayload } from './types';
import { logger } from '../../utils/system/logger';

/**
 * Helper to get currency symbol for display.
 */
export function getCurrencySymbol(currency?: string): string {
  switch (currency) {
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
    case 'SGD': case 'HKD': case 'NZD': case 'CAD': return '$';
    default: return '$';
  }
}

/** "out_of_stock" reads badly in a notification; "Out of stock" does not. */
function formatStockStatus(status?: string): string {
  if (!status) return 'unknown';
  const words = status.replace(/_/g, ' ');
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
 * Default formatter for notification messages.
 */
export function formatDefaultMessage(payload: NotificationPayload): string {
  const currencySymbol = getCurrencySymbol(payload.currency);

  if (payload.type === 'price_drop') {
    const oldPriceStr = payload.oldPrice ? `${currencySymbol}${payload.oldPrice.toFixed(2)}` : 'N/A';
    const newPriceStr = payload.newPrice ? `${currencySymbol}${payload.newPrice.toFixed(2)}` : 'N/A';
    const dropAmount = payload.oldPrice && payload.newPrice
      ? `${currencySymbol}${(payload.oldPrice - payload.newPrice).toFixed(2)}`
      : '';

    return `🔔 Price Drop Alert!\n\n` +
      `📦 ${payload.productName}\n\n` +
      `💰 Price dropped from ${oldPriceStr} to ${newPriceStr}` +
      (dropAmount ? ` (-${dropAmount})` : '') + `\n\n` +
      `🔗 ${payload.productUrl}`;
  }

  if (payload.type === 'target_price') {
    const newPriceStr = payload.newPrice ? `${currencySymbol}${payload.newPrice.toFixed(2)}` : 'N/A';
    const targetPriceStr = payload.targetPrice ? `${currencySymbol}${payload.targetPrice.toFixed(2)}` : 'N/A';

    return `🎯 Target Price Reached!\n\n` +
      `📦 ${payload.productName}\n\n` +
      `💰 Price is now ${newPriceStr} (your target: ${targetPriceStr})\n\n` +
      `🔗 ${payload.productUrl}`;
  }

  if (payload.type === 'back_in_stock') {
    const priceStr = payload.newPrice ? ` at ${currencySymbol}${payload.newPrice.toFixed(2)}` : '';
    return `🎉 Back in Stock!\n\n` +
      `📦 ${payload.productName}\n\n` +
      `✅ This item is now available${priceStr}\n\n` +
      `🔗 ${payload.productUrl}`;
  }

  if (payload.type === 'not_available') {
    return `⚠️ Product Unavailable\n\n` +
      `📦 ${payload.productName}\n\n` +
      `❌ Page no longer exists (404/410).\n` +
      `⏸️ Monitoring has been paused.\n\n` +
      `🔗 ${payload.productUrl}`;
  }

  return '';
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

export function getNotificationContent(payload: NotificationPayload, template?: string | null): { title: string, message: string } {
  if (template) {
    const title = payload.type === 'price_drop' ? 'Price Drop Alert!' : 
                  payload.type === 'target_price' ? 'Target Price Reached!' : 
                  payload.type === 'not_available' ? 'Product Unavailable' : 'Back in Stock!';
    const message = interpolateTemplate(template, payload);
    return { title, message };
  }

  const currencySymbol = getCurrencySymbol(payload.currency);
  let title = '';
  let message = '';

  if (payload.type === 'price_drop') {
    const oldPriceStr = payload.oldPrice ? `${currencySymbol}${payload.oldPrice.toFixed(2)}` : 'N/A';
    const newPriceStr = payload.newPrice ? `${currencySymbol}${payload.newPrice.toFixed(2)}` : 'N/A';
    title = 'Price Drop Alert!';
    message = `${payload.productName}\n\nPrice dropped from ${oldPriceStr} to ${newPriceStr}`;
  } else if (payload.type === 'target_price') {
    const newPriceStr = payload.newPrice ? `${currencySymbol}${payload.newPrice.toFixed(2)}` : 'N/A';
    const targetPriceStr = payload.targetPrice ? `${currencySymbol}${payload.targetPrice.toFixed(2)}` : 'N/A';
    title = 'Target Price Reached!';
    message = `${payload.productName}\n\nPrice is now ${newPriceStr} (your target: ${targetPriceStr})`;
  } else if (payload.type === 'not_available') {
    title = 'Product Unavailable';
    message = `${payload.productName}\n\nThis product is no longer available (404/410) and monitoring has been paused.`;
  } else {
    const priceStr = payload.newPrice ? ` at ${currencySymbol}${payload.newPrice.toFixed(2)}` : '';
    title = 'Back in Stock!';
    message = `${payload.productName}\n\nThis item is now available${priceStr}`;
  }

  return { title, message };
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
        body: '{{product_name}} is available again.\n\nCurrent price: {{current_price}} {{currency}}\n\n{{product_url}}',
      };
    case 'not_available':
      return {
        subject: 'Unavailable: {{product_name}}',
        body: '{{product_name}} could not be reached.\n\n{{product_url}}',
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
