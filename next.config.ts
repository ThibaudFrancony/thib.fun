import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  images: {
    // Avatars presignés Supabase + images locales optimisées par `next/image`.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [
      {
        // Assets publics versionnés par fichier : cache navigateur + CDN long.
        source: "/:folder(avatars|home|leaderboard|uno|geographie|maps)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/historique", destination: "/profil", permanent: true },
    ];
  },
};

export default nextConfig;
