'use cache';

import { cacheLife } from 'next/cache';
import { getProjets } from '@/lib/airtable';
import PortfolioBuilder from '@/components/portfolio/PortfolioBuilder';

export default async function BuilderPage() {
  // Cf. app/page.tsx : profil `max` pour éviter la régénération 15 min du
  // cache de page (fraîcheur garantie par revalidateTag à la sauvegarde).
  cacheLife('max');
  const projets = await getProjets();
  return <PortfolioBuilder projets={projets} />;
}
