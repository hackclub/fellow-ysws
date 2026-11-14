import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the migrations by hand against a scratch database so rows can be seeded between them.
const base = process.env.TEST_DATABASE_URL ?? "postgres://fellows:fellows@localhost:5443/fellows_test";
const scratch = `fellows_migtest_${process.pid}`;
const admin = new Pool({ connectionString: base });
let pool: Pool;

async function apply(file: string) {
  const sql = readFileSync(path.join(__dirname, "..", "..", "drizzle", file), "utf8");
  for (const stmt of sql.split("--> statement-breakpoint")) if (stmt.trim()) await pool.query(stmt);
}

beforeAll(async () => {
  await admin.query(`DROP DATABASE IF EXISTS ${scratch}`);
  await admin.query(`CREATE DATABASE ${scratch}`);
  const url = new URL(base);
  url.pathname = `/${scratch}`;
  pool = new Pool({ connectionString: url.toString() });
});

afterAll(async () => {
  await pool?.end();
  await admin.query(`DROP DATABASE IF EXISTS ${scratch}`);
  await admin.end();
});

describe("0001_teams migration", () => {
  it("backfills one founder member for every existing application", async () => {
    await apply("0000_init.sql");
    const users = [randomUUID(), randomUUID()];
    const apps = [randomUUID(), randomUUID()];
    for (const u of users) await pool.query(`INSERT INTO users (id, hc_id_hash, pii_enc) VALUES ($1, $2, 'x')`, [u, `h-${u}`]);
    await pool.query(
      `INSERT INTO applications (id, user_id, kind, content_enc, hackatime_seconds_snapshot, credited_seconds)
       VALUES ($1, $2, 'project', 'x', 9000, 7200), ($3, $4, 'aid', 'x', NULL, NULL)`,
      [apps[0], users[0], apps[1], users[1]],
    );

    await apply("0001_teams.sql");

    const { rows } = await pool.query(`SELECT application_id, user_id, role FROM application_members ORDER BY user_id`);
    expect(rows).toHaveLength(2);
    for (const [i, app] of apps.entries()) {
      expect(rows).toContainEqual({ application_id: app, user_id: users[i], role: "founder" });
    }
  });
});
