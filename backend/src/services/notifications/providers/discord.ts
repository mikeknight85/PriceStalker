import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { executeProviderRequest, interpolateTemplate, getCurrencySymbol } from '../utils';

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

      const currencySymbol = getCurrencySymbol(payload.currency);
      let embed;

      if (payload.type === 'price_drop') {
        const oldPriceStr = payload.oldPrice ? `${currencySymbol}${payload.oldPrice.toFixed(2)}` : 'N/A';
        const newPriceStr = payload.newPrice ? `${currencySymbol}${payload.newPrice.toFixed(2)}` : 'N/A';

        embed = {
          title: '🔔 Price Drop Alert!',
          description: payload.productName,
          color: 0x10b981,
          fields: [
            { name: 'Old Price', value: oldPriceStr, inline: true },
            { name: 'New Price', value: newPriceStr, inline: true },
          ],
          url: payload.productUrl,
          timestamp: new Date().toISOString(),
        };
      } else if (payload.type === 'target_price') {
        const newPriceStr = payload.newPrice ? `${currencySymbol}${payload.newPrice.toFixed(2)}` : 'N/A';
        const targetPriceStr = payload.targetPrice ? `${currencySymbol}${payload.targetPrice.toFixed(2)}` : 'N/A';

        embed = {
          title: '🎯 Target Price Reached!',
          description: payload.productName,
          color: 0xf59e0b,
          fields: [
            { name: 'Current Price', value: newPriceStr, inline: true },
            { name: 'Your Target', value: targetPriceStr, inline: true },
          ],
          url: payload.productUrl,
          timestamp: new Date().toISOString(),
        };
      } else if (payload.type === 'not_available') {
        embed = {
          title: '⚠️ Product Unavailable',
          description: payload.productName,
          color: 0x6b7280,
          fields: [
            { name: 'Status', value: '❌ Page Not Found (404/410)', inline: true },
            { name: 'Action', value: '⏸️ Monitoring Paused', inline: true },
          ],
          footer: { text: 'You can unpause this product in the dashboard if the link is restored.' },
          url: payload.productUrl,
          timestamp: new Date().toISOString(),
        };
      } else {
        const priceStr = payload.newPrice ? `${currencySymbol}${payload.newPrice.toFixed(2)}` : 'Check link';

        embed = {
          title: '🎉 Back in Stock!',
          description: payload.productName,
          color: 0x6366f1,
          fields: [
            { name: 'Price', value: priceStr, inline: true },
            { name: 'Status', value: '✅ Available', inline: true },
          ],
          url: payload.productUrl,
          timestamp: new Date().toISOString(),
        };
      }

      await axios.post(this.webhookUrl, { embeds: [embed] });
    });
  }
}
