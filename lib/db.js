// lib/db.js
// Neon PostgreSQL connection pool for Next.js (App Router, Node.js runtime).
//
// Setup:
//   npm install @neondatabase/serverless
//   .env.local  ->  DATABASE_URL="postgresql://user:pass@ep-xxxx.neon.tech/dbname?sslmode=require"
//
// Notes:
//   - Use the *pooled* Neon connection string (host contains "-pooler") on Vercel.
//   - Node 22+ (Vercel's default) has a global WebSocket, so no `ws` package is needed.
//     On older Node versions, install `ws` and set:
//       neonConfig.webSocketConstructor = require('ws');
//   - API routes that import this file must run on the Node.js runtime
//     (the default). Do not add `export const runtime = 'edge'` to them.

import { Pool } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to .env.local and to your Vercel project settings.');
}

// Reuse a single pool across hot reloads in development and across
// invocations in the same server instance in production.
const globalForDb = globalThis;

const pool =
  globalForDb.__neonPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,                        // small: each serverless instance is short-lived
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

// Prevent an idle-client error from crashing the process.
if (!globalForDb.__neonPool) {
  pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err);
  });
  globalForDb.__neonPool = pool;
}

/**
 * Run a single parameterised query.
 *   const { rows } = await query('SELECT * FROM students WHERE index_number = $1', [idx]);
 *
 * On failure, the thrown error keeps pg's `code` (e.g. '23505' for unique
 * violations) and `constraint` (e.g. 'attendance_unique_device'), which the
 * sign-in route uses to tell duplicate index numbers from duplicate devices.
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Run several statements atomically.
 *   await withTransaction(async (client) => {
 *     await client.query('UPDATE sessions SET ...');
 *     await client.query('...');
 *   });
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db] Rollback failed:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export default pool;