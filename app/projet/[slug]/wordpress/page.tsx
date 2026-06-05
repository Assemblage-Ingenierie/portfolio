import { Suspense } from 'react';
import { getProjet } from '@/lib/airtable';
import { notFound } from 'next/navigation';
import WordpressView from '@/components/projet/WordpressView';

/**
 * Page d'aperçu / stylisation de l'export WordPress (Export WP 1).
 * Rend le même HTML que le builder de publication, dans une iframe, avec une
 * sidebar de contrôles (typo + photos) persistée dans Airtable (`wpConfig`).
 */
async function WordpressLoader({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const projet = await getProjet(slug);
  if (!projet) notFound();
  return <WordpressView projet={projet} />;
}

export default function WordpressPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense>
      <WordpressLoader params={params} />
    </Suspense>
  );
}
