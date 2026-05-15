import { getProjets } from '@/lib/airtable';
import TableauBuilder from '@/components/portfolio/TableauBuilder';

export default async function TableauPage() {
  const projets = await getProjets();
  return <TableauBuilder projets={projets} />;
}
