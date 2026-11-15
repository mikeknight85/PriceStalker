import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { NotificationSettings } from '../../models/types';
import { userService } from '../../services/domain/user';
import { isNotificationCredentialField } from '../../services/domain/user/notification-credentials';
import { isMaskedSecret } from '../../utils/system/masking';
import { logger } from '../../utils/system/logger';

const router = Router();

/** The channels `sendTestNotification` accepts, kept in step with it. */
type TestChannel = Parameters<
  typeof import('../../services/notifications/index')['sendTestNotification']
>[0];

/**
 * Generic test handler for notification channels.
 *
 * Every channel's credentials are read from storage here, never from the
 * request, so these endpoints keep working now that the API no longer hands the
 * client its own secrets (issue #272).
 */
async function handleTest(
  req: AuthRequest,
  res: Response,
  channel: TestChannel,
  targetField?: keyof NotificationSettings
) {
  try {
    const userId = req.userId!;
    const settings = await userService.getNotificationSettings(userId);
    if (!settings) return res.status(404).json({ error: 'User not found' });

    const { sendTestNotification } = await import('../../services/notifications/index');
    const success = await sendTestNotification(channel, settings);

    if (success) {
      // `webhook_url` is itself the credential, so it is named rather than
      // logged. A chat id or a topic is not, and saying where a test went is
      // the whole point of the line.
      const target = targetField && !isNotificationCredentialField(targetField)
        ? settings[targetField]
        : '';
      logger.info(`Notify | ${channel} Test | Sent${target ? ` to ${target}` : ''}`, 'Settings');
      res.json({ message: 'Test notification sent successfully' });
    } else {
      res.status(500).json({ error: `Failed to send test notification for ${channel}` });
    }
  } catch (error: any) {
    logger.error(`Settings | ${channel} Test Failed | ${error.message}`, 'Settings', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
}

// Route Definitions
router.post('/telegram', (req, res) => handleTest(req, res, 'telegram', 'telegram_chat_id'));
router.post('/discord', (req, res) => handleTest(req, res, 'discord'));
router.post('/pushover', (req, res) => handleTest(req, res, 'pushover'));
router.post('/ntfy', (req, res) => handleTest(req, res, 'ntfy', 'ntfy_topic'));
router.post('/gotify', (req, res) => handleTest(req, res, 'gotify'));
router.post('/apprise', (req, res) => handleTest(req, res, 'apprise'));
router.post('/email', (req, res) => handleTest(req, res, 'email', 'email_to'));
router.post('/webhook', (req, res) => handleTest(req, res, 'webhook', 'webhook_url'));

// Specialized Test for Gotify connection (before saving)
router.post('/gotify/connection', async (req: AuthRequest, res: Response) => {
  try {
    const url: unknown = req.body?.url;
    let appToken: unknown = req.body?.app_token;

    // The client is never given the stored token, so a connection test for an
    // already-configured server arrives with the field empty -- or with a
    // placeholder, if some client still holds one. Either way the stored token
    // is the one to test, exactly as the AI connection tests resolve theirs
    // (issues #196, #198, #272). A token the user typed still wins.
    //
    // Only for the server that token belongs to, though. This endpoint posts to
    // whatever URL the body names, and the stored token can no longer be read
    // back through the API: substituting it for any other address would turn
    // the test button into a way to have it delivered somewhere of the
    // caller's choosing. Same reasoning as `refreshProviderModels`.
    if (!appToken || typeof appToken !== 'string' || isMaskedSecret(appToken)) {
      const settings = await userService.getNotificationSettings(req.userId!);
      appToken = url === settings?.gotify_url ? settings?.gotify_app_token ?? '' : '';
    }

    if (!url || typeof url !== 'string' || typeof appToken !== 'string' || !appToken) {
      return res.status(400).json({ error: 'Server URL and app token are required' });
    }

    const { testGotifyConnection } = await import('../../services/notifications/index');
    const result = await testGotifyConnection(url, appToken);

    if (result.success) {
      res.json({ success: true, message: 'Successfully connected to Gotify server' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    logger.error(`Settings | Gotify Connection Test Failed | ${error.message}`, 'Settings', error);
    res.status(500).json({ error: 'Failed to test Gotify connection' });
  }
});

export default router;
