import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { NotificationSettings } from '../../models/types';
import { userService } from '../../services/domain/user';
import {
  pickNotificationUpdates,
  toNotificationSettingsView,
} from '../../services/domain/user/notification-credentials';
import { logger } from '../../utils/system/logger';

const router = Router();

/**
 * The fields this endpoint exposes.
 *
 * Credential-bearing fields are listed here as well, but they are write-only:
 * `toNotificationSettingsView` replaces each one with `has_<field>` on the way
 * out, and `resolveCredentialUpdates` keeps an untouched one from being
 * overwritten on the way in. See `services/domain/user/notification-credentials.ts`
 * for the contract and why it is shaped this way (issue #272).
 */
export const NOTIFICATION_FIELDS: readonly (keyof NotificationSettings)[] = [
  'telegram_bot_token', 'telegram_chat_id', 'telegram_enabled', 'telegram_message_template',
  'discord_webhook_url', 'discord_enabled', 'discord_message_template',
  'pushover_user_key', 'pushover_app_token', 'pushover_enabled', 'pushover_message_template',
  'ntfy_topic', 'ntfy_server_url', 'ntfy_username', 'ntfy_password', 'ntfy_enabled', 'ntfy_message_template',
  'gotify_url', 'gotify_app_token', 'gotify_enabled', 'gotify_message_template',
  'apprise_url', 'apprise_config_key', 'apprise_urls', 'apprise_tag', 'apprise_enabled', 'apprise_message_template',
  'webhook_url', 'webhook_headers', 'webhook_payload_template', 'webhook_enabled',
  'email_enabled', 'smtp_host', 'smtp_port', 'email_from', 'email_to', 'email_subject_template', 'email_body_template'
];

// Get notification settings
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const settings = await userService.getNotificationSettings(userId);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    const response = toNotificationSettingsView(settings, NOTIFICATION_FIELDS);

    // Overrides for defaults
    if (response.telegram_enabled === null) response.telegram_enabled = true;
    if (response.discord_enabled === null) response.discord_enabled = true;
    if (response.pushover_enabled === null) response.pushover_enabled = true;
    if (response.ntfy_enabled === null) response.ntfy_enabled = true;
    if (response.gotify_enabled === null) response.gotify_enabled = true;
    if (response.smtp_port === null) response.smtp_port = 25;

    res.json(response);
  } catch (error: any) {
    logger.error(`Settings | Fetch Notifications Failed | ID: ${req.userId}: ${error.message}`, 'Settings', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

// Update notification settings
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const updates = pickNotificationUpdates(req.body, NOTIFICATION_FIELDS);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    const { settings, changes } = await userService.updateNotificationSettings(userId, updates);

    if (!settings) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (changes.length > 0) {
      logger.info(`Settings | Notifications Updated | ID: ${req.userId} | Changed: ${changes.join(', ')}`, 'Settings');
    } else {
      logger.debug(`Settings | Notifications Update | ID: ${req.userId} | No changes detected`, 'Settings');
    }

    res.json({
      ...toNotificationSettingsView(settings, NOTIFICATION_FIELDS),
      message: 'Notification settings updated successfully',
    });
  } catch (error: any) {
    logger.error(`Settings | Update Notifications Failed | ID: ${req.userId}: ${error.message}`, 'Settings', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

export default router;
