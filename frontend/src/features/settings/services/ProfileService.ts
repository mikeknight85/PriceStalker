import { api, type RequestOptions } from '../../../api/client';
import { UserProfile, NotificationSettings } from '../../../types/api';

export const SystemService = {
  /** The version the backend is actually running. */
  getVersion: (options?: RequestOptions) => api.get<{ version: string }>('/system/version', options),
};

export const ProfileService = {
  getProfile: (options?: RequestOptions) => api.get<UserProfile>('/profile', options),

  updateProfile: (data: { name?: string; currency?: string | null; locale?: string | null }) =>
    api.put<UserProfile>('/profile', data),

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
