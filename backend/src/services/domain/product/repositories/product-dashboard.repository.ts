import pool from '../../../../config/database';
import { 
  Product, 
  ProductWithLatestPrice, 
  ProductWithSparkline, 
  SparklinePoint
} from '../../../../models/types';

export const productDashboardRepository = {
  findByUserIdWithSparkline: async (userId: number): Promise<ProductWithSparkline[]> => {
    // Get all products with current price
    const productsResult = await pool.query(
      `SELECT p.*, ph.price as current_price, ph.currency, 
              ph_m.price as member_price,
              ph_o.price as original_price,
              u.currency as converted_currency,
              CASE 
                WHEN ph.currency = u.currency THEN ph.price
                ELSE ph.price * er.rate 
              END as converted_price,
              COALESCE(p.ai_status, ph.ai_status) as ai_status,
              COALESCE(rc.name, rc.domain) as retailer_name
       FROM products p
       JOIN users u ON u.id = p.user_id
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
       LEFT JOIN exchange_rates er ON er.from_currency = ph.currency AND er.to_currency = u.currency
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

    const products = productsResult.rows;
    if (products.length === 0) return [];

    // Get sparkline data for all products (last 7 days)
    const productIds = products.map((p: Product) => p.id);
    const sparklineResult = await pool.query(
      `SELECT product_id, price, recorded_at
       FROM price_history
       WHERE product_id = ANY($1)
       AND recorded_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
       ORDER BY product_id, recorded_at ASC`,
      [productIds]
    );

    // Get min prices for all products (all-time low)
    const minPriceResult = await pool.query(
      `SELECT product_id, MIN(price) as min_price
       FROM price_history
       WHERE product_id = ANY($1)
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
