import type { NextConfig } from "next";
import path from "path";
import { existsSync } from "fs";

// In a git worktree the cwd has no node_modules; walk up to find the real root.
function findProjectRoot(dir: string): string {
  if (existsSync(path.join(dir, "node_modules"))) return dir;
  const parent = path.dirname(dir);
  return parent === dir ? dir : findProjectRoot(parent);
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: findProjectRoot(__dirname),
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
