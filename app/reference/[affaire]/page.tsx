import { getProjetByAffaire } from '@/lib/airtable';
import { notFound } from 'next/navigation';
import { renderReference } from '@/lib/pdf/templates/reference';

/**
 * Preview HTML d'une fiche de référence, accessible par numéro d'affaire.
 * Ex : /reference/A584S_BABINET_106ROBERKAMPF
 * Pas de contrainte A4 — page HTML scrollable, visible dans le navigateur.
 */
export default async function ReferencePage({
  params,
}: {
  params: Promise<{ affaire: string }>;
}) {
  const { affaire } = await params;
  const projet = await getProjetByAffaire(affaire);
  if (!projet) notFound();

  const bundle = renderReference(projet);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <style dangerouslySetInnerHTML={{ __html: bundle.css }} />
      {/* Fonts Google */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,300;1,6..72,400&family=Open+Sans:wght@400;600;700&display=swap"
        rel="stylesheet"
      />
      <div dangerouslySetInnerHTML={{ __html: bundle.body }} />
    </>
  );
}
