import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Empties every table between integration tests. */
export async function resetDb() {
  await db().execute(
    sql`TRUNCATE funnel_events, sessions, application_members, team_members, applications, teams, aid_claims, users RESTART IDENTITY CASCADE`,
  );
}
