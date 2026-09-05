import pool from '../../../../config/database';
import { 
  Product, 
  ProductWithLatestPrice, 
  ProductWithSparkline, 
  SparklinePoint
} from '../../../../models/types';
import { ITEM_ALERT_COLUMNS, ITEM_ALERT_JOIN, ITEM_DISPLAY_COLUMNS, withItemAlertSettings } from './item-alert-settings';

export const productDashboardRepository = {
  findByUserIdWithSparkline: async (userId: number): Promise<ProductWithSparkline[]> => {
    // Get all products with current price
    const productsResult = await pool.query(
      `SELECT p.*, ph.price as current_price, ph.currency, 
              ph_m.price as member_price,
              ph_o.price as original_price,
              u.currency as converted_currency, er.rate_date::text as conversion_rate_date, er.source as conversion_source,
              CASE 
                WHEN ph.currency = u.currency THEN ph.price
                ELSE ph.price * er.rate 
              END as converted_price,
              COALESCE(p.ai_status, ph.ai_status) as ai_status,
              COALESCE(rc.name, rc.domain) as retailer_name,${ITEM_ALERT_COLUMNS},${ITEM_DISPLAY_COLUMNS}
       FROM products p
       JOIN users u ON u.id = p.user_id
       ${ITEM_ALERT_JOIN}
       LEFT JOIN LATERAL (
         SELECT price, currency, ai_status FROM price_history
         WHERE product_id = p.id AND price_type = 'standard'
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ph ON true
       LEFT JOIN LATERAL (
         SELECT price FROM price_history
         WHERE product_id = p.id AND price_type = 'member-price'
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ph_m ON true
       LEFT JOIN LATERAL (
         SELECT price FROM price_history
         WHERE product_id = p.id AND price_type = 'original-price'
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ph_o ON true
       -- Rates are stored as EUR<->X pairs only; cross pairs triangulate via EUR.
       LEFT JOIN LATERAL (
         SELECT r.rate, r.rate_date, r.source
         FROM (
           SELECT d.rate, d.rate_date, d.source, 1 AS priority
           FROM exchange_rates d
           WHERE d.from_currency = ph.currency AND d.to_currency = u.currency
           UNION ALL
           SELECT ef.rate * et.rate, LEAST(ef.rate_date, et.rate_date), et.source, 2
           FROM exchange_rates ef
           JOIN exchange_rates et ON et.from_currency = 'EUR' AND et.to_currency = u.currency
           WHERE ef.from_currency = ph.currency AND ef.to_currency = 'EUR'
         ) r
         ORDER BY r.priority
         LIMIT 1
       ) er ON ph.currency IS NOT NULL AND ph.currency <> '' AND ph.currency <> u.currency
       LEFT JOIN LATERAL (
         SELECT name, domain FROM retailer_configs
         WHERE p.url LIKE '%' || domain || '%'
         AND active = true
         ORDER BY length(domain) DESC
         LIMIT 1
       ) rc ON true
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    const products = productsResult.rows.map(withItemAlertSettings);
    if (products.length === 0) return [];

    // Get sparkline data for all products (last 7 days)
    const productIds = products.map((p: Product) => p.id);
    const sparklineResult = await pool.query(
      // price_type must be filtered here. Without it a member-only or
      // struck-through original price is plotted as though it were a change in
      // the tracked price, and the sparkline shows drops that never happened.
      `SELECT product_id, price, recorded_at
       FROM price_history
       WHERE product_id = ANY($1)
       AND price_type = 'standard'
       AND recorded_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
       ORDER BY product_id, recorded_at ASC`,
      [productIds]
    );

    // Get min prices for all products (all-time low)
    const minPriceResult = await pool.query(
      // Same reason: a member price is not a price this user ever paid, so it
      // must not become the product's all-time low.
      `SELECT product_id, MIN(price) as min_price
       FROM price_history
       WHERE product_id = ANY($1)
       AND price_type = 'standard'
       GROUP BY product_id`,
      [productIds]
    );

    // Group sparkline data by product
    const sparklineMap = new Map<number, SparklinePoint[]>();
    for (const row of sparklineResult.rows) {
      const points = sparklineMap.get(row.product_id) || [];
      points.push({ price: row.price, recorded_at: row.recorded_at });
      sparklineMap.set(row.product_id, points);
    }

    // Map min prices by product
    const minPriceMap = new Map<number, number>();
    for (const row of minPriceResult.rows) {
      minPriceMap.set(row.product_id, parseFloat(row.min_price));
    }

    // Combine products with sparkline data
    return products.map((product: ProductWithLatestPrice) => {
      const sparkline = sparklineMap.get(product.id) || [];
      let priceChange7d: number | null = null;

      if (sparkline.length >= 2) {
        const firstPrice = parseFloat(String(sparkline[0].price));
        const lastPrice = parseFloat(String(sparkline[sparkline.length - 1].price));
        if (firstPrice > 0) {
          priceChange7d = ((lastPrice - firstPrice) / firstPrice) * 100;
        }
      }

      return {
        ...product,
        sparkline,
        price_change_7d: priceChange7d,
        min_price: minPriceMap.get(product.id) || null,
      };
    });
  },
};
