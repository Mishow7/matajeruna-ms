import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Do NOT throw at import time: `next build` imports API route modules to collect
// page data, and on hosts like Vercel the .env file (gitignored) is absent during
// build. Set DATABASE_URL in the hosting provider's environment settings instead.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn("[matajeruna] DATABASE_URL is not set. Database queries will fail until it is configured.");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool, { schema });
export * from "./schema";
