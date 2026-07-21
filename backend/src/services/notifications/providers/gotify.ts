import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { getNotificationContent, executeProviderRequest } from '../utils';

export class GotifyProvider implements NotificationProvider {
  constructor(
    private serverUrl: string,
    private appToken: string,
    private template?: string | null
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    return executeProviderRequest('Gotify', async () => {
      const { title, message } = getNotificationContent(payload, this.template);
      const priority = payload.type === 'price_drop' ? 7 : 8;
      const finalMessage = this.template ? message : `${message}\n\n${payload.productUrl}`;

      const cleanUrl = this.serverUrl.endsWith('/') ? this.serverUrl.slice(0, -1) : this.serverUrl;
      const url = `${cleanUrl}/message`;
      await axios.post(url, {
        title,
        message: finalMessage,
        priority,
      }, {
        headers: {
          'X-Gotify-Key': this.appToken,
        },
      });
    });
  }
}
