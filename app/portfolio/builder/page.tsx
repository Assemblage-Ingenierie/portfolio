'use cache';

import { cacheLife } from 'next/cache';
import { getProjets } from '@/lib/airtable';
import PortfolioBuilder from '@/components/portfolio/PortfolioBuilder';

export default async function BuilderPage() {
  // Cf. app/page.tsx : profil `hours` (et non `max`) car la page rend les URLs
  // d'attachement Airtable temporaires (~2h). 1h de revalidate garde les
  // vignettes valides ; un cache plus long les casserait.
  cacheLife('hours');
  const projets = await getProjets();
  return <PortfolioBuilder projets={projets} />;
}
