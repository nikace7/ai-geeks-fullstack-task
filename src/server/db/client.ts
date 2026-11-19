import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/server/env";
import * as schema from "./schema";

// Next.js re-evaluates modules on every hot reload in development. Keeping the pool on
// globalThis stops each reload from opening a new set of connections.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 5,
    // Fail fast with an error instead of hanging a request when the database is unreachable.
    connectionTimeoutMillis: 5_000,
  });
if (env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle({ client: pool, schema });
export type Db = typeof db;
