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

      let body: unknown;
      if (this.payloadTemplate) {
        try {
          body = JSON.parse(interpolateTemplate(this.payloadTemplate, payload, { json: true }));
        } catch (e) {
          // Values are escaped, so reaching here means the template itself is
          // not valid JSON. Posting the raw string as application/json used to
          // hand the receiver a body it could only reject.
          logger.error('Notify | Webhook | Payload template is not valid JSON, not sending', 'Notifications', e);
          return false;
        }
      } else {
        // The default payload carried `event: back_in_stock` with nothing else
        // about stock, so a receiver could not tell what the item had come back
        // *from*, and it reported `currency: 'USD'` for products whose currency
        // was never resolved -- a wrong value is worse than an absent one for a
        // consumer parsing this.
        body = {
          event: payload.type,
          product: payload.productName,
          productId: payload.productId,
          url: payload.productUrl,
          price: payload.newPrice ?? null,
          oldPrice: payload.oldPrice ?? null,
          targetPrice: payload.targetPrice ?? null,
          currency: payload.currency ?? null,
          oldStockStatus: payload.oldStockStatus ?? null,
          newStockStatus: payload.newStockStatus ?? null,
          reason: payload.reason ?? null,
          paused: payload.paused ?? null,
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
