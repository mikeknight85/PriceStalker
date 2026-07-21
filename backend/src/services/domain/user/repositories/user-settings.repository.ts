import pool from '../../../../config/database';
import { NotificationSettings } from '../../../../models/types';

/**
 * Fields for notification settings.
 * Mapping of key to its type for dynamic query generation.
 */
const NOTIFICATION_FIELDS = [
  'telegram_bot_token', 'telegram_chat_id', 'telegram_enabled', 'telegram_message_template',
  'discord_webhook_url', 'discord_enabled', 'discord_message_template',
  'pushover_user_key', 'pushover_app_token', 'pushover_enabled', 'pushover_message_template',
  'ntfy_topic', 'ntfy_server_url', 'ntfy_username', 'ntfy_password', 'ntfy_enabled', 'ntfy_message_template',
  'gotify_url', 'gotify_app_token', 'gotify_enabled', 'gotify_message_template',
  'webhook_url', 'webhook_headers', 'webhook_payload_template', 'webhook_enabled',
  'email_enabled', 'smtp_host', 'smtp_port', 'email_from', 'email_to', 'email_subject_template', 'email_body_template'
];

const SELECT_FIELDS_SQL = `
  telegram_bot_token, telegram_chat_id, COALESCE(telegram_enabled, false) as telegram_enabled, telegram_message_template,
  discord_webhook_url, COALESCE(discord_enabled, false) as discord_enabled, discord_message_template,
  pushover_user_key, pushover_app_token, COALESCE(pushover_enabled, false) as pushover_enabled, pushover_message_template,
  ntfy_topic, ntfy_server_url, ntfy_username, ntfy_password, COALESCE(ntfy_enabled, false) as ntfy_enabled, ntfy_message_template,
  gotify_url, gotify_app_token, COALESCE(gotify_enabled, false) as gotify_enabled, gotify_message_template,
  webhook_url, webhook_headers, webhook_payload_template, COALESCE(webhook_enabled, false) as webhook_enabled,
  COALESCE(email_enabled, false) as email_enabled, smtp_host, COALESCE(smtp_port, 25) as smtp_port,
  email_from, email_to, email_subject_template, email_body_template
`;

export const userSettingsRepository = {
  getNotificationSettings: async (id: number): Promise<NotificationSettings | null> => {
    const result = await pool.query(
      `SELECT ${SELECT_FIELDS_SQL} FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  updateNotificationSettings: async (
    id: number,
    settings: Partial<NotificationSettings>
  ): Promise<NotificationSettings | null> => {
    const fields: string[] = [];
    const values: (string | boolean | number | null)[] = [];
    let paramIndex = 1;

    // Dynamically build the UPDATE fields
    for (const key of NOTIFICATION_FIELDS) {
      const value = (settings as any)[key];
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return null;

    values.push(id.toString());
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING ${SELECT_FIELDS_SQL}`,
      values
    );
    return result.rows[0] || null;
  },
};
