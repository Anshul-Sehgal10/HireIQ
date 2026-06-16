import type { NextConfig } from "next";

function normalizeApiBase(baseUrl: string | undefined): string {
  const fallback = baseUrl || "http://localhost:8000";
  const trimmed = fallback.replace(/\/$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

const nextConfig: NextConfig = {
  async rewrites() {
    const apiBase = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
