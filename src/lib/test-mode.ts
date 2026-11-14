/**
 * End-to-end test mode: enables mocked OAuth providers and dev-only pages.
 * Requires an explicit flag AND a localhost APP_URL so it can never switch on in a deployment.
 */
export function isTestMode(): boolean {
  if (process.env.E2E_TEST_MODE !== "1") return false;
  try {
    const host = new URL(process.env.APP_URL ?? "").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function devPagesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || isTestMode();
}
