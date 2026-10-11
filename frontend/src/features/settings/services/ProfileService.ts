import { api, type RequestOptions } from '../../../api/client';
import { UserProfile, NotificationSettings, ProductCheckDefaults } from '../../../types/api';

export const SystemService = {
  /** The version the backend is actually running. */
  getVersion: (options?: RequestOptions) => api.get<{ version: string }>('/system/version', options),
};

export const ProfileService = {
  getProfile: (options?: RequestOptions) => api.get<UserProfile>('/profile', options),

  updateProfile: (data: {
    name?: string;
    currency?: string | null;
    locale?: string | null;
    /** Null clears the preference, so new products follow the instance default. */
    default_refresh_interval?: number | null;
  }) => api.put<UserProfile>('/profile', data),

  /**
   * What a new product should be checked every, for this user (issue #239).
   * Resolved by the backend from the user preference, then the instance
   * default, then the 12 hours the form used to hardcode.
   */
  getProductDefaults: (options?: RequestOptions) =>
    api.get<ProductCheckDefaults>('/settings/product-defaults', options),

  changePassword: (current: string, next: string) => 
    api.put('/profile/password', { current_password: current, new_password: next }),

  getNotificationSettings: (options?: RequestOptions) =>
    api.get<NotificationSettings>('/settings/notifications', options),

  updateNotificationSettings: (data: Partial<NotificationSettings>) =>
    api.put<NotificationSettings>('/settings/notifications', data),

  // Notification Tests
  testTelegram: () => api.post('/settings/notifications/test/telegram'),
  testDiscord: () => api.post('/settings/notifications/test/discord'),
  testPushover: () => api.post('/settings/notifications/test/pushover'),
  testNtfy: () => api.post('/settings/notifications/test/ntfy'),
  testGotify: () => api.post('/settings/notifications/test/gotify'),
  testGotifyConnection: (url: string, token: string) => api.post('/settings/notifications/test/gotify/connection', { url, app_token: token }),
  testEmail: () => api.post('/settings/notifications/test/email'),
  testWebhook: () => api.post('/settings/notifications/test/webhook'),
};
