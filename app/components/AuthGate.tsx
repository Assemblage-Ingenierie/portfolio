'use client';

import { useAuth } from '@/lib/supabase/useAuth';
import LoginPage from '@/app/login/LoginContent';
import AttentePage from '@/app/attente/AttenteContent';
import styles from './authgate.module.css';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { authState, session, profile, logout } = useAuth();

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

  return <>{children}</>;
}
