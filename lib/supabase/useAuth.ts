'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

export type AuthState = 'loading' | 'loggedout' | 'waiting' | 'approved';

export interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'user';
  is_approved: boolean;
}

const CACHE_KEY = '_portfolio_profile';

function readCache(): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(p: Profile) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(p)); } catch {}
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('portfolio_profiles')
    .select('id, email, role, is_approved')
    .eq('id', userId)
    .single();
  if (error) {
    console.error('[useAuth] fetchProfile error:', error.code, error.message);
    return null;
  }
  return data as Profile;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const handleSession = useCallback(async (s: Session | null) => {
    if (!s) {
      setSession(null);
      setProfile(null);
      setAuthState('loggedout');
      clearCache();
      return;
    }
    setSession(s);

    const cached = readCache();
    // Only trust cache when already approved — avoids stale 'waiting' state
    if (cached?.id === s.user.id && cached.is_approved) {
      setProfile(cached);
      setAuthState('approved');
      fetchProfile(s.user.id).then(fresh => {
        if (fresh) {
          writeCache(fresh);
          setProfile(fresh);
          setAuthState(fresh.is_approved ? 'approved' : 'waiting');
        }
      });
      return;
    }

    const prof = await fetchProfile(s.user.id);
    if (prof) writeCache(prof);
    setProfile(prof);
    setAuthState(!prof || !prof.is_approved ? 'waiting' : 'approved');
  }, []);

  useEffect(() => {
    const sb = getSupabaseClient();
    let subscription: { unsubscribe: () => void } | null = null;

    sb.auth.getSession().then(({ data }) => {
      handleSession(data.session ?? null);
    });

    const { data: listener } = sb.auth.onAuthStateChange((_event, s) => {
      handleSession(s ?? null);
    });
    subscription = listener?.subscription ?? null;

    return () => { subscription?.unsubscribe(); };
  }, [handleSession]);

  const logout = useCallback(async () => {
    const sb = getSupabaseClient();
    await sb.auth.signOut();
    clearCache();
  }, []);

  return { authState, session, profile, logout };
}
