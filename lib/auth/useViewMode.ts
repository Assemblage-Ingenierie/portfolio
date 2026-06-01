'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase/useAuth';

export type ViewMode = 'admin' | 'user';

const STORAGE_KEY = '_portfolio_view_mode';

/**
 * Vue active de l'utilisateur : 'admin' (UI complète) ou 'user' (UI restreinte).
 *
 * Règles :
 * - Si le profil Supabase est `role: 'user'` → viewMode FORCÉ à `'user'`,
 *   pas de switch possible (`canSwitch = false`).
 * - Si le profil est `role: 'admin'` → viewMode défaut `'admin'`, mais
 *   l'utilisateur peut basculer vers `'user'` pour prévisualiser ce que voit
 *   un user standard. Le choix est persisté dans localStorage.
 *
 * Le composant qui consomme doit gérer le fallback `'user'` si `profile`
 * n'est pas encore chargé — on retourne `viewMode: 'user'` par défaut tant
 * que l'auth est en cours pour ne jamais leaker une UI admin à un user.
 */
export function useViewMode(): {
  viewMode: ViewMode;
  setViewMode: (next: ViewMode) => void;
  canSwitch: boolean;
} {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Source de vérité côté client : localStorage si admin, forcé sinon.
  const [stored, setStored] = useState<ViewMode>('user');
  useEffect(() => {
    if (!isAdmin) {
      setStored('user');
      return;
    }
    const fromLs = (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY)) as ViewMode | null;
    setStored(fromLs === 'user' ? 'user' : 'admin');
  }, [isAdmin]);

  const setViewMode = (next: ViewMode) => {
    if (!isAdmin) return; // les users ne peuvent pas switcher
    setStored(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
  };

  return {
    viewMode: isAdmin ? stored : 'user',
    setViewMode,
    canSwitch: isAdmin,
  };
}
