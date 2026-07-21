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

/**
 * Simple template engine to replace {{variable}} with real data.
 */
export function interpolateTemplate(template: string, payload: NotificationPayload): string {
  const currencySymbol = getCurrencySymbol(payload.currency);
  
  const variables: Record<string, string> = {
    'product_name': payload.productName,
    'product_url': payload.productUrl,
    'product_id': payload.productId ? String(payload.productId) : 'N/A',
    'current_price': payload.newPrice ? payload.newPrice.toFixed(2) : 'N/A',
    'old_price': payload.oldPrice ? payload.oldPrice.toFixed(2) : 'N/A',
    'currency': payload.currency || 'USD',
    'currency_symbol': currencySymbol,
    'type': payload.type.replace(/_/g, ' '),
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
