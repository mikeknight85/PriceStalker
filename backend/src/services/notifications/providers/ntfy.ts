import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { logger } from '../../../utils/system/logger';
import { interpolateTemplate } from '../utils';
import { describeEvent, eventBody } from '../events';

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
      // Title and tags apply to both paths: a custom template replaces the body
      // the user writes, not the heading the client shows in its notification
      // tray, so the heading must still name the right event.
      const event = describeEvent(payload);
      const message = this.template ? interpolateTemplate(this.template, payload) : eventBody(payload);

      const baseUrl = this.serverUrl ? this.serverUrl.replace(/\/$/, '') : 'https://ntfy.sh';
      const url = `${baseUrl}/${this.topic}`;

      const headers: Record<string, string> = {
        'Title': event.title,
        'Tags': event.tags.join(','),
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
