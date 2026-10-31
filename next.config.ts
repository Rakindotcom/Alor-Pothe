import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    reactStrictMode: true,
    poweredByHeader: false,
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: [
            {
              key: "X-Robots-Tag",
              value: "noindex, nofollow, noarchive, nosnippet",
            },
            {
              key: "X-Content-Type-Options",
              value: "nosniff",
            },
            {
              key: "X-Frame-Options",
              value: "DENY",
            },
            {
              key: "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            },
          ],
        },
      ];
    },
  };
}
