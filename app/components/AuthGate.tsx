'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/supabase/useAuth';
import LoginPage from '@/app/login/LoginContent';
import AttentePage from '@/app/attente/AttenteContent';
import styles from './authgate.module.css';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authState, session, profile, logout } = useAuth();

  // Les routes /public/* sont accessibles sans authentification (lecture seule).
  // Hooks appelés inconditionnellement avant ce test pour respecter les Rules of Hooks
  // (AuthGate est monté dans le root layout et persiste entre navigations).
  if (pathname?.startsWith('/public')) {
    return <>{children}</>;
  }

  if (authState === 'loading') {
    return (
      <div className={styles.loader}>
        <span className={styles.dot} />
      </div>
    );
  }

  if (authState === 'loggedout') {
    return <LoginPage />;
  }

  if (authState === 'waiting') {
    return <AttentePage email={session?.user?.email ?? ''} onLogout={logout} />;
  }

  return (
    <>
      {children}
      <button onClick={logout} className={styles.logoutBtn} title="Se déconnecter">
        ⏻
      </button>
    </>
  );
}
