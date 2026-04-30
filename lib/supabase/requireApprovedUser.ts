import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from './server';

/**
 * Vérifie que la requête vient d'un utilisateur Supabase authentifié ET approuvé
 * (présent dans portfolio_profiles avec is_approved = true).
 *
 * Lit le JWT en deux endroits, dans cet ordre :
 *  1. Header `Authorization: Bearer <jwt>` — utilisé par les fetch côté client
 *     (le flow OAuth implicit stocke le token en localStorage, pas en cookie).
 *  2. Cookie de session — fallback pour les Server Components / liens directs
 *     (peu utilisé ici, mais présent pour le futur).
 *
 * Renvoie soit { user, profile } pour continuer, soit une NextResponse d'erreur
 * (401 / 403) à retourner immédiatement depuis le route handler.
 *
 * Usage :
 *   const auth = await requireApprovedUser(req);
 *   if (auth instanceof NextResponse) return auth;
 *   // ... auth.user.id, auth.profile.role disponibles
 */
export async function requireApprovedUser(req?: NextRequest) {
  const authHeader = req?.headers.get('authorization');
  const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any;
  let userId: string | null = null;

  if (bearerToken) {
    // Client avec le JWT en header → les SELECT respecteront RLS pour cet utilisateur
    supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      }
    );
    const { data, error } = await supabase.auth.getUser(bearerToken);
    if (error) console.error('[requireApprovedUser] getUser error:', error.status, error.message, '| SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40));
    if (!error && data?.user) userId = data.user.id;
  } else {
    // Fallback cookies (Server Components)
    supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('portfolio_profiles')
    .select('id, role, is_approved')
    .eq('id', userId)
    .single();

  if (!profile || !profile.is_approved) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return {
    user: { id: userId },
    profile: profile as { id: string; role: 'admin' | 'user'; is_approved: boolean },
  };
}
