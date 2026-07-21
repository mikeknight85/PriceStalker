export interface User {
  id: number;
  email: string;
  /** NULL for SSO-provisioned accounts, which have no password. */
  password_hash: string | null;
  name: string | null;
  currency: string;
  locale: string;
  is_admin: boolean;
  auth_provider: string;
  oidc_subject: string | null;
  oidc_issuer: string | null;
  disabled: boolean;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  telegram_enabled: boolean;
  telegram_message_template: string | null;
  discord_webhook_url: string | null;
  discord_enabled: boolean;
  discord_message_template: string | null;
  pushover_user_key: string | null;
  pushover_app_token: string | null;
  pushover_enabled: boolean;
  pushover_message_template: string | null;
  ntfy_topic: string | null;
  ntfy_server_url: string | null;
  ntfy_username: string | null;
  ntfy_password: string | null;
  ntfy_enabled: boolean;
  ntfy_message_template: string | null;
  gotify_url: string | null;
  gotify_app_token: string | null;
  gotify_enabled: boolean;
  gotify_message_template: string | null;
  webhook_url: string | null;
  webhook_headers: string | null;
  webhook_payload_template: string | null;
  webhook_enabled: boolean;
  email_enabled: boolean;
  smtp_host: string | null;
  smtp_port: number;
  email_from: string | null;
  email_to: string | null;
  email_subject_template: string | null;
  email_body_template: string | null;
  preferred_currency: string;
  categories: string[];
  created_at: Date;
}

export interface UserProfile {
  id: number;
  email: string;
  name: string | null;
  currency: string;
  locale: string;
  preferred_currency: string;
  is_admin: boolean;
  disabled: boolean;
  categories: string[];
  created_at: Date;
}

export interface NotificationSettings {
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  telegram_enabled: boolean;
  telegram_message_template: string | null;
  discord_webhook_url: string | null;
  discord_enabled: boolean;
  discord_message_template: string | null;
  pushover_user_key: string | null;
  pushover_app_token: string | null;
  pushover_enabled: boolean;
  pushover_message_template: string | null;
  ntfy_topic: string | null;
  ntfy_server_url: string | null;
  ntfy_username: string | null;
  ntfy_password: string | null;
  ntfy_enabled: boolean;
  ntfy_message_template: string | null;
  gotify_url: string | null;
  gotify_app_token: string | null;
  gotify_enabled: boolean;
  gotify_message_template: string | null;
  webhook_url: string | null;
  webhook_headers: string | null;
  webhook_payload_template: string | null;
  webhook_enabled: boolean;
  email_enabled: boolean;
  smtp_host: string | null;
  smtp_port: number;
  email_from: string | null;
  email_to: string | null;
  email_subject_template: string | null;
  email_body_template: string | null;
}
