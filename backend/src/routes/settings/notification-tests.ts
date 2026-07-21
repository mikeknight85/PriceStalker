import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { userService } from '../../services/domain/user';
import { logger } from '../../utils/system/logger';

const router = Router();

/**
 * Generic test handler for notification channels.
 */
async function handleTest(req: AuthRequest, res: Response, channel: string, targetField?: string) {
  try {
    const userId = req.userId!;
    const settings = await userService.getNotificationSettings(userId);
    if (!settings) return res.status(404).json({ error: 'User not found' });

    const { sendTestNotification } = await import('../../services/notifications/index');
    const success = await sendTestNotification(channel as any, settings as any);

    if (success) {
      const target = targetField ? (settings as any)[targetField] : '';
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
router.post('/email', (req, res) => handleTest(req, res, 'email', 'email_to'));
router.post('/webhook', (req, res) => handleTest(req, res, 'webhook', 'webhook_url'));

// Specialized Test for Gotify connection (before saving)
router.post('/gotify/connection', async (req: AuthRequest, res: Response) => {
  try {
    const { url, app_token } = req.body;
    if (!url || !app_token) {
      return res.status(400).json({ error: 'Server URL and app token are required' });
    }

    const { testGotifyConnection } = await import('../../services/notifications/index');
    const result = await testGotifyConnection(url, app_token);

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
