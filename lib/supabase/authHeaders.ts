import { getSupabaseClient } from './client';

/**
 * Construit les headers d'authentification à attacher aux fetch vers les
 * routes API protégées. Avec le flow OAuth implicit, le JWT est en
 * localStorage — on doit l'envoyer manuellement via Authorization Bearer.
 *
 * Tente un refresh de session avant de retourner les headers, pour éviter
 * les 401 silencieux quand le JWT est expiré (le flow implicit ne fournit
 * pas de refresh token automatique côté Supabase JS, mais on essaie
 * `getSession()` qui peut renouveler dans certains cas).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const sb = getSupabaseClient();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Wrapper fetch qui :
 *  1. attache les headers d'auth automatiquement
 *  2. détecte un 401 → redirige vers /login et lève une erreur claire
 *  3. détecte un 403 → message explicite (utilisateur non approuvé)
 *
 * À utiliser pour toute requête vers une route API protégée par
 * `requireApprovedUser`.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const auth = await authHeaders();
  if (!auth.Authorization) {
    if (typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new Error('Session expirée — reconnecte-toi');
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...auth,
    },
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new Error('Session expirée — reconnecte-toi');
  }
  if (res.status === 403) {
    throw new Error("Accès refusé — ton compte n'est pas approuvé");
  }
  return res;
}
