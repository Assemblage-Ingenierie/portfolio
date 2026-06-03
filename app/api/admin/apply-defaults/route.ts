import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';
import { applyAssemblageDefaultsToUnfinished } from '@/lib/airtable/mutations';
import { projetTag } from '@/lib/airtable/queries';

/**
 * POST /api/admin/apply-defaults
 *
 * Réservé aux admins. Écrit les préréglages Assemblage (typo bandeau + mise en
 * page Str-Env/Dev) dans le champ « Config template manuel » de TOUTES les
 * fiches au statut « Pas faite ». Cf. `applyAssemblageDefaultsToUnfinished`.
 *
 * N'invalide que les tags fiche (`projet:<slug>`) — la liste n'est pas touchée
 * (la config de mise en page ne fait pas partie des champs indexés).
 */
export async function POST(req: NextRequest) {
  const auth = await requireApprovedUser(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { slugs } = await applyAssemblageDefaultsToUnfinished();
    for (const slug of slugs) revalidateTag(projetTag(slug), 'max');
    return NextResponse.json({ ok: true, updated: slugs.length, slugs });
  } catch (e) {
    console.error('[apply-defaults]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
