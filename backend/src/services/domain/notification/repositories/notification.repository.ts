import pool from '../../../../config/database';
import { 
  NotificationSettings, 
  Notification, 
  CreateNotification 
} from '../../../../models/types';

export const notificationRepository = {
  // Create a new notification
  create: async (data: CreateNotification): Promise<Notification> => {
    const result = await pool.query(
      `INSERT INTO notifications
       (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.user_id,
        data.type,
        data.title,
        data.message,
        data.data ? JSON.stringify(data.data) : null,
      ]
    );
    return result.rows[0];
  },

  // Get notifications for a user with pagination
  getByUserId: async (
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> => {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  },

  // Get recent notifications for a user (unified feed for drawer)
  getRecent: async (userId: number, limit: number = 10): Promise<Notification[]> => {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1 
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  },

  // Count unread notifications (for badge) - ignores routine activity
  countUnread: async (userId: number): Promise<number> => {
    const result = await pool.query(
      `SELECT COUNT(*) FROM notifications
       WHERE user_id = $1 
         AND is_read = false
         AND type NOT IN ('session_activity', 'system_info')`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  // Mark a specific notification as read
  markAsRead: async (id: number, userId: number): Promise<void> => {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
  },

  // Mark all notifications as read for a user
  markAllAsRead: async (userId: number): Promise<void> => {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1`,
      [userId]
    );
  },

  // Delete all notifications for a user
  deleteAll: async (userId: number): Promise<void> => {
    await pool.query(
      `DELETE FROM notifications WHERE user_id = $1`,
      [userId]
    );
  },

  // Get total count for pagination
  getTotalCount: async (userId: number): Promise<number> => {
    const result = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  // Delete old notifications (for cleanup)
  deleteOlderThan: async (days: number): Promise<number> => {
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [days]
    );
    return result.rowCount || 0;
  },
};
