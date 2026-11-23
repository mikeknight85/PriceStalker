import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendNotifications, NotificationSettings } from '../../src/services/notifications/orchestrator';
import { NotificationPayload } from '../../src/services/notifications/types';
import { PROVIDER_REGISTRY } from '../../src/services/notifications/registry';

describe('Notification Orchestrator (sendNotifications)', () => {
  const dummyPayload: NotificationPayload = {
    productId: 1,
    productName: 'Gaming Laptop',
    productUrl: 'https://store.example/item/1',
    type: 'price_drop',
    currentPrice: 899.99,
    newPrice: 799.99,
    currency: 'USD',
  };

  const emptySettings: NotificationSettings = {
    telegram_bot_token: null,
    telegram_chat_id: null,
    discord_webhook_url: null,
    pushover_user_key: null,
    pushover_app_token: null,
    ntfy_topic: null,
    gotify_url: null,
    gotify_app_token: null,
    webhook_url: null,
    smtp_host: null,
    smtp_port: 587,
    email_from: null,
    email_to: null,
    email_subject_template: null,
    email_body_template: null,
  };

  it('returns empty channels when no provider is configured', async () => {
    const result = await sendNotifications(emptySettings, dummyPayload);
    expect(result.channelsNotified).toEqual([]);
    expect(result.channelsFailed).toEqual([]);
  });

  it('dispatches to active providers and reports successful channels', async () => {
    const originalDiscord = PROVIDER_REGISTRY.discord;
    const originalTelegram = PROVIDER_REGISTRY.telegram;

    const mockDiscordSend = vi.fn().mockResolvedValue(true);
    const mockTelegramSend = vi.fn().mockResolvedValue(true);

    PROVIDER_REGISTRY.discord = () => ({
      name: 'discord',
      send: mockDiscordSend,
    } as any);

    PROVIDER_REGISTRY.telegram = () => ({
      name: 'telegram',
      send: mockTelegramSend,
    } as any);

    try {
      const result = await sendNotifications(emptySettings, dummyPayload);
      expect(result.channelsNotified).toContain('discord');
      expect(result.channelsNotified).toContain('telegram');
      expect(result.channelsFailed).toEqual([]);
      expect(mockDiscordSend).toHaveBeenCalledWith(dummyPayload);
      expect(mockTelegramSend).toHaveBeenCalledWith(dummyPayload);
    } finally {
      PROVIDER_REGISTRY.discord = originalDiscord;
      PROVIDER_REGISTRY.telegram = originalTelegram;
    }
  });

  it('handles provider failures and rejections gracefully without aborting other channels', async () => {
    const originalDiscord = PROVIDER_REGISTRY.discord;
    const originalTelegram = PROVIDER_REGISTRY.telegram;
    const originalNtfy = PROVIDER_REGISTRY.ntfy;

    // Discord throws an unhandled error (e.g. network timeout)
    const mockDiscordSend = vi.fn().mockRejectedValue(new Error('Network timeout'));
    // Telegram returns false (e.g. API responded 400 Bad Request)
    const mockTelegramSend = vi.fn().mockResolvedValue(false);
    // Ntfy succeeds
    const mockNtfySend = vi.fn().mockResolvedValue(true);

    PROVIDER_REGISTRY.discord = () => ({
      name: 'discord',
      send: mockDiscordSend,
    } as any);

    PROVIDER_REGISTRY.telegram = () => ({
      name: 'telegram',
      send: mockTelegramSend,
    } as any);

    PROVIDER_REGISTRY.ntfy = () => ({
      name: 'ntfy',
      send: mockNtfySend,
    } as any);

    try {
      const result = await sendNotifications(emptySettings, dummyPayload);
      expect(result.channelsNotified).toEqual(['ntfy']);
      expect(result.channelsFailed).toContain('discord');
      expect(result.channelsFailed).toContain('telegram');
    } finally {
      PROVIDER_REGISTRY.discord = originalDiscord;
      PROVIDER_REGISTRY.telegram = originalTelegram;
      PROVIDER_REGISTRY.ntfy = originalNtfy;
    }
  });
});
