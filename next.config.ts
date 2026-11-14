import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page except the landing page depends on the session, so we use
  // classic dynamic rendering instead of Cache Components.
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
};

export default nextConfig;
