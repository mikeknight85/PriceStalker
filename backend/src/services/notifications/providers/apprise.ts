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

interface AppriseTargets {
  apprise_url?: string | null;
  apprise_config_key?: string | null;
  apprise_urls?: string | null;
}

/**
 * Whether there is a server to call and something for it to send to: a stored
 * configuration, or URLs for stateless mode.
 *
 * Values are trimmed, as the provider trims them. A field holding only spaces
 * used to count as configured here and then send an empty request, which
 * apprise-api rejects on every alert while the channel showed as active.
 */
export function isAppriseConfigured<T extends AppriseTargets>(settings: T): settings is T & { apprise_url: string } {
  return Boolean(
    settings.apprise_url?.trim() &&
    (settings.apprise_config_key?.trim() || normaliseAppriseUrls(settings.apprise_urls))
  );
}

/**
 * The URL list as apprise-api wants it: comma-separated, with no empty entries.
 *
 * Apprise splits on commas and whitespace, so a list pasted one per line
 * already works. A trailing comma does not: it stayed on the end of the last
 * URL and mangled its path (`.../b%2C`).
 */
export function normaliseAppriseUrls(raw?: string | null): string {
  return (raw ?? '').split(/[\s,]+/).filter(Boolean).join(',');
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
      const urls = normaliseAppriseUrls(this.urls);

      await axios.post(endpoint, {
        title: describeEvent(payload).title,
        body,
        type: appriseTypeFor(payload.type),
        // A stored configuration already knows its targets, so `urls` would be
        // ignored at best. And the other way round: a tag filters the services
        // in a stored configuration, and sent with ad-hoc `urls` it matches
        // none of them, so apprise-api answers 424 and delivers nothing. A tag
        // left over after switching to stateless mode must not break delivery.
        ...(key ? (tag ? { tag } : {}) : (urls ? { urls } : {})),
      }, { timeout: 10000 });
    });
  }
}
