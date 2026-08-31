import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { logger } from '../../../utils/system/logger';
import { interpolateTemplate, getCurrencySymbol } from '../utils';

/**
 * Heading and tags per event type, for the custom-template path.
 *
 * The template branch used a two-way ternary that treated everything which was
 * not a price drop or a target price as "Back in Stock!", so an unavailable
 * product was announced as back in stock.
 */
function headingFor(type: NotificationPayload['type']): { title: string; tags: string[] } {
  switch (type) {
    case 'price_drop':
      return { title: 'Price Drop Alert!', tags: ['moneybag'] };
    case 'target_price':
      return { title: 'Target Price Reached!', tags: ['dart'] };
    case 'not_available':
      return { title: 'Product Unavailable', tags: ['warning'] };
    case 'price_announced':
      return { title: 'Price Announced', tags: ['label'] };
    case 'back_in_stock':
    default:
      return { title: 'Back in Stock!', tags: ['tada'] };
  }
}

export class NtfyProvider implements NotificationProvider {
  constructor(
    private topic: string,
    private serverUrl?: string | null,
    private username?: string | null,
    private password?: string | null,
    private template?: string | null
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    try {
      const currencySymbol = getCurrencySymbol(payload.currency);
      let title: string;
      let message: string;
      let tags: string[];

      if (this.template) {
        ({ title, tags } = headingFor(payload.type));
        message = interpolateTemplate(this.template, payload);
      } else if (payload.type === 'price_drop') {
        const oldPriceStr = payload.oldPrice ? `${currencySymbol}${payload.oldPrice.toFixed(2)}` : 'N/A';
        const newPriceStr = payload.newPrice ? `${currencySymbol}${payload.newPrice.toFixed(2)}` : 'N/A';
        title = 'Price Drop Alert!';
        message = `${payload.productName}\n\nPrice dropped from ${oldPriceStr} to ${newPriceStr}`;
        tags = ['moneybag', 'chart_with_downwards_trend'];
      } else if (payload.type === 'target_price') {
        const newPriceStr = payload.newPrice ? `${currencySymbol}${payload.newPrice.toFixed(2)}` : 'N/A';
        const targetPriceStr = payload.targetPrice ? `${currencySymbol}${payload.targetPrice.toFixed(2)}` : 'N/A';
        title = 'Target Price Reached!';
        message = `${payload.productName}\n\nPrice is now ${newPriceStr} (your target: ${targetPriceStr})`;
        tags = ['dart', 'white_check_mark'];
      } else if (payload.type === 'not_available') {
        // This used to fall through to the back-in-stock branch, so a product
        // that had just become unavailable was announced as back in stock.
        title = 'Product Unavailable';
        message = `${payload.productName}\n\nThis product is no longer available. Monitoring has been paused.`;
        tags = ['warning'];
      } else if (payload.type === 'price_announced') {
        const priceStr = payload.newPrice ? `${currencySymbol}${payload.newPrice.toFixed(2)}` : 'unavailable';
        title = 'Price Announced';
        message = `${payload.productName}\n\nA price is now listed: ${priceStr}`;
        tags = ['label'];
      } else {
        const priceStr = payload.newPrice ? ` at ${currencySymbol}${payload.newPrice.toFixed(2)}` : '';
        title = 'Back in Stock!';
        message = `${payload.productName}\n\nThis item is now available${priceStr}`;
        tags = ['package', 'tada'];
      }

      const baseUrl = this.serverUrl ? this.serverUrl.replace(/\/$/, '') : 'https://ntfy.sh';
      const url = `${baseUrl}/${this.topic}`;

      const headers: Record<string, string> = {
        'Title': title,
        'Tags': tags.join(','),
        'Click': payload.productUrl,
      };

      if (this.username && this.password) {
        const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      await axios.post(url, message, { headers });
      logger.info(`Notify | ntfy | Sent to topic ${this.topic} on ${baseUrl}`, 'Notifications');
      return true;
    } catch (error) {
      logger.error(`Notify | ntfy | Failed: ${error}`, 'Notifications', error);
      return false;
    }
  }
}
