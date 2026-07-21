import { 
  NotificationPayload, 
  NotificationResult, 
  NotificationProvider 
} from './types';
import { PROVIDER_REGISTRY } from './registry';

export interface NotificationSettings {
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  telegram_enabled?: boolean;
  telegram_message_template?: string | null;
  discord_webhook_url: string | null;
  discord_enabled?: boolean;
  discord_message_template?: string | null;
  pushover_user_key: string | null;
  pushover_app_token: string | null;
  pushover_enabled?: boolean;
  pushover_message_template?: string | null;
  ntfy_topic: string | null;
  ntfy_server_url?: string | null;
  ntfy_username?: string | null;
  ntfy_password?: string | null;
  ntfy_enabled?: boolean;
  ntfy_message_template?: string | null;
  gotify_url: string | null;
  gotify_app_token: string | null;
  gotify_enabled?: boolean;
  gotify_message_template?: string | null;
  webhook_url: string | null;
  webhook_headers?: string | null;
  webhook_payload_template?: string | null;
  webhook_enabled?: boolean;
  email_enabled?: boolean;
  smtp_host: string | null;
  smtp_port: number;
  email_from: string | null;
  email_to: string | null;
  email_subject_template: string | null;
  email_body_template: string | null;
}

/**
 * Main orchestration function for sending notifications across all enabled channels.
 */
export async function sendNotifications(
  settings: NotificationSettings,
  payload: NotificationPayload
): Promise<NotificationResult> {
  const activeProviders: { channel: string; provider: NotificationProvider }[] = [];

  // Initialize active providers from registry
  for (const [channel, initializer] of Object.entries(PROVIDER_REGISTRY)) {
    const provider = initializer(settings);
    if (provider) {
      activeProviders.push({ channel, provider });
    }
  }

  if (activeProviders.length === 0) {
    return { channelsNotified: [], channelsFailed: [] };
  }

  const results = await Promise.allSettled(activeProviders.map(p => p.provider.send(payload)));

  const channelsNotified: string[] = [];
  const channelsFailed: string[] = [];

  results.forEach((result, index) => {
    const channel = activeProviders[index].channel;
    if (result.status === 'fulfilled' && result.value === true) {
      channelsNotified.push(channel);
    } else {
      channelsFailed.push(channel);
    }
  });

  return { channelsNotified, channelsFailed };
}
