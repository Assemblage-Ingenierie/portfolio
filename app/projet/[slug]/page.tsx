import { getProjet } from '@/lib/airtable';
import ProjetView from '@/components/projet/ProjetView';
import { notFound } from 'next/navigation';

export default async function ProjetPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { slug } = await params;
  const { print } = await searchParams;
  const projet = await getProjet(slug);

  if (!projet) notFound();

  return <ProjetView projet={projet} isPrint={print === 'true'} />;
}
