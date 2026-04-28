'use client';

import { getSupabaseClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import styles from './attente.module.css';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <button onClick={handleLogout} className={styles.logoutBtn}>
      Se déconnecter
    </button>
  );
}
