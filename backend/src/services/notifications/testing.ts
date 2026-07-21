import axios from 'axios';
import { NotificationPayload } from './types';
import { NotificationSettings } from './orchestrator';
import { 
  sendTelegramNotification, 
  sendDiscordNotification, 
  sendPushoverNotification, 
  sendNtfyNotification, 
  sendGotifyNotification, 
  sendWebhookNotification, 
  sendEmailNotification 
} from './legacy';

/**
 * Send a test notification to a specific channel.
 */
export async function sendTestNotification(
  channel: 'telegram' | 'discord' | 'pushover' | 'ntfy' | 'gotify' | 'webhook' | 'email',
  settings: NotificationSettings
): Promise<boolean> {
  const payload: NotificationPayload = {
    productName: 'Test Product',
    productUrl: 'https://example.com',
    type: 'price_drop',
    oldPrice: 29.99,
    newPrice: 19.99,
    currency: 'USD',
    productId: 9999,
  };

  switch (channel) {
    case 'telegram':
      if (!settings.telegram_bot_token || !settings.telegram_chat_id) return false;
      return sendTelegramNotification(settings.telegram_bot_token, settings.telegram_chat_id, payload, settings.telegram_message_template);
    case 'discord':
      if (!settings.discord_webhook_url) return false;
      return sendDiscordNotification(settings.discord_webhook_url, payload, settings.discord_message_template);
    case 'pushover':
      if (!settings.pushover_user_key || !settings.pushover_app_token) return false;
      return sendPushoverNotification(settings.pushover_user_key, settings.pushover_app_token, payload, settings.pushover_message_template);
    case 'ntfy':
      if (!settings.ntfy_topic) return false;
      return sendNtfyNotification(settings.ntfy_topic, payload, settings.ntfy_server_url, settings.ntfy_username, settings.ntfy_password, settings.ntfy_message_template);
    case 'gotify':
      if (!settings.gotify_url || !settings.gotify_app_token) return false;
      return sendGotifyNotification(settings.gotify_url, settings.gotify_app_token, payload, settings.gotify_message_template);
    case 'webhook':
      if (!settings.webhook_url) return false;
      return sendWebhookNotification(settings.webhook_url, payload, settings.webhook_headers, settings.webhook_payload_template);
    case 'email':
      if (!settings.smtp_host || !settings.email_from || !settings.email_to) return false;
      return sendEmailNotification(
        settings.smtp_host,
        settings.smtp_port,
        settings.email_from,
        settings.email_to,
        settings.email_subject_template || 'PriceGhost Test',
        settings.email_body_template || 'This is a test notification.',
        payload
      );
    default:
      return false;
  }
}

/**
 * Utility to test Gotify connection.
 */
export async function testGotifyConnection(
  serverUrl: string,
  appToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${serverUrl.replace(/\/$/, '')}/application`;
    await axios.get(url, {
      headers: { 'X-Gotify-Key': appToken },
      timeout: 10000,
    });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('ECONNREFUSED')) {
      return { success: false, error: 'Cannot connect to Gotify server. Make sure it is running.' };
    }
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      return { success: false, error: 'Invalid app token. Check your Gotify application token.' };
    }
    return { success: false, error: `Connection failed: ${errorMessage}` };
  }
}
