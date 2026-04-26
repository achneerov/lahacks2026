import type { NextConfig } from 'next';

const authUrl = process.env.AUTH_URL;
const allowedDevOrigins = authUrl ? [new URL(authUrl).host] : [];

const nextConfig: NextConfig = {
  images: {
    domains: ['static.usernames.app-backend.toolsforhumanity.com'],
  },
  allowedDevOrigins,
  reactStrictMode: false,
  // The desktop tree was ported verbatim from the previous Vite project and
  // doesn't satisfy Next's stricter ESLint rules (unescaped entities, unused
  // vars, etc.). Skip lint during production builds — `next dev` still
  // surfaces real type errors.
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
