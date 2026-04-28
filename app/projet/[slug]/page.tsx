import { Suspense } from 'react';
import { getProjet } from '@/lib/airtable';
import ProjetView from '@/components/projet/ProjetView';
import { notFound } from 'next/navigation';

async function ProjetLoader({
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

export default function ProjetPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  return (
    <Suspense>
      <ProjetLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}
