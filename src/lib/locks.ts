import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Serialises lifecycle changes per user so concurrent submits, deletes and joins can't interleave.
 * Lock order is always user first, then team (see `lockTeam`), so the two never deadlock.
 */
export async function lockUser(tx: Tx, userId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"applicant:" + userId}))`);
}
