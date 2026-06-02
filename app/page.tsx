'use cache';

import { cacheLife } from 'next/cache';
import { getProjets } from '@/lib/airtable';
import PortfolioGrid from '@/components/portfolio/PortfolioGrid';

export default async function HomePage() {
  // `max` : sans cacheLife explicite, le cache de page reste en profil `default`
  // (revalidate 15 min) et se régénère en continu sous trafic/crawl, même si
  // getProjets() est en `max` (un cache interne plus long ne peut pas étendre
  // un cache externe resté en default). On aligne donc la page sur `max` :
  // la fraîcheur vient du revalidateTag à la sauvegarde, pas du temps.
  cacheLife('max');
  const projets = await getProjets();
  return <PortfolioGrid projets={projets} />;
}
