import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __fellowsDb?: { pool: Pool; db: Db } };

export function db(): Db {
  if (!globalForDb.__fellowsDb) {
    const pool = new Pool({ connectionString: env().DATABASE_URL, max: 10 });
    globalForDb.__fellowsDb = { pool, db: drizzle(pool, { schema }) };
  }
  return globalForDb.__fellowsDb.db;
}

export async function closeDb() {
  await globalForDb.__fellowsDb?.pool.end();
  globalForDb.__fellowsDb = undefined;
}

export { schema };
