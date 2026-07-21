import { notificationRepository } from '../../../models';
import { logger } from '../../../utils/system/logger';
import { CreateNotification } from '../../../models/types';

export class NotificationService {
  /**
   * Create a new notification (including session activity)
   */
  async createNotification(data: CreateNotification) {
    return await notificationRepository.create(data);
  }

  /**
   * Get recent notifications and count for a user
   */
  async getRecentWithCount(userId: number, limit: number) {
    const notifications = await notificationRepository.getRecent(userId, limit);
    const unreadCount = await notificationRepository.countUnread(userId);
    return { notifications, unreadCount };
  }

  /**
   * Get paginated notification history
   */
  async getPaginatedHistory(userId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const [notifications, totalCount] = await Promise.all([
      notificationRepository.getByUserId(userId, limit, offset),
      notificationRepository.getTotalCount(userId),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number) {
    await notificationRepository.markAllAsRead(userId);
    logger.info(`Notify | Marked All Read | ID: ${userId}`, 'Notifications');
  }

  /**
   * Mark a specific notification as read
   */
  async markAsRead(id: number, userId: number) {
    await notificationRepository.markAsRead(id, userId);
  }

  /**
   * Get count of unread notifications
   */
  async getUnreadCount(userId: number) {
    return await notificationRepository.countUnread(userId);
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAll(userId: number) {
    await notificationRepository.deleteAll(userId);
    logger.info(`Notify | Cleared All | ID: ${userId}`, 'Notifications');
  }

  /**
   * Run automated notification cleanup
   */
  async cleanup(days: number): Promise<number> {
    return await notificationRepository.deleteOlderThan(days);
  }
}

export const notificationService = new NotificationService();
