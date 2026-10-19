import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  // Allows production validation to run beside a local dev server without
  // both processes writing to the same `.next` directory.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  serverExternalPackages: ['pdfkit'],
  transpilePackages: ['morphicons'],
  allowedDevOrigins: [
    '192.168.2.172:3000',
    '192.168.2.172',
    '86.104.86.188:3000',
    '86.104.86.188',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
};

export default nextConfig;
