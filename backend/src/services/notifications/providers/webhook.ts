import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { logger } from '../../../utils/system/logger';
import { interpolateTemplate } from '../utils';

/**
 * The user's headers, which must be a JSON object of names to values. An array
 * or a bare string used to be accepted and spread into the headers as garbage
 * (`{"0": ..., "1": ...}`).
 */
function parseHeaders(headersStr: string): Record<string, string> {
  const parsed: unknown = JSON.parse(headersStr);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object');
  }
  return Object.fromEntries(Object.entries(parsed).map(([name, value]) => [name, String(value)]));
}

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
        let custom: Record<string, string>;
        try {
          custom = parseHeaders(this.headersStr);
        } catch (e) {
          // Sending anyway meant the request went out without the user's
          // Authorization header and the receiver answered 401, with nothing
          // pointing back at the headers field.
          logger.error('Notify | Webhook | Headers are not a valid JSON object, not sending', 'Notifications', e);
          return false;
        }
        // Header names are case-insensitive, so a user's `content-type` has to
        // replace ours rather than sit beside it.
        const overridden = new Set(Object.keys(custom).map(name => name.toLowerCase()));
        headers = {
          ...Object.fromEntries(Object.entries(headers).filter(([name]) => !overridden.has(name.toLowerCase()))),
          ...custom,
        };
      }

      // The Content-Type decides how a payload template is read. JSON (the
      // default) is parsed and sent as an object; anything else is plain text
      // the user chose to send, so it is sent as written.
      const contentType = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
      const sendsJson = !contentType || /json/i.test(contentType);

      let body: unknown;
      if (this.payloadTemplate && !sendsJson) {
        body = interpolateTemplate(this.payloadTemplate, payload);
      } else if (this.payloadTemplate) {
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
