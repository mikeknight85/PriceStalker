import { NotificationProvider } from './types';
import { DiscordProvider } from './providers/discord';
import { EmailProvider } from './providers/email';
import { TelegramProvider } from './providers/telegram';
import { PushoverProvider } from './providers/pushover';
import { NtfyProvider } from './providers/ntfy';
import { GotifyProvider } from './providers/gotify';
import { WebhookProvider } from './providers/webhook';
import { NotificationSettings } from './orchestrator';

/**
 * Interface for a provider initializer function.
 */
type ProviderInitializer = (settings: NotificationSettings) => NotificationProvider | null;

/**
 * Registry of all available notification providers.
 */
export const PROVIDER_REGISTRY: Record<string, ProviderInitializer> = {
  telegram: (s) => {
    if (!s.telegram_bot_token || !s.telegram_chat_id || s.telegram_enabled === false) return null;
    return new TelegramProvider(s.telegram_bot_token, s.telegram_chat_id, s.telegram_message_template);
  },
  discord: (s) => {
    if (!s.discord_webhook_url || s.discord_enabled === false) return null;
    return new DiscordProvider(s.discord_webhook_url, s.discord_message_template);
  },
  pushover: (s) => {
    if (!s.pushover_user_key || !s.pushover_app_token || s.pushover_enabled === false) return null;
    return new PushoverProvider(s.pushover_user_key, s.pushover_app_token, s.pushover_message_template);
  },
  ntfy: (s) => {
    if (!s.ntfy_topic || s.ntfy_enabled === false) return null;
    return new NtfyProvider(s.ntfy_topic, s.ntfy_server_url, s.ntfy_username, s.ntfy_password, s.ntfy_message_template);
  },
  gotify: (s) => {
    if (!s.gotify_url || !s.gotify_app_token || s.gotify_enabled === false) return null;
    return new GotifyProvider(s.gotify_url, s.gotify_app_token, s.gotify_message_template);
  },
  webhook: (s) => {
    if (!s.webhook_url || s.webhook_enabled === false) return null;
    return new WebhookProvider(s.webhook_url, s.webhook_headers, s.webhook_payload_template);
  },
  email: (s) => {
    if (!s.smtp_host || !s.email_from || !s.email_to || s.email_enabled === false) return null;
    return new EmailProvider(
      s.smtp_host,
      s.smtp_port,
      s.email_from,
      s.email_to,
      s.email_subject_template || 'PriceStalker Alert: {{product_name}}',
      s.email_body_template || 'Product: {{product_name}}\nPrice: {{current_price}}'
    );
  }
};
