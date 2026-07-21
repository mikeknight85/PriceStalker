import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { logger } from '../../../utils/system/logger';
import { interpolateTemplate, getCurrencySymbol } from '../utils';

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
        title = payload.type === 'price_drop' ? 'Price Drop Alert!' : payload.type === 'target_price' ? 'Target Price Reached!' : 'Back in Stock!';
        message = interpolateTemplate(this.template, payload);
        tags = payload.type === 'price_drop' ? ['moneybag'] : payload.type === 'target_price' ? ['dart'] : ['tada'];
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
