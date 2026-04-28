import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LogoutButton from './LogoutButton';
import styles from './attente.module.css';

async function AttenteContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className={styles.card}>
      <div className={styles.logo}>
        <span className={styles.logoText}>Assemblage ingénierie</span>
        <span className={styles.logoDot}>·A</span>
      </div>
      <h1 className={styles.title}>Accès en attente</h1>
      <p className={styles.text}>
        Votre compte <strong>{user.email}</strong> est enregistré.<br />
        Un administrateur doit approuver votre accès avant que vous puissiez consulter le portfolio.
      </p>
      <LogoutButton />
    </div>
  );
}

export default function AttentePage() {
  return (
    <div className={styles.page}>
      <Suspense>
        <AttenteContent />
      </Suspense>
    </div>
  );
}
