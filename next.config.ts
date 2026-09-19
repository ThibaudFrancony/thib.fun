import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  async redirects() {
    return [
      { source: "/historique", destination: "/profil", permanent: true },
    ];
  },
};

export default nextConfig;
