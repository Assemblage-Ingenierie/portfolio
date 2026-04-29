import { NextResponse } from 'next/server';
import { createClient } from './server';

/**
 * Vérifie que la requête vient d'un utilisateur Supabase authentifié ET approuvé
 * (présent dans portfolio_profiles avec is_approved = true).
 *
 * Renvoie soit { user, profile } pour continuer, soit une NextResponse d'erreur
 * (401 / 403) à retourner immédiatement depuis le route handler.
 *
 * Usage :
 *   const auth = await requireApprovedUser();
 *   if (auth instanceof NextResponse) return auth;
 *   // ... auth.user.id, auth.profile.role disponibles
 */
export async function requireApprovedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('portfolio_profiles')
    .select('id, role, is_approved')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_approved) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { user, profile: profile as { id: string; role: 'admin' | 'user'; is_approved: boolean } };
}
