import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';
import { applyWpDefaultsToUnfinished } from '@/lib/airtable/mutations';
import { projetTag } from '@/lib/airtable/queries';

/**
 * POST /api/admin/apply-wp-defaults
 *
 * Réservé aux admins. Applique le preset WordPress (`ASSEMBLAGE_WP_DEFAULTS` :
 * typographie générale, champs du bandeau, espacements) par-dessus la config WP
 * de TOUTES les fiches au statut « Pas faite » — photos / catégories /
 * prestation de chaque fiche préservées. Cf. `applyWpDefaultsToUnfinished`.
 *
 * N'invalide que les tags fiche (`projet:<slug>`) — la config WP fait partie des
 * FICHE_ONLY_FIELDS (non indexée), donc la liste n'est pas touchée.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApprovedUser(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { slugs } = await applyWpDefaultsToUnfinished();
    for (const slug of slugs) revalidateTag(projetTag(slug), 'max');
    return NextResponse.json({ ok: true, updated: slugs.length, slugs });
  } catch (e) {
    console.error('[apply-wp-defaults]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
