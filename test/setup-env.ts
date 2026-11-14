// Deterministic test configuration. Real secrets never appear in tests.
const k = (n: number) => Buffer.alloc(32, n).toString("base64");

Object.assign(process.env, {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://fellows:fellows@localhost:5443/fellows_test",
  APP_URL: "http://localhost:3000",
  HACKCLUB_AUTH_CLIENT_ID: "test-hc-client",
  HACKCLUB_AUTH_CLIENT_SECRET: "test-hc-secret",
  HACKATIME_CLIENT_ID: "test-ht-client",
  HACKATIME_CLIENT_SECRET: "test-ht-secret",
  ENCRYPTION_KEYS: JSON.stringify({ "1": k(1), "2": k(2) }),
  ENCRYPTION_ACTIVE_KEY_VERSION: "1",
  LOOKUP_KEY: k(9),
  ADMIN_HACKCLUB_IDS: "ident!admin1",
  // Never the real Airtable: test/fake-providers.ts answers this host.
  AIRTABLE_API_URL: "https://airtable.test",
  AIRTABLE_PAT: "pat-test",
  AIRTABLE_APP_NAME: "appTEST",
  AIRTABLE_TABLE_NAME: "tblTEST",
});
