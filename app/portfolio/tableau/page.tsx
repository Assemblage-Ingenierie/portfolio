import { connection } from 'next/server';
import { getProjets } from '@/lib/airtable';
import TableauBuilder from '@/components/portfolio/TableauBuilder';

export default async function TableauPage() {
  // Page DYNAMIQUE (hors ISR) — cf. builder/page.tsx. Sans `connection()` elle
  // était prérendue statiquement et régénérée (× segments PPR, dataset complet)
  // à chaque sauvegarde via revalidateTag(PROJETS_LIST_TAG), ce qui dominait la
  // conso d'ISR write units. En dynamique : zéro write ISR pour cette page ;
  // les données viennent de getProjets() (caché, 1 entrée).
  await connection();
  const projets = await getProjets();
  return <TableauBuilder projets={projets} />;
}
