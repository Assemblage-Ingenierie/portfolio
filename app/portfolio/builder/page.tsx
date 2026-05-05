'use cache';

import { getProjets } from '@/lib/airtable';
import PortfolioBuilder from '@/components/portfolio/PortfolioBuilder';

export default async function BuilderPage() {
  const projets = await getProjets();
  return <PortfolioBuilder projets={projets} />;
}
