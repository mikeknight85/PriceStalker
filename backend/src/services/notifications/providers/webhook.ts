import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { logger } from '../../../utils/system/logger';
import { interpolateTemplate } from '../utils';
import { resolveWebhookHeaders } from '../webhook-headers';

export class WebhookProvider implements NotificationProvider {
  constructor(
    private webhookUrl: string,
    private headersStr?: string | null,
    private payloadTemplate?: string | null
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    try {
      // The Content-Type decides how a payload template is read. JSON (the
      // default) is parsed and sent as an object; anything else is plain text
      // the user chose to send, so it is sent as written. The same rule answers
      // the settings endpoint, which is why it lives in `webhook-headers.ts`.
      let headers: Record<string, string>;
      let sendsJson: boolean;
      try {
        ({ headers, sendsJson } = resolveWebhookHeaders(this.headersStr));
      } catch (e) {
        // Sending anyway meant the request went out without the user's
        // Authorization header and the receiver answered 401, with nothing
        // pointing back at the headers field.
        //
        // The reason is named rather than reported: a JSON.parse message quotes
        // a window of the input, so a malformed `Authorization` header would
        // put part of the credential into the log. `scrubber.ts` redacts URL
        // credentials from an Error, not arbitrary secret text (issue #272).
        logger.error(
          `Notify | Webhook | Headers are not a valid JSON object, not sending (${e instanceof Error ? e.name : 'parse error'})`,
          'Notifications'
        );
        return false;
      }

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
          // Named, not reported, for the same reason as the headers above: the
          // parser quotes the input, and a template carries interpolated values.
          logger.error(
            `Notify | Webhook | Payload template is not valid JSON, not sending (${e instanceof Error ? e.name : 'parse error'})`,
            'Notifications'
          );
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
      // The URL is itself the credential -- it commonly carries a token in its
      // path or query -- so it is not logged (issue #272).
      logger.info('Notify | Webhook | Sent', 'Notifications');
      return true;
    } catch (error) {
      logger.error(`Notify | Webhook | Failed: ${error}`, 'Notifications', error);
      return false;
    }
  }
}
