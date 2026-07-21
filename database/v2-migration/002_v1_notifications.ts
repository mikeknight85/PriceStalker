import { MigrationContext } from '../config/migrate';

/**
 * Carry v1 notification history forward.
 *
 * v2 replaced the v1 `notification_history` alert log with `notifications`, an
 * in-app notification bell. That conversion used to live in 010_refactor_
 * notifications, which the squashed baseline replaces -- but the baseline only
 * creates schema, so without this step a migrated v1 database ends up with an
 * empty bell and an orphaned notification_history table.
 *
 * Runs after 001_baseline because it needs `notifications` to exist. No-op on
 * any database that has no notification_history table, which covers fresh
 * installs and existing v2 installs.
 *
 * The mapping is taken from 010, including its use of users.notifications_
 * cleared_at to decide read state: anything the user had already cleared in v1
 * arrives read, everything else arrives unread. That is better than marking the
 * whole history read, which would silently discard "these are new to you".
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT to_regclass('public.notification_history') IS NOT NULL AS present`
    );
    if (!rows[0].present) {
      await client.query('COMMIT');
      return;
    }

    // Guard against double-conversion if this somehow runs twice.
    const { rows: existing } = await client.query(`SELECT count(*)::int AS n FROM notifications`);
    if (existing[0].n === 0) {
      await client.query(`
        INSERT INTO notifications (user_id, type, title, message, is_read, data, created_at)
        SELECT
          nh.user_id,
          nh.notification_type,
          COALESCE(nh.product_name, 'System Notification'),
          CASE nh.notification_type
            WHEN 'price_drop'   THEN 'Price dropped from ' || COALESCE(nh.old_price::text,'?') || ' to ' || COALESCE(nh.new_price::text,'?') || ' ' || COALESCE(nh.currency,'')
            WHEN 'price_change' THEN 'Price changed from ' || COALESCE(nh.old_price::text,'?') || ' to ' || COALESCE(nh.new_price::text,'?') || ' ' || COALESCE(nh.currency,'')
            WHEN 'price_target' THEN 'Target price reached: ' || COALESCE(nh.new_price::text,'?') || ' ' || COALESCE(nh.currency,'')
            WHEN 'target_price' THEN 'Target price reached: ' || COALESCE(nh.new_price::text,'?') || ' ' || COALESCE(nh.currency,'')
            WHEN 'stock_change' THEN 'Stock status changed from ' || COALESCE(nh.old_stock_status,'?') || ' to ' || COALESCE(nh.new_stock_status,'?')
            WHEN 'stock_alert'  THEN 'Stock status changed from ' || COALESCE(nh.old_stock_status,'?') || ' to ' || COALESCE(nh.new_stock_status,'?')
            ELSE 'Notification'
          END,
          CASE
            WHEN u.notifications_cleared_at IS NOT NULL
             AND nh.triggered_at <= u.notifications_cleared_at THEN TRUE
            ELSE FALSE
          END,
          jsonb_strip_nulls(jsonb_build_object(
            'product_id', nh.product_id, 'product_url', nh.product_url,
            'old_price', nh.old_price, 'new_price', nh.new_price, 'currency', nh.currency,
            'price_change_percent', nh.price_change_percent, 'target_price', nh.target_price,
            'old_stock_status', nh.old_stock_status, 'new_stock_status', nh.new_stock_status,
            'channels_notified', nh.channels_notified
          )),
          nh.triggered_at
        FROM notification_history nh
        LEFT JOIN users u ON u.id = nh.user_id;
      `);

      await client.query(
        `SELECT setval('notifications_id_seq', (SELECT COALESCE(MAX(id),1) FROM notifications), true)`
      );
    }

    // Matches 010: the history table and the cleared-at marker are both replaced
    // by notifications.is_read. Payloads are preserved in notifications.data.
    await client.query('DROP TABLE IF EXISTS notification_history');
    await client.query('ALTER TABLE users DROP COLUMN IF EXISTS notifications_cleared_at');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  // Intentionally a no-op: notification_history has been dropped by this point.
};
