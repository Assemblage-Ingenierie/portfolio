'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import styles from './attente.module.css';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <button onClick={handleLogout} className={styles.logoutBtn}>
      Se déconnecter
    </button>
  );
}
