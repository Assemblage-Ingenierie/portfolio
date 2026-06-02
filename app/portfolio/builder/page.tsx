import { connection } from 'next/server';
import { getProjets } from '@/lib/airtable';
import PortfolioBuilder from '@/components/portfolio/PortfolioBuilder';

export default async function BuilderPage() {
  // Page DYNAMIQUE (hors ISR), volontairement PAS `'use cache'`.
  // C'est un outil admin occasionnel qui embarque tout le dataset (getProjets).
  // En page ISR/statique, elle était régénérée — et le PPR la découpe en ~7
  // segments, chacun porteur du dataset complet (gros payload) — à CHAQUE
  // sauvegarde touchant la liste (revalidateTag(PROJETS_LIST_TAG), ex. un
  // changement de statut de fiche). Résultat : un volume énorme de "write
  // units" Vercel pour quelques édits. En dynamique, la page n'écrit plus rien
  // dans l'ISR. Les données restent servies par getProjets() (toujours caché,
  // 1 seule entrée invalidée à la demande). Cf. CLAUDE.md (quota ISR).
  await connection();
  const projets = await getProjets();
  return <PortfolioBuilder projets={projets} />;
}
