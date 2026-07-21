import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create the new notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        data JSONB DEFAULT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Migrate data from notification_history to notifications
    await client.query(`
      INSERT INTO notifications (user_id, type, title, message, is_read, data, created_at)
      SELECT 
        nh.user_id,
        nh.notification_type as type,
        COALESCE(nh.product_name, 'System Notification') as title,
        CASE 
          WHEN nh.notification_type = 'price_drop' THEN 'Price dropped from ' || COALESCE(nh.old_price::text, '?') || ' to ' || COALESCE(nh.new_price::text, '?') || ' ' || COALESCE(nh.currency, '')
          WHEN nh.notification_type = 'price_change' THEN 'Price changed from ' || COALESCE(nh.old_price::text, '?') || ' to ' || COALESCE(nh.new_price::text, '?') || ' ' || COALESCE(nh.currency, '')
          WHEN nh.notification_type = 'stock_alert' THEN 'Stock status changed from ' || COALESCE(nh.old_stock_status, '?') || ' to ' || COALESCE(nh.new_stock_status, '?')
          WHEN nh.notification_type = 'target_price' THEN 'Target price reached: ' || COALESCE(nh.new_price::text, '?') || ' ' || COALESCE(nh.currency, '')
          ELSE COALESCE(nh.details->>'action', nh.details->>'reason', 'System Notification')
        END as message,
        CASE 
          WHEN u.notifications_cleared_at IS NOT NULL AND nh.triggered_at <= u.notifications_cleared_at THEN TRUE
          ELSE FALSE
        END as is_read,
        jsonb_build_object(
          'product_id', nh.product_id,
          'product_url', nh.product_url,
          'old_price', nh.old_price,
          'new_price', nh.new_price,
          'currency', nh.currency,
          'price_change_percent', nh.price_change_percent,
          'target_price', nh.target_price,
          'old_stock_status', nh.old_stock_status,
          'new_stock_status', nh.new_stock_status,
          'channels_notified', nh.channels_notified,
          'details', nh.details
        ) as data,
        nh.triggered_at as created_at
      FROM notification_history nh
      LEFT JOIN users u ON nh.user_id = u.id;
    `);

    // 3. Drop notification_history table
    await client.query('DROP TABLE IF EXISTS notification_history');

    // 4. Drop notifications_cleared_at from users table
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add notifications_cleared_at back to users table
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_cleared_at TIMESTAMP');

    // 2. Recreate notification_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        notification_type VARCHAR(50) NOT NULL,
        triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        old_price NUMERIC(10,2),
        new_price NUMERIC(10,2),
        currency TEXT,
        price_change_percent NUMERIC(5,2),
        target_price NUMERIC(10,2),
        old_stock_status TEXT,
        new_stock_status TEXT,
        channels_notified JSONB,
        product_name TEXT,
        product_url TEXT,
        details JSONB DEFAULT NULL
      );
    `);

    // 3. Migrate data back to notification_history
    await client.query(`
      INSERT INTO notification_history (
        user_id, product_id, notification_type, triggered_at, 
        old_price, new_price, currency, price_change_percent, 
        target_price, old_stock_status, new_stock_status, 
        channels_notified, product_name, product_url, details
      )
      SELECT 
        user_id,
        (data->>'product_id')::integer,
        type,
        created_at,
        (data->>'old_price')::numeric,
        (data->>'new_price')::numeric,
        data->>'currency',
        (data->>'price_change_percent')::numeric,
        (data->>'target_price')::numeric,
        data->>'old_stock_status',
        data->>'new_stock_status',
        data->'channels_notified',
        title,
        data->>'product_url',
        data->'details'
      FROM notifications;
    `);

    // 4. Update notifications_cleared_at for users
    // (This is an approximation as we lost the specific clear time, but we can use the latest read notification)
    await client.query(`
      UPDATE users u
      SET notifications_cleared_at = (
        SELECT MAX(created_at)
        FROM notifications n
        WHERE n.user_id = u.id AND n.is_read = TRUE
      );
    `);

    // 5. Drop notifications table
    await client.query('DROP TABLE IF EXISTS notifications');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
