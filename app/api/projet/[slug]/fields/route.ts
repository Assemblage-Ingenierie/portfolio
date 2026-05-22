import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { updateProjetFields } from '@/lib/airtable';
import { PROJETS_LIST_TAG, projetTag } from '@/lib/airtable/queries';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';
import type { ProjetEditableFields } from '@/lib/airtable';

/**
 * Champs qui n'affectent QUE la fiche individuelle (jamais affichés/filtrés
 * dans la home, le builder, le tableau ou le tableau public). Quand un body
 * PATCH ne contient QUE des champs de cette liste, on invalide uniquement le
 * tag de la fiche — pas le tag de la liste — ce qui économise ~N writes ISR
 * par sauvegarde (N = nombre de fiches en cache).
 *
 * À l'inverse, tout champ hors de cette whitelist (nom, statut, programme,
 * année, pôle, MOA, lieu, etc.) DOIT invalider la liste pour que les vues
 * agrégées restent cohérentes.
 */
const FICHE_ONLY_FIELDS: ReadonlySet<keyof ProjetEditableFields> = new Set([
  'description',
  'prestationAssemblage',
  'savedManualConfig',
  'bandeauConfig',
  'photoCrops',
  'template',
  'referentAi',
  'mandataire',
  'entreprise',
  'departement',
  'motsCles',
]);

function affectsList(body: ProjetEditableFields): boolean {
  return (Object.keys(body) as (keyof ProjetEditableFields)[])
    .some((k) => !FICHE_ONLY_FIELDS.has(k));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireApprovedUser(req);
  if (auth instanceof NextResponse) return auth;

  const { slug } = await params;

  let body: ProjetEditableFields;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  try {
    const result = await updateProjetFields(slug, body);

    // Toujours invalider la fiche elle-même (ancien slug).
    revalidateTag(projetTag(slug));
    // Si renommée → invalider aussi sous le nouveau slug (le formula Slug
    // change quand "Nom du projet" change).
    if (result.slug !== slug) {
      revalidateTag(projetTag(result.slug));
    }
    // Liste invalidée uniquement si un champ indexé change OU si renommée
    // (le nom apparaît dans la grille / les filtres recherche).
    if (affectsList(body) || result.slug !== slug) {
      revalidateTag(PROJETS_LIST_TAG);
    }

    return NextResponse.json({ ok: true, slug: result.slug });
  } catch (err) {
    // Log côté serveur uniquement — ne pas renvoyer le message brut au client
    // (les erreurs Airtable contiennent l'URL upstream avec le base id et autres
    // détails infrastructure).
    console.error('Fields update error:', err);
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 });
  }
}
