'use cache';

import { cacheLife } from 'next/cache';
import { getProjets } from '@/lib/airtable';
import PortfolioGrid from '@/components/portfolio/PortfolioGrid';

export default async function HomePage() {
  // `hours` (revalidate 1h) — PAS `max`. La page rend en HTML les URLs
  // d'attachement Airtable (vignettes), qui expirent ~2h après émission. Un
  // cache externe explicite a précédence sur le `hours` interne de
  // getProjets() : il faut donc poser `hours` ICI aussi, sinon le HTML (URLs
  // incluses) resterait figé et les images casseraient. 1h << 2h → vignettes
  // toujours valides, tout en restant loin du quota ISR (cf. CLAUDE.md).
  cacheLife('hours');
  const projets = await getProjets();
  return <PortfolioGrid projets={projets} />;
}
