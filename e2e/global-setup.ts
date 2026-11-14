import { runMigrations } from "../scripts/migrations";

export const E2E_DB = process.env.TEST_DATABASE_URL ?? "postgres://fellows:fellows@localhost:5443/fellows_test";

export default async function setup() {
  await runMigrations(E2E_DB);
}
