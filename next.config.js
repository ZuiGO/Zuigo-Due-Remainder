/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enables src/instrumentation.ts, which starts the daily auto-dispatch scheduler with the server.
  experimental: { instrumentationHook: true },
};

module.exports = nextConfig;
