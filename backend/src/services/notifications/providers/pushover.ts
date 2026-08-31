import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { getNotificationContent, executeProviderRequest } from '../utils';
import { describeEvent } from '../events';

export class PushoverProvider implements NotificationProvider {
  constructor(
    private userKey: string,
    private appToken: string,
    private template?: string | null
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    return executeProviderRequest('Pushover', async () => {
      const { title, message } = getNotificationContent(payload, this.template);

      // The prefix used to come from a ternary listing three event types by
      // name, so half the events arrived without one -- and the title they
      // arrived under was 'Back in Stock!' whatever had happened.
      const pushTitle = this.template ? title : `${describeEvent(payload).emoji} ${title}`;

      await axios.post('https://api.pushover.net/1/messages.json', {
        token: this.appToken,
        user: this.userKey,
        message: message,
        title: pushTitle,
        url: payload.productUrl,
        url_title: 'View Product'
      });
    });
  }
}
