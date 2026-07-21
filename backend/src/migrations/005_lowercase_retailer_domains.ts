import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query(`
    UPDATE retailer_configs SET domain = LOWER(domain);
  `);
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {};
