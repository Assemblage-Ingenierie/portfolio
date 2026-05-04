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
  // @sparticuz/chromium doit être externalisé pour éviter que le bundler le relocalise
  // (sinon les binaires .br ne sont plus accessibles au runtime via leur chemin relatif).
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // Force l'inclusion des binaires Chromium + paged.js dans le déploiement Vercel
  outputFileTracingIncludes: {
    '/api/projet/[slug]/pdf': [
      './node_modules/@sparticuz/chromium/bin/**',
      './node_modules/pagedjs/dist/paged.js',
    ],
  },
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
