import { NotificationPayload } from './types';
import { DiscordProvider } from './providers/discord';
import { EmailProvider } from './providers/email';
import { TelegramProvider } from './providers/telegram';
import { PushoverProvider } from './providers/pushover';
import { NtfyProvider } from './providers/ntfy';
import { GotifyProvider } from './providers/gotify';
import { WebhookProvider } from './providers/webhook';

/**
 * Legacy compatibility functions (can be removed later if all callers update).
 */
export async function sendEmailNotification(
  smtpHost: string, smtpPort: number, from: string, to: string,
  subjectTemplate: string, bodyTemplate: string, payload: NotificationPayload
): Promise<boolean> {
  const provider = new EmailProvider(smtpHost, smtpPort, from, to, subjectTemplate, bodyTemplate);
  return provider.send(payload);
}

export async function sendDiscordNotification(
  webhookUrl: string, payload: NotificationPayload, template?: string | null
): Promise<boolean> {
  const provider = new DiscordProvider(webhookUrl, template);
  return provider.send(payload);
}

export async function sendTelegramNotification(
  botToken: string, chatId: string, payload: NotificationPayload, template?: string | null
): Promise<boolean> {
  const provider = new TelegramProvider(botToken, chatId, template);
  return provider.send(payload);
}

export async function sendPushoverNotification(
  userKey: string, appToken: string, payload: NotificationPayload, template?: string | null
): Promise<boolean> {
  const provider = new PushoverProvider(userKey, appToken, template);
  return provider.send(payload);
}

export async function sendNtfyNotification(
  topic: string, payload: NotificationPayload, serverUrl?: string | null,
  username?: string | null, password?: string | null, template?: string | null
): Promise<boolean> {
  const provider = new NtfyProvider(topic, serverUrl, username, password, template);
  return provider.send(payload);
}

export async function sendGotifyNotification(
  serverUrl: string, appToken: string, payload: NotificationPayload, template?: string | null
): Promise<boolean> {
  const provider = new GotifyProvider(serverUrl, appToken, template);
  return provider.send(payload);
}

export async function sendWebhookNotification(
  webhookUrl: string, payload: NotificationPayload, headersStr?: string | null, payloadTemplate?: string | null
): Promise<boolean> {
  const provider = new WebhookProvider(webhookUrl, headersStr, payloadTemplate);
  return provider.send(payload);
}
