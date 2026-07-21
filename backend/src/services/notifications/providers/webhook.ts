import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { logger } from '../../../utils/system/logger';
import { interpolateTemplate } from '../utils';

export class WebhookProvider implements NotificationProvider {
  constructor(
    private webhookUrl: string,
    private headersStr?: string | null,
    private payloadTemplate?: string | null
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    try {
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.headersStr) {
        try {
          headers = { ...headers, ...JSON.parse(this.headersStr) };
        } catch (e) {
          logger.error('Notify | Webhook | Failed to parse headers JSON', 'Notifications', e);
        }
      }

      let body: any;
      if (this.payloadTemplate) {
        try {
          const interpolated = interpolateTemplate(this.payloadTemplate, payload);
          body = JSON.parse(interpolated);
        } catch (e) {
          logger.warn('Notify | Webhook | Failed to parse payload as JSON, sending as string', 'Notifications', e);
          body = interpolateTemplate(this.payloadTemplate, payload);
        }
      } else {
        body = {
          event: payload.type,
          product: payload.productName,
          url: payload.productUrl,
          price: payload.newPrice,
          oldPrice: payload.oldPrice,
          currency: payload.currency || 'USD',
          timestamp: new Date().toISOString()
        };
      }

      await axios.post(this.webhookUrl, body, { headers, timeout: 10000 });
      logger.info(`Notify | Webhook | Sent to ${this.webhookUrl}`, 'Notifications');
      return true;
    } catch (error) {
      logger.error(`Notify | Webhook | Failed: ${error}`, 'Notifications', error);
      return false;
    }
  }
}
