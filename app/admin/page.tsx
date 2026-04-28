import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminTable from './AdminTable';
import styles from './admin.module.css';

async function AdminContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('portfolio_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!me || me.role !== 'admin') redirect('/');

  const { data: profiles } = await supabase
    .from('portfolio_profiles')
    .select('id, email, role, is_approved, created_at')
    .order('created_at', { ascending: false });

  return (
    <>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoText}>Assemblage ingénierie</span>
          <span className={styles.logoDot}>·A</span>
        </div>
        <h1 className={styles.title}>Gestion des accès</h1>
      </header>
      <AdminTable profiles={profiles ?? []} />
    </>
  );
}

export default function AdminPage() {
  return (
    <div className={styles.page}>
      <Suspense>
        <AdminContent />
      </Suspense>
    </div>
  );
}
