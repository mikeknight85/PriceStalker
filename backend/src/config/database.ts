import { Pool, types } from 'pg';
import { loadEnvironment } from './environment';
import { enableQueryTracing } from './queryTracing';

loadEnvironment();

// Parse PostgreSQL numeric OID 1700 as float
types.setTypeParser(1700, (val) => parseFloat(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// We remove the direct logger dependency here to avoid circular imports.
// Error handling for the pool will be set up in the main application entry point.

// Trace every statement (audit L-01). queryTracing imports the logger module
// directly; that chain ends at `pg` and never reaches back here, so it does not
// reintroduce the cycle the comment above is guarding against.
enableQueryTracing(pool);

export default pool;
