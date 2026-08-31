import type { Pool, PoolClient } from 'pg';
import pool from '../../../../config/database';

/**
 * Anything that can run a query: the shared pool, or a client checked out for a
 * transaction.
 *
 * Repository methods that a transaction needs to include must accept one of
 * these. Reaching for the module-level pool inside a transaction silently opts
 * that statement out of it -- the write commits on its own and survives a
 * rollback of everything around it.
 */
export type Executor = Pool | PoolClient;

export const asExecutor = (executor?: Executor): Executor => executor ?? pool;
