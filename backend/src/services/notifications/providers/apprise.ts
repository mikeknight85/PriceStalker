import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { executeProviderRequest, interpolateTemplate } from '../utils';
import { describeEvent, eventBody } from '../events';

/** The notification types apprise-api accepts. */
export type AppriseType = 'info' | 'success' | 'warning' | 'failure';

/**
 * Which Apprise `type` an event is sent as.
 *
 * `not_available` is `warning`, not `failure`: it is the `warning` tag on ntfy
 * and a neutral embed on Discord, and the transient-failure path means "still
 * retrying", which is not an error. Exhaustive over the union so a new event
 * type fails the build here rather than going out as `info`.
 */
export function appriseTypeFor(type: NotificationPayload['type']): AppriseType {
  switch (type) {
    case 'price_drop':
    case 'target_price':
    case 'back_in_stock':
      return 'success';
    case 'product_restored':
    case 'price_announced':
      return 'info';
    case 'not_available':
      return 'warning';
    default: {
      const unhandled: never = type;
      throw new Error(`Notification event type has no Apprise type: ${String(unhandled)}`);
    }
  }
}

export class AppriseProvider implements NotificationProvider {
  constructor(
    private serverUrl: string,
    private configKey?: string | null,
    private urls?: string | null,
    private tag?: string | null,
    private template?: string | null
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    return executeProviderRequest('Apprise', async () => {
      const baseUrl = this.serverUrl.trim().replace(/\/+$/, '');
      const key = this.configKey?.trim();
      const endpoint = key ? `${baseUrl}/notify/${encodeURIComponent(key)}` : `${baseUrl}/notify`;

      const body = this.template
        ? interpolateTemplate(this.template, payload)
        : `${eventBody(payload)}\n\n${payload.productUrl}`;

      const tag = this.tag?.trim();
      const urls = this.urls?.trim();

      await axios.post(endpoint, {
        title: describeEvent(payload).title,
        body,
        type: appriseTypeFor(payload.type),
        // Stateless mode names its own targets; a stored configuration already
        // knows them, and sending `urls` to it would be ignored at best.
        ...(!key && urls ? { urls } : {}),
        ...(tag ? { tag } : {}),
      }, { timeout: 10000 });
    });
  }
}
