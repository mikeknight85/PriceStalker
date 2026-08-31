import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { executeProviderRequest, interpolateTemplate } from '../utils';
import { describeEvent } from '../events';

export class DiscordProvider implements NotificationProvider {
  constructor(
    private webhookUrl: string,
    private template?: string | null
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    return executeProviderRequest('Discord', async () => {
      if (this.template) {
        const message = interpolateTemplate(this.template, payload);
        await axios.post(this.webhookUrl, { content: message });
        return;
      }

      // Wording, colour and fields all come from the shared descriptor. The
      // if/else chain this replaces had no branch for `product_restored` or
      // `price_announced`, so both arrived as a green "Back in Stock!" embed
      // claiming the item was available.
      const event = describeEvent(payload);

      await axios.post(this.webhookUrl, {
        embeds: [{
          title: `${event.emoji} ${event.title}`,
          description: event.detail
            ? `${payload.productName}\n\n${event.headline}\n${event.detail}`
            : `${payload.productName}\n\n${event.headline}`,
          color: event.color,
          fields: event.fields,
          url: payload.productUrl,
          timestamp: new Date().toISOString(),
        }],
      });
    });
  }
}
