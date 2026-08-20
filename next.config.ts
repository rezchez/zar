import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows production validation to run beside a local dev server without
  // both processes writing to the same `.next` directory.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
