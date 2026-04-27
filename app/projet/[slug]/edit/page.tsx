import { getProjet } from '@/lib/airtable';
import ProjetEditor from '@/components/projet/ProjetEditor';
import { notFound } from 'next/navigation';

export default async function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const projet = await getProjet(slug);

  if (!projet) notFound();

  return <ProjetEditor projet={projet} />;
}
