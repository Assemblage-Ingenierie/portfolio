import { connection } from 'next/server';
import { getProjets } from '@/lib/airtable';
import PortfolioGrid from '@/components/portfolio/PortfolioGrid';

export default async function HomePage() {
  // Page DYNAMIQUE (hors ISR) — même traitement que /portfolio/builder et
  // /portfolio/tableau. En page ISR/statique, la home embarquait tout le
  // dataset (getProjets) et le PPR la découpait en segments (_full, __PAGE__…)
  // réécrits à chaque sauvegarde liste (revalidateTag(PROJETS_LIST_TAG)) →
  // ~956 write units + segments par fenêtre d'édition. En dynamique, la page
  // n'écrit plus dans l'ISR ; les données viennent de getProjets() (caché,
  // 1 entrée invalidée à la demande). Cf. CLAUDE.md (quota ISR).
  await connection();
  const projets = await getProjets();
  return <PortfolioGrid projets={projets} />;
}
