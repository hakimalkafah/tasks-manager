import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ✅ This tells Vercel (and `next build`) to skip ESLint checks
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
