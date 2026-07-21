import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { getNotificationContent, executeProviderRequest } from '../utils';

export class PushoverProvider implements NotificationProvider {
  constructor(
    private userKey: string,
    private appToken: string,
    private template?: string | null
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    return executeProviderRequest('Pushover', async () => {
      const { title, message } = getNotificationContent(payload, this.template);
      
      const pushTitle = payload.type === 'price_drop' && !this.template ? `🔔 ${title}` 
                      : payload.type === 'target_price' && !this.template ? `🎯 ${title}`
                      : payload.type === 'back_in_stock' && !this.template ? `🎉 ${title}`
                      : title;

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
