import { runMigrations } from "../scripts/migrations";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://fellows:fellows@localhost:5443/fellows_test";
  await runMigrations(url);
}
