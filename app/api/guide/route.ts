import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser } from '@/lib/supabase/requireApprovedUser';
import { DEFAULT_GUIDE_MARKDOWN } from '@/lib/guide/defaultGuide';

const GUIDE_ID = 'main';

/**
 * GET /api/guide — renvoie le contenu markdown du guide d'utilisation.
 *
 * Tout utilisateur approuvé peut lire (gate `requireApprovedUser`). Si aucune
 * version personnalisée n'a encore été enregistrée par un admin (ligne vide),
 * on retombe sur le contenu par défaut codé dans le repo.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApprovedUser(req);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.supabase
    .from('portfolio_guide')
    .select('content, updated_at')
    .eq('id', GUIDE_ID)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const content = data?.content?.trim() ? data.content : DEFAULT_GUIDE_MARKDOWN;
  const isDefault = !data?.content?.trim();
  return NextResponse.json({ content, isDefault, updatedAt: data?.updated_at ?? null });
}

/**
 * PUT /api/guide — enregistre le contenu markdown du guide. Admin uniquement.
 *
 * L'écriture passe par le client Supabase authentifié de l'appelant : la
 * policy RLS « Admin writes guide » (is_admin()) verrouille déjà l'accès, et
 * on double le contrôle ici pour renvoyer un 403 explicite.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireApprovedUser(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from('portfolio_guide')
    .upsert(
      { id: GUIDE_ID, content: body.content, updated_at: new Date().toISOString(), updated_by: auth.user.id },
      { onConflict: 'id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
