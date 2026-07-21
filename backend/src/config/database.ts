import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Parse PostgreSQL numeric OID 1700 as float
types.setTypeParser(1700, (val) => parseFloat(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// We remove the direct logger dependency here to avoid circular imports.
// Error handling for the pool will be set up in the main application entry point.

export default pool;
