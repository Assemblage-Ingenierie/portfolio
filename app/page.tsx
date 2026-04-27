'use cache';

import { getProjets } from '@/lib/airtable';
import PortfolioGrid from '@/components/portfolio/PortfolioGrid';

export default async function HomePage() {
  const projets = await getProjets();
  return <PortfolioGrid projets={projets} />;
}
