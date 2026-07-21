import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { notificationService } from '../../services/domain/notification';
import { logger } from '../../utils/system/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get recent notifications for the feed drawer
router.get('/recent', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const result = await notificationService.getRecentWithCount(userId, limit);
    res.json(result);
  } catch (error) {
    logger.error(`Notify | Fetch Recent Failed | ${error}`, 'Notifications');
    res.status(500).json({ error: 'Failed to fetch recent notifications' });
  }
});

// Get paginated notification history
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    
    const result = await notificationService.getPaginatedHistory(userId, page, limit);
    res.json(result);
  } catch (error) {
    logger.error(`Notify | Fetch History Failed | ${error}`, 'Notifications');
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// Get count of unread notifications for the badge
router.get('/count', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const count = await notificationService.getUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    logger.error(`Notify | Fetch Count Failed | ${error}`, 'Notifications');
    res.status(500).json({ error: 'Failed to fetch notification count' });
  }
});

// Mark all as read
router.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await notificationService.markAllAsRead(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    logger.error(`Notify | Mark All Read Failed | ${error}`, 'Notifications');
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Alias for read-all
router.post('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await notificationService.markAllAsRead(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    logger.error(`Notify | Mark All Read Failed | ${error}`, 'Notifications');
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Mark specific as read
router.post('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id, 10);
    await notificationService.markAsRead(id, userId);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    logger.error(`Notify | Mark Read Failed | ${error}`, 'Notifications');
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Alias for mark-read (PUT support)
router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id, 10);
    await notificationService.markAsRead(id, userId);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    logger.error(`Notify | Mark Read Failed | ${error}`, 'Notifications');
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Clear all notifications
router.delete('/all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await notificationService.deleteAll(userId);
    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    logger.error(`Notify | Clear All Failed | ${error}`, 'Notifications');
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

export default router;
