import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { userService } from '../../services/domain/user';
import { logger } from '../../utils/system/logger';

const router = Router();

const NOTIFICATION_FIELDS = [
  'telegram_bot_token', 'telegram_chat_id', 'telegram_enabled', 'telegram_message_template',
  'discord_webhook_url', 'discord_enabled', 'discord_message_template',
  'pushover_user_key', 'pushover_app_token', 'pushover_enabled', 'pushover_message_template',
  'ntfy_topic', 'ntfy_server_url', 'ntfy_username', 'ntfy_password', 'ntfy_enabled', 'ntfy_message_template',
  'gotify_url', 'gotify_app_token', 'gotify_enabled', 'gotify_message_template',
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

    const response: any = {};
    NOTIFICATION_FIELDS.forEach(field => {
      response[field] = (settings as any)[field] ?? null;
    });

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
    const updates: any = {};
    
    NOTIFICATION_FIELDS.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const oldSettings = await userService.getNotificationSettings(userId);
    const settings = await userService.updateNotificationSettings(userId, updates);

    if (!settings) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    // Log what changed
    const changes: string[] = [];
    if (oldSettings) {
      Object.keys(updates).forEach(key => {
        const newVal = updates[key];
        const oldVal = (oldSettings as any)[key];
        if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
          changes.push(key);
        }
      });
    }

    if (changes.length > 0) {
      logger.info(`Settings | Notifications Updated | ID: ${req.userId} | Changed: ${changes.join(', ')}`, 'Settings');
    } else {
      logger.debug(`Settings | Notifications Update | ID: ${req.userId} | No changes detected`, 'Settings');
    }

    res.json({
      ...settings,
      message: 'Notification settings updated successfully',
    });
  } catch (error: any) {
    logger.error(`Settings | Update Notifications Failed | ID: ${req.userId}: ${error.message}`, 'Settings', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

export default router;
