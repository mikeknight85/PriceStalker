import { beforeAll, afterAll } from 'vitest';
import pool from '../config/database';

beforeAll(() => {
  // Setup logic if needed
});

afterAll(async () => {
  // Close database pool to ensure tests exit cleanly
  await pool.end();
});
