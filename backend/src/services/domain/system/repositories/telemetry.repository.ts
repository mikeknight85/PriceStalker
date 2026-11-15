import pool from '../../../../config/database';

export interface TelemetryEntityCounts {
  itemsCount: number;
  storesCount: number;
  usersCount: number;
}

// Telemetry aggregate queries. Only ever returns counts — never rows, URLs or
// user data — so that the coarse-aggregations-only guarantee in the telemetry
// documentation holds at the query layer, not just at the payload layer.
export const telemetryRepository = {
  getEntityCounts: async (): Promise<TelemetryEntityCounts> => {
    const result = await pool.query<{
      items_count: string;
      stores_count: string;
      users_count: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM items) as items_count,
        (SELECT COUNT(*) FROM products) as stores_count,
        (SELECT COUNT(*) FROM users) as users_count
    `);

    const row = result.rows[0];

    return {
      itemsCount: parseInt(row?.items_count ?? '', 10) || 0,
      storesCount: parseInt(row?.stores_count ?? '', 10) || 0,
      usersCount: parseInt(row?.users_count ?? '', 10) || 0,
    };
  },
};
