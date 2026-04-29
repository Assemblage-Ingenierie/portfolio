import { getSupabaseClient } from './client';

/**
 * Construit les headers d'authentification à attacher aux fetch vers les
 * routes API protégées. Avec le flow OAuth implicit, le JWT est en
 * localStorage — on doit l'envoyer manuellement via Authorization Bearer.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const sb = getSupabaseClient();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
