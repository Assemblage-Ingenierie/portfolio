import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'v5.airtableusercontent.com' },
      { protocol: 'https', hostname: 'dl.airtable.com' },
      { protocol: 'https', hostname: 'assemblage.net' },
    ],
  },
};

export default nextConfig;
